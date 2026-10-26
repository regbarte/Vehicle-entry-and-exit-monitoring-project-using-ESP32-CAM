from typing import Annotated

from fastapi import Depends, HTTPException, Request

from guardhouse.db import Database, Doc, object_id
from guardhouse.events import EventHub
from guardhouse.gate import Gates
from guardhouse.settings import Settings


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_hub(request: Request) -> EventHub:
    return request.app.state.hub


def get_gates(request: Request) -> Gates:
    return request.app.state.gates


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


DbDep = Annotated[Database, Depends(get_db)]
HubDep = Annotated[EventHub, Depends(get_hub)]
GatesDep = Annotated[Gates, Depends(get_gates)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_subdivision(sid: str, db: DbDep) -> Doc:
    doc = await db.subdivisions.find_one({"_id": object_id(sid)})
    if doc is None:
        raise HTTPException(404, "Subdivision not found")
    return doc


async def get_active_subdivision(subdivision: Annotated[Doc, Depends(get_subdivision)]) -> Doc:
    """For routes that save: scans, entries and registry changes."""
    if not subdivision["active"]:
        raise HTTPException(409, "This subdivision is inactive. Its records are read-only.")
    return subdivision


SubdivisionDep = Annotated[Doc, Depends(get_subdivision)]
ActiveSubdivisionDep = Annotated[Doc, Depends(get_active_subdivision)]
