"""The boom barrier: its state, and opening or closing it from the gate screen."""

from fastapi import APIRouter, HTTPException, Request

from guardhouse.barrier import Barrier
from guardhouse.deps import ActiveSubdivisionDep, SubdivisionDep
from guardhouse.models import BarrierStatus

router = APIRouter(prefix="/api/subdivisions/{sid}/barrier", tags=["barrier"])


def _barrier(request: Request, subdivision: dict) -> Barrier:
    barrier: Barrier = request.app.state.barrier
    if str(subdivision["_id"]) != barrier.sid:
        raise HTTPException(404, "This subdivision has no barrier")
    return barrier


async def _send(barrier: Barrier, command: str) -> BarrierStatus:
    try:
        await barrier.send(command)
    except ConnectionError:
        raise HTTPException(503, "The barrier is not connected") from None
    return BarrierStatus(state=barrier.state)


@router.get("")
async def barrier_status(request: Request, subdivision: SubdivisionDep) -> BarrierStatus:
    return BarrierStatus(state=_barrier(request, subdivision).state)


@router.post("/open")
async def open_barrier(request: Request, subdivision: ActiveSubdivisionDep) -> BarrierStatus:
    return await _send(_barrier(request, subdivision), "OPEN")


@router.post("/close")
async def close_barrier(request: Request, subdivision: ActiveSubdivisionDep) -> BarrierStatus:
    return await _send(_barrier(request, subdivision), "CLOSE")
