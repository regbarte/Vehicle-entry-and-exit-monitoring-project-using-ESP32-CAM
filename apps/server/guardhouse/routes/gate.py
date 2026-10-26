"""Scan, the waiting list, confirm, the camera view and live updates."""

import asyncio
import uuid
from collections.abc import AsyncIterable
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.sse import EventSourceResponse, ServerSentEvent
from plate_reader import near_matches, normalize, read_plate

from guardhouse.camera import mock_read_plate
from guardhouse.db import Database, Doc, to_entry, to_house
from guardhouse.deps import (
    ActiveSubdivisionDep,
    DbDep,
    GatesDep,
    HubDep,
    SettingsDep,
    SubdivisionDep,
)
from guardhouse.labels import house_label
from guardhouse.models import (
    CameraEvent,
    CameraStatus,
    ConfirmRequest,
    ConfirmResult,
    Detection,
    DetectionEvent,
    EntryEvent,
    GateEvent,
    Suggestion,
)

router = APIRouter(prefix="/api/subdivisions/{sid}", tags=["gate"])


async def _suggestions(
    db: Database, sid: str, reading: str | None, distance: int
) -> list[Suggestion]:
    if not reading:
        return []
    houses = {
        doc["vehicle"]["plate"]: doc
        async for doc in db.houses.find({"subdivisionId": sid, "vehicle": {"$ne": None}})
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
        for match in near_matches(reading, list(houses), distance)
    ]


@router.post("/scan")
async def scan(
    subdivision: ActiveSubdivisionDep,
    db: DbDep,
    gates: GatesDep,
    hub: HubDep,
    settings: SettingsDep,
) -> Detection:
    """Take one photo and read its plate. The detection joins the waiting list."""
    sid = str(subdivision["_id"])
    try:
        frame = await gates.capture_frame(sid)
    except TimeoutError:
        raise HTTPException(504, "The gate camera did not answer") from None

    detection_id = uuid.uuid4().hex
    path = f"frames/{sid}/{detection_id}.jpg"
    target = settings.data_dir / path
    target.parent.mkdir(parents=True, exist_ok=True)
    await run_in_threadpool(target.write_bytes, frame)

    if settings.mock_camera:
        reading = await run_in_threadpool(mock_read_plate, frame)
    else:
        plate = await run_in_threadpool(read_plate, frame)
        reading = plate.text if plate else None
    detection = Detection(
        id=detection_id,
        subdivision_id=sid,
        at=datetime.now(UTC),
        source="scan",
        plate_reading=reading,
        frame_url=f"/files/{path}",
        suggestions=await _suggestions(db, sid, reading, settings.near_match_distance),
    )
    gate = gates.get(sid)
    gate.waiting[detection_id] = detection
    gate.frames[detection_id] = path
    hub.publish(sid, DetectionEvent(type="detection", action="added", detection=detection))
    return detection


@router.get("/waiting")
async def waiting(subdivision: SubdivisionDep, gates: GatesDep) -> list[Detection]:
    """Detections the guard has not handled yet, oldest first."""
    return list(gates.get(str(subdivision["_id"])).waiting.values())


@router.post("/detections/{detection_id}/confirm")
async def confirm(
    detection_id: str,
    body: ConfirmRequest,
    subdivision: ActiveSubdivisionDep,
    db: DbDep,
    gates: GatesDep,
    hub: HubDep,
) -> ConfirmResult:
    """Check the confirmed plate against the registry.

    Registered: the entry is saved. Not registered: nothing is saved; the guard
    fills the visitor form, which posts to /entries/visitor.
    """
    sid = str(subdivision["_id"])
    gate = gates.get(sid)
    detection = gate.waiting.get(detection_id)
    if detection is None:
        raise HTTPException(404, "That detection is no longer waiting")
    plate = normalize(body.plate)
    if not plate:
        raise HTTPException(422, "A plate needs at least one letter or digit")

    house = await db.houses.find_one({"subdivisionId": sid, "vehicle.plate": plate})
    if house is None:
        return ConfirmResult(verdict="visitor", plate=plate, entry=None, house=None)

    doc: Doc = {
        "subdivisionId": sid,
        "at": datetime.now(UTC),
        "plate": plate,
        "plateRaw": detection.plate_reading,
        "verdict": "registered",
        "houseId": str(house["_id"]),
        "houseLabel": f"{house_label(house['block'], house['lot'])}, {house['ownerName']}",
        "frame": gate.frames.pop(detection_id, None),
    }
    result = await db.entries.insert_one(doc)
    doc["_id"] = result.inserted_id
    entry = to_entry(doc)
    del gate.waiting[detection_id]
    hub.publish(sid, DetectionEvent(type="detection", action="removed", detection=detection))
    hub.publish(sid, EntryEvent(type="entry", action="created", entry=entry))
    return ConfirmResult(verdict="registered", plate=plate, entry=entry, house=to_house(house))


@router.delete("/detections/{detection_id}", status_code=204)
async def dismiss(
    detection_id: str, subdivision: SubdivisionDep, gates: GatesDep, hub: HubDep
) -> Response:
    """Drop a detection without saving an entry, for example a photo with no car."""
    sid = str(subdivision["_id"])
    gate = gates.get(sid)
    detection = gate.waiting.pop(detection_id, None)
    if detection is None:
        raise HTTPException(404, "That detection is no longer waiting")
    # Dismiss means the guard wants this camera view read again. Continuous mode
    # normally suppresses a plate while it remains visible, so release this
    # reading from that window and let the next camera pass create a fresh
    # detection with a new frame and plate reading.
    if plate := normalize(detection.plate_reading or ""):
        gate.recent_plates.pop(plate, None)
    gate.frames.pop(detection_id, None)
    hub.publish(sid, DetectionEvent(type="detection", action="removed", detection=detection))
    return Response(status_code=204)


@router.get(
    "/camera/preview",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}, "description": "A small JPEG frame"}},
)
async def camera_preview(subdivision: SubdivisionDep, gates: GatesDep) -> Response:
    """The server proxies the camera's /preview, so the browser never talks to the camera."""
    sid = str(subdivision["_id"])
    camera = await gates.camera(sid)
    async with gates.get(sid).camera_lock:
        frame = await camera.preview()
    return Response(frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.get("/camera/status")
async def camera_status(subdivision: SubdivisionDep, gates: GatesDep) -> CameraStatus:
    return gates.get(str(subdivision["_id"])).camera


@router.get(
    "/events",
    response_class=EventSourceResponse,
    responses={
        200: {
            "description": (
                "Server-Sent Events. The `event:` field is the event's `type`: "
                "`detection`, `entry` or `camera`. `data:` is the JSON event."
            ),
            "model": GateEvent,
        }
    },
)
async def events(
    request: Request, subdivision: SubdivisionDep, gates: GatesDep, hub: HubDep
) -> AsyncIterable[ServerSentEvent]:
    sid = str(subdivision["_id"])
    queue = hub.subscribe(sid)
    try:
        # Start with the camera status so a new dashboard does not wait 5 seconds.
        yield ServerSentEvent(
            event="camera",
            data=CameraEvent(type="camera", camera=gates.get(sid).camera).model_dump(
                mode="json", by_alias=True
            ),
            retry=3000,
        )
        while not await request.is_disconnected():
            try:
                async with asyncio.timeout(15):
                    event = await queue.get()
            except TimeoutError:
                continue
            yield ServerSentEvent(
                event=event.type, data=event.model_dump(mode="json", by_alias=True)
            )
    finally:
        hub.unsubscribe(sid, queue)
