"""Counts for the guard's Today screen and the HOA officer's Overview. Totals only."""

from collections.abc import Iterable
from typing import Annotated, get_args

from fastapi import APIRouter, HTTPException, Query

from guardhouse.clock import local_hour, local_today, start_of_day, window_start
from guardhouse.db import Doc
from guardhouse.deps import DbDep, GatesDep, SubdivisionDep
from guardhouse.models import (
    HourCount,
    HourlyStats,
    Purpose,
    PurposeCount,
    PurposeStats,
    TodayStats,
)

router = APIRouter(prefix="/api/subdivisions/{sid}/stats", tags=["stats"])

WINDOWS = (7, 30)
Days = Annotated[int, Query(description="7 or 30: today plus the days before it.")]


def _window(days: int) -> int:
    if days not in WINDOWS:
        raise HTTPException(422, "days must be 7 or 30")
    return days


def _by_hour(docs: Iterable[Doc]) -> list[HourCount]:
    counts = {hour: {"registered": 0, "visitor": 0} for hour in range(24)}
    for doc in docs:
        counts[local_hour(doc["at"])][doc["verdict"]] += 1
    return [HourCount(hour=hour, **count) for hour, count in counts.items()]


@router.get("/today")
async def today(subdivision: SubdivisionDep, db: DbDep, gates: GatesDep) -> TodayStats:
    sid = str(subdivision["_id"])
    docs = await db.entries.find(
        {"subdivisionId": sid, "at": {"$gte": start_of_day(local_today())}},
        {"at": 1, "verdict": 1},
    ).to_list()
    registered = sum(1 for doc in docs if doc["verdict"] == "registered")
    inside = await db.entries.count_documents(
        {"subdivisionId": sid, "verdict": "visitor", "visitor.exitAt": None}
    )
    return TodayStats(
        entries=len(docs),
        registered=registered,
        visitors=len(docs) - registered,
        inside=inside,
        waiting=len(gates.get(sid).waiting),
        by_hour=_by_hour(docs),
    )


@router.get("/hourly")
async def hourly(subdivision: SubdivisionDep, db: DbDep, days: Days = 7) -> HourlyStats:
    days = _window(days)
    docs = await db.entries.find(
        {"subdivisionId": str(subdivision["_id"]), "at": {"$gte": window_start(days)}},
        {"at": 1, "verdict": 1},
    ).to_list()
    return HourlyStats(days=days, by_hour=_by_hour(docs))


@router.get("/purposes")
async def purposes(subdivision: SubdivisionDep, db: DbDep, days: Days = 7) -> PurposeStats:
    days = _window(days)
    counts: dict[str, int] = dict.fromkeys(get_args(Purpose), 0)
    async for doc in db.entries.find(
        {
            "subdivisionId": str(subdivision["_id"]),
            "verdict": "visitor",
            "at": {"$gte": window_start(days)},
        },
        {"visitor.purpose": 1},
    ):
        counts[doc["visitor"]["purpose"]] += 1
    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return PurposeStats(
        days=days,
        purposes=[PurposeCount.model_validate({"purpose": p, "count": n}) for p, n in ranked],
    )
