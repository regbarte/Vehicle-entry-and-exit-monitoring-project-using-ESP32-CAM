"""In-memory gate state, one per subdivision: the waiting list and camera status.

A restart clears it. Only confirmed entries are saved.
"""

import asyncio
import contextlib
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime

from fastapi import HTTPException

from guardhouse.camera import Camera, MockCamera
from guardhouse.db import Database
from guardhouse.events import EventHub
from guardhouse.models import CameraEvent, CameraStatus, Detection
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


class Gates:
    def __init__(self, db: Database, hub: EventHub, settings: Settings) -> None:
        self._db = db
        self._hub = hub
        self._settings = settings
        self._gates: dict[str, Gate] = {}

    def get(self, sid: str) -> Gate:
        return self._gates.setdefault(sid, Gate())

    def camera(self, sid: str) -> Camera:
        if not self._settings.mock_camera:
            raise HTTPException(503, "Only the mock camera is available in this build")

        async def registered_plates() -> list[str]:
            cursor = self._db.houses.find(
                {"subdivisionId": sid, "vehicle": {"$ne": None}}, {"vehicle.plateDisplay": 1}
            )
            return [doc["vehicle"]["plateDisplay"] async for doc in cursor]

        return MockCamera(registered_plates)

    async def poll_cameras(self) -> None:
        """Check each active subdivision's camera and push a `camera` event."""
        while True:
            async for doc in self._db.subdivisions.find({"active": True}, {"_id": 1}):
                await self._check_camera(str(doc["_id"]))
            await asyncio.sleep(self._settings.camera_poll_seconds)

    async def _check_camera(self, sid: str) -> None:
        gate = self.get(sid)
        now = datetime.now(UTC)
        try:
            async with asyncio.timeout(2):
                report = await self.camera(sid).status()
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
    task = asyncio.create_task(gates.poll_cameras())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
