"""The registry. The HOA officer adds, edits and removes houses; the guard only searches."""

import re
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response
from plate_reader import normalize
from pymongo.errors import DuplicateKeyError

from guardhouse.db import Doc, object_id, to_house
from guardhouse.deps import ActiveSubdivisionDep, DbDep, SubdivisionDep
from guardhouse.models import House, HouseCreate, HouseUpdate

router = APIRouter(prefix="/api/subdivisions/{sid}/houses", tags=["registry"])


def _vehicle(plate: str | None) -> dict[str, str] | None:
    if plate is None or not plate.strip():
        return None
    normalized = normalize(plate)
    if not normalized:
        raise HTTPException(422, "A plate needs at least one letter or digit")
    return {"plate": normalized, "plateDisplay": " ".join(plate.upper().split())}


def _duplicate(error: DuplicateKeyError) -> HTTPException:
    key = (error.details or {}).get("keyPattern", {})
    if "vehicle.plate" in key:
        return HTTPException(409, "That plate is already registered to another house")
    return HTTPException(409, "That block and lot is already in the registry")


@router.get("")
async def search_houses(subdivision: SubdivisionDep, db: DbDep, q: str = "") -> list[House]:
    query: Doc = {"subdivisionId": str(subdivision["_id"])}
    if q.strip():
        text = re.escape(q.strip())
        or_: list[Doc] = [
            {field: {"$regex": text, "$options": "i"}}
            for field in ("block", "lot", "street", "ownerName", "vehicle.plateDisplay")
        ]
        if plate := normalize(q):
            or_.append({"vehicle.plate": {"$regex": re.escape(plate)}})
        query["$or"] = or_
    cursor = db.houses.find(query).sort([("block", 1), ("lot", 1)]).limit(500)
    return [to_house(doc) async for doc in cursor]


@router.post("", status_code=201)
async def add_house(body: HouseCreate, subdivision: ActiveSubdivisionDep, db: DbDep) -> House:
    doc: Doc = {
        "subdivisionId": str(subdivision["_id"]),
        "block": body.block.strip(),
        "lot": body.lot.strip(),
        "street": body.street.strip(),
        "ownerName": " ".join(body.owner_name.split()),
        "contact": body.contact.strip(),
        "updatedAt": datetime.now(UTC),
        "vehicle": _vehicle(body.plate),
    }
    try:
        result = await db.houses.insert_one(doc)
    except DuplicateKeyError as error:
        raise _duplicate(error) from None
    doc["_id"] = result.inserted_id
    return to_house(doc)


@router.patch("/{house_id}")
async def edit_house(
    house_id: str, body: HouseUpdate, subdivision: ActiveSubdivisionDep, db: DbDep
) -> House:
    sent = body.model_dump(exclude_unset=True)
    changes: Doc = {}
    for field, column in (
        ("block", "block"),
        ("lot", "lot"),
        ("street", "street"),
        ("owner_name", "ownerName"),
        ("contact", "contact"),
    ):
        if field in sent:
            if sent[field] is None:
                raise HTTPException(422, f"{column} cannot be null")
            changes[column] = " ".join(sent[field].split())
    if "plate" in sent:
        changes["vehicle"] = _vehicle(sent["plate"])
    changes["updatedAt"] = datetime.now(UTC)
    try:
        doc = await db.houses.find_one_and_update(
            {"_id": object_id(house_id), "subdivisionId": str(subdivision["_id"])},
            {"$set": changes},
            return_document=True,
        )
    except DuplicateKeyError as error:
        raise _duplicate(error) from None
    if doc is None:
        raise HTTPException(404, "House not found")
    return to_house(doc)


@router.delete("/{house_id}", status_code=204)
async def remove_house(house_id: str, subdivision: ActiveSubdivisionDep, db: DbDep) -> Response:
    """Past entries keep their copied plate and label."""
    result = await db.houses.delete_one(
        {"_id": object_id(house_id), "subdivisionId": str(subdivision["_id"])}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "House not found")
    return Response(status_code=204)
