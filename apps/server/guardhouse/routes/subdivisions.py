"""Provider routes, plus reading one subdivision's settings."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from guardhouse.clock import local_date, local_today, window_start
from guardhouse.db import Database, to_subdivision
from guardhouse.deps import DbDep, GatesDep, SubdivisionDep
from guardhouse.models import Subdivision, SubdivisionCreate, SubdivisionSummary, SubdivisionUpdate

router = APIRouter(prefix="/api/subdivisions", tags=["subdivisions"])

WEEK = 7


async def _daily_entries(db: Database) -> dict[str, list[int]]:
    """Entries per subdivision per day over the last 7 days, oldest first."""
    today = local_today()
    daily: dict[str, list[int]] = {}
    async for doc in db.entries.find(
        {"at": {"$gte": window_start(WEEK)}}, {"subdivisionId": 1, "at": 1}
    ):
        index = WEEK - 1 - (today - local_date(doc["at"])).days
        if 0 <= index < WEEK:
            daily.setdefault(doc["subdivisionId"], [0] * WEEK)[index] += 1
    return daily


@router.get("")
async def list_subdivisions(db: DbDep, gates: GatesDep) -> list[SubdivisionSummary]:
    """Status and counts only, never houses, entries or photos."""
    counts = {
        row["_id"]: row["count"]
        async for row in await db.houses.aggregate(
            [{"$group": {"_id": "$subdivisionId", "count": {"$sum": 1}}}]
        )
    }
    daily = await _daily_entries(db)
    summaries = []
    async for doc in db.subdivisions.find().sort("name"):
        sid = str(doc["_id"])
        days = daily.get(sid, [0] * WEEK)
        summaries.append(
            SubdivisionSummary(
                id=sid,
                name=doc["name"],
                address=doc.get("address", ""),
                active=doc["active"],
                camera_online=doc["active"] and gates.get(sid).camera.online,
                house_count=counts.get(sid, 0),
                entries_last_7_days=sum(days),
                daily_entries=days,
            )
        )
    return summaries


@router.post("", status_code=201)
async def create_subdivision(body: SubdivisionCreate, db: DbDep) -> Subdivision:
    doc = {
        "name": body.name.strip(),
        "address": body.address.strip(),
        "cameraUrl": body.camera_url.strip(),
        "active": True,
        "createdAt": datetime.now(UTC),
    }
    result = await db.subdivisions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return to_subdivision(doc)


@router.get("/{sid}")
async def get_subdivision(subdivision: SubdivisionDep) -> Subdivision:
    return to_subdivision(subdivision)


@router.patch("/{sid}")
async def update_subdivision(
    body: SubdivisionUpdate, subdivision: SubdivisionDep, db: DbDep
) -> Subdivision:
    changes = body.model_dump(exclude_unset=True, by_alias=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(422, "Fields cannot be set to null")
    if changes:
        await db.subdivisions.update_one({"_id": subdivision["_id"]}, {"$set": changes})
        subdivision.update(changes)
    return to_subdivision(subdivision)
