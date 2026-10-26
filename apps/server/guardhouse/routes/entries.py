"""Entries: visitor entries, returning held IDs, the entry log and Inside now."""

import re
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from plate_reader import normalize
from pydantic import TypeAdapter, ValidationError

from guardhouse.clock import start_of_day
from guardhouse.db import Doc, object_id, to_entry
from guardhouse.deps import (
    ActiveSubdivisionDep,
    DbDep,
    GatesDep,
    HubDep,
    SettingsDep,
    SubdivisionDep,
)
from guardhouse.labels import residence_label
from guardhouse.models import (
    DestinationInput,
    DetectionEvent,
    Entry,
    EntryEvent,
    Purpose,
    Verdict,
)

router = APIRouter(prefix="/api/subdivisions/{sid}/entries", tags=["entries"])

_destination = TypeAdapter(DestinationInput)


@router.post("/visitor", status_code=201)
async def save_visitor_entry(
    subdivision: ActiveSubdivisionDep,
    db: DbDep,
    gates: GatesDep,
    hub: HubDep,
    settings: SettingsDep,
    detection_id: Annotated[str, Form(alias="detectionId")],
    plate: Annotated[str, Form()],
    purpose: Annotated[Purpose, Form()],
    destination: Annotated[
        str,
        Form(
            description=(
                'JSON: {"kind": "block", "block": "19"} or {"kind": "residence", "houseId": "..."}'
            )
        ),
    ],
    id_photo: Annotated[UploadFile | None, File(alias="idPhoto")] = None,
) -> Entry:
    sid = str(subdivision["_id"])
    gate = gates.get(sid)
    detection = gate.waiting.get(detection_id)
    if detection is None:
        raise HTTPException(404, "That detection is no longer waiting")
    confirmed = normalize(plate)
    if not confirmed:
        raise HTTPException(422, "A plate needs at least one letter or digit")
    if await db.houses.find_one({"subdivisionId": sid, "vehicle.plate": confirmed}):
        raise HTTPException(409, "That plate is registered. Confirm it instead.")

    try:
        target = _destination.validate_json(destination)
    except ValidationError as error:
        raise HTTPException(422, f"Invalid destination: {error.errors()[0]['msg']}") from None
    if target.kind == "residence":
        house = await db.houses.find_one({"_id": object_id(target.house_id), "subdivisionId": sid})
        if house is None:
            raise HTTPException(422, "That residence is not in the registry")
        stored_destination: Doc = {
            "kind": "residence",
            "houseId": str(house["_id"]),
            "label": residence_label(house["ownerName"]),
        }
    else:
        stored_destination = {"kind": "block", "block": target.block.strip()}

    doc: Doc = {
        "subdivisionId": sid,
        "at": datetime.now(UTC),
        "plate": confirmed,
        "plateRaw": detection.plate_reading,
        "verdict": "visitor",
        "frame": gate.frames.get(detection_id),
        "visitor": {
            "purpose": purpose,
            "destination": stored_destination,
            "idPhoto": None,
            "exitAt": None,
        },
    }
    result = await db.entries.insert_one(doc)
    doc["_id"] = result.inserted_id

    if id_photo is not None:
        path = f"ids/{sid}/{result.inserted_id}.jpg"
        file = settings.data_dir / path
        file.parent.mkdir(parents=True, exist_ok=True)
        await run_in_threadpool(file.write_bytes, await id_photo.read())
        await db.entries.update_one(
            {"_id": result.inserted_id}, {"$set": {"visitor.idPhoto": path}}
        )
        doc["visitor"]["idPhoto"] = path

    entry = to_entry(doc)
    del gate.waiting[detection_id]
    gate.frames.pop(detection_id, None)
    hub.publish(sid, DetectionEvent(type="detection", action="removed", detection=detection))
    hub.publish(sid, EntryEvent(type="entry", action="created", entry=entry))
    return entry


@router.post("/{entry_id}/return-id")
async def return_id(entry_id: str, subdivision: SubdivisionDep, db: DbDep, hub: HubDep) -> Entry:
    """Record the visitor's exit. Allowed for an inactive subdivision too, so a
    guard can still hand back an ID they are holding."""
    sid = str(subdivision["_id"])
    doc = await db.entries.find_one_and_update(
        {
            "_id": object_id(entry_id),
            "subdivisionId": sid,
            "verdict": "visitor",
            "visitor.exitAt": None,
        },
        {"$set": {"visitor.exitAt": datetime.now(UTC)}},
        return_document=True,
    )
    if doc is None:
        existing = await db.entries.find_one({"_id": object_id(entry_id), "subdivisionId": sid})
        if existing is None:
            raise HTTPException(404, "Entry not found")
        if existing["verdict"] != "visitor":
            raise HTTPException(409, "Only visitors have exits")
        raise HTTPException(409, "The ID was already returned")
    entry = to_entry(doc)
    hub.publish(sid, EntryEvent(type="entry", action="exited", entry=entry))
    return entry


@router.get("")
async def entry_log(
    subdivision: SubdivisionDep,
    db: DbDep,
    plate: str = "",
    day: Annotated[
        date | None, Query(alias="date", description="A day in the server's local time")
    ] = None,
    verdict: Verdict | None = None,
) -> list[Entry]:
    """Newest first, at most 200."""
    query: Doc = {"subdivisionId": str(subdivision["_id"])}
    if normalized := normalize(plate):
        query["plate"] = {"$regex": re.escape(normalized)}
    if day is not None:
        start = start_of_day(day)
        query["at"] = {"$gte": start, "$lt": start + timedelta(days=1)}
    if verdict is not None:
        query["verdict"] = verdict
    cursor = db.entries.find(query).sort("at", -1).limit(200)
    return [to_entry(doc) async for doc in cursor]


@router.get("/inside")
async def inside_now(subdivision: SubdivisionDep, db: DbDep) -> list[Entry]:
    """Visitors whose held ID has not been returned, oldest first. For the guard's
    screens; the HOA officer's screens don't call it."""
    cursor = db.entries.find(
        {"subdivisionId": str(subdivision["_id"]), "verdict": "visitor", "visitor.exitAt": None}
    ).sort("at", 1)
    return [to_entry(doc) async for doc in cursor]


@router.get("/{entry_id}")
async def entry_detail(entry_id: str, subdivision: SubdivisionDep, db: DbDep) -> Entry:
    doc = await db.entries.find_one(
        {"_id": object_id(entry_id), "subdivisionId": str(subdivision["_id"])}
    )
    if doc is None:
        raise HTTPException(404, "Entry not found")
    return to_entry(doc)
