"""In-memory gate state, one per subdivision: the waiting list and camera status.

A restart clears it. Only confirmed entries are saved.
"""

import asyncio
import contextlib
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from bson import ObjectId
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from plate_reader import image_brightness, near_matches, normalize, read_plate

from guardhouse.camera import Camera, HttpCamera, MockCamera, mock_read_plate
from guardhouse.db import Database
from guardhouse.events import EventHub
from guardhouse.labels import house_label
from guardhouse.models import CameraEvent, CameraStatus, Detection, DetectionEvent, Suggestion
from guardhouse.settings import Settings

log = logging.getLogger(__name__)

MISSES_BEFORE_OFFLINE = 2


@dataclass
class Gate:
    waiting: dict[str, Detection] = field(default_factory=dict)
    frames: dict[str, str] = field(default_factory=dict)
    camera: CameraStatus = field(
        default_factory=lambda: CameraStatus(
            online=False, uptime_seconds=None, signal_dbm=None, checked_at=None
        )
    )
    misses: int = 0
    camera_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    recent_plates: dict[str, float] = field(default_factory=dict)


class Gates:
    def __init__(self, db: Database, hub: EventHub, settings: Settings) -> None:
        self._db = db
        self._hub = hub
        self._settings = settings
        self._gates: dict[str, Gate] = {}

    def get(self, sid: str) -> Gate:
        return self._gates.setdefault(sid, Gate())

    async def camera(self, sid: str) -> Camera:
        async def registered_plates() -> list[str]:
            cursor = self._db.houses.find(
                {"subdivisionId": sid, "vehicle": {"$ne": None}}, {"vehicle.plateDisplay": 1}
            )
            return [doc["vehicle"]["plateDisplay"] async for doc in cursor]

        if self._settings.mock_camera:
            return MockCamera(registered_plates)
        subdivision = await self._db.subdivisions.find_one({"_id": ObjectId(sid)}, {"cameraUrl": 1})
        if not subdivision or not subdivision.get("cameraUrl"):
            raise HTTPException(503, "This subdivision has no camera address")
        return HttpCamera(subdivision["cameraUrl"], self._settings.capture_timeout_seconds)

    async def capture_frame(self, sid: str) -> bytes:
        """Capture UXGA, briefly using reduced flash only when the preview is dark."""
        gate = self.get(sid)
        async with gate.camera_lock:
            camera = await self.camera(sid)
            use_flash = False
            if not self._settings.mock_camera:
                preview = await camera.preview()
                brightness = await run_in_threadpool(image_brightness, preview)
                use_flash = brightness < self._settings.flash_dark_threshold
            try:
                if use_flash:
                    await camera.set_flash(True)
                    await asyncio.sleep(self._settings.flash_settle_seconds)
                async with asyncio.timeout(self._settings.capture_timeout_seconds + 1):
                    return await camera.capture()
            finally:
                if use_flash:
                    with contextlib.suppress(Exception):
                        await camera.set_flash(False)

    async def poll_cameras(self) -> None:
        """Check each active subdivision's camera and push a `camera` event."""
        while True:
            async for doc in self._db.subdivisions.find({"active": True}, {"_id": 1}):
                await self._check_camera(str(doc["_id"]))
            await asyncio.sleep(self._settings.camera_poll_seconds)

    async def watch_cameras(self) -> None:
        """Continuously add detected plates to each subdivision's waiting list."""
        while True:
            subdivision_ids = [
                str(doc["_id"])
                async for doc in self._db.subdivisions.find({"active": True}, {"_id": 1})
            ]
            if subdivision_ids:
                await asyncio.gather(*(self._continuous_detection(sid) for sid in subdivision_ids))
            await asyncio.sleep(self._settings.continuous_interval_seconds)

    async def _continuous_detection(self, sid: str) -> None:
        gate = self.get(sid)
        try:
            frame = await self.capture_frame(sid)
            if self._settings.mock_camera:
                reading = await run_in_threadpool(mock_read_plate, frame)
            else:
                result = await run_in_threadpool(read_plate, frame)
                reading = result.text if result else None
        except Exception:
            log.exception("Continuous-mode attempt failed for subdivision %s", sid)
            return

        plate = normalize(reading or "")
        if not plate:
            return
        assert reading is not None
        now = time.monotonic()
        cutoff = now - self._settings.repeat_window_seconds
        gate.recent_plates = {
            value: seen_at for value, seen_at in gate.recent_plates.items() if seen_at >= cutoff
        }
        if plate in gate.recent_plates:
            # Keep extending the window while the same car remains in view.
            # It can be detected again only after it has been absent long enough.
            gate.recent_plates[plate] = now
            return
        gate.recent_plates[plate] = now

        detection_id = uuid.uuid4().hex
        path = f"frames/{sid}/{detection_id}.jpg"
        target = self._settings.data_dir / path
        target.parent.mkdir(parents=True, exist_ok=True)
        await run_in_threadpool(target.write_bytes, frame)
        detection = Detection(
            id=detection_id,
            subdivision_id=sid,
            at=datetime.now(UTC),
            source="continuous",
            plate_reading=reading,
            frame_url=f"/files/{path}",
            suggestions=await self._suggestions(sid, reading),
        )
        gate.waiting[detection_id] = detection
        gate.frames[detection_id] = path
        self._hub.publish(
            sid, DetectionEvent(type="detection", action="added", detection=detection)
        )

    async def _suggestions(self, sid: str, reading: str) -> list[Suggestion]:
        houses = {
            doc["vehicle"]["plate"]: doc
            async for doc in self._db.houses.find({"subdivisionId": sid, "vehicle": {"$ne": None}})
        }
        return [
            Suggestion(
                plate=match.plate,
                plate_display=houses[match.plate]["vehicle"]["plateDisplay"],
                house_id=str(houses[match.plate]["_id"]),
                house_label=house_label(houses[match.plate]["block"], houses[match.plate]["lot"]),
                owner_name=houses[match.plate]["ownerName"],
                distance=match.distance,
            )
            for match in near_matches(reading, list(houses), self._settings.near_match_distance)
        ]

    async def _check_camera(self, sid: str) -> None:
        gate = self.get(sid)
        if gate.camera_lock.locked():
            return
        now = datetime.now(UTC)
        try:
            async with gate.camera_lock:
                async with asyncio.timeout(2):
                    camera = await self.camera(sid)
                    report = await camera.status()
        except Exception:
            gate.misses += 1
            if gate.misses >= MISSES_BEFORE_OFFLINE:
                gate.camera = gate.camera.model_copy(update={"online": False, "checked_at": now})
        else:
            gate.misses = 0
            gate.camera = CameraStatus(
                online=True,
                uptime_seconds=report.uptime_seconds,
                signal_dbm=report.signal_dbm,
                checked_at=now,
            )
        self._hub.publish(sid, CameraEvent(type="camera", camera=gate.camera))


@contextlib.asynccontextmanager
async def camera_poller(gates: Gates):
    tasks = [asyncio.create_task(gates.poll_cameras())]
    if gates._settings.continuous_mode_enabled:
        tasks.append(asyncio.create_task(gates.watch_cameras()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
