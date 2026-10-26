from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from pymongo import ASCENDING, AsyncMongoClient
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.asynchronous.database import AsyncDatabase

from guardhouse.labels import house_label, residence_label
from guardhouse.models import Entry, House, Subdivision, User, Vehicle

Doc = dict[str, Any]


class Database:
    def __init__(self, uri: str, name: str) -> None:
        self.client: AsyncMongoClient[Doc] = AsyncMongoClient(uri, tz_aware=True)
        self.db: AsyncDatabase[Doc] = self.client[name]
        self.subdivisions: AsyncCollection[Doc] = self.db["subdivisions"]
        self.houses: AsyncCollection[Doc] = self.db["houses"]
        self.entries: AsyncCollection[Doc] = self.db["entries"]
        self.users: AsyncCollection[Doc] = self.db["users"]

    async def create_indexes(self) -> None:
        await self.houses.create_index(
            [("subdivisionId", ASCENDING), ("block", ASCENDING), ("lot", ASCENDING)],
            unique=True,
        )
        await self.houses.create_index(
            [("subdivisionId", ASCENDING), ("vehicle.plate", ASCENDING)],
            unique=True,
            partialFilterExpression={"vehicle.plate": {"$type": "string"}},
        )
        await self.entries.create_index([("subdivisionId", ASCENDING), ("at", ASCENDING)])
        # One account per email across every subdivision, so it can become a login.
        await self.users.create_index("email", unique=True)

    async def close(self) -> None:
        await self.client.close()


def object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Not found") from None


def file_url(path: str | None) -> str | None:
    return f"/files/{path}" if path else None


def to_subdivision(doc: Doc) -> Subdivision:
    return Subdivision(
        id=str(doc["_id"]),
        name=doc["name"],
        address=doc.get("address", ""),
        camera_url=doc["cameraUrl"],
        active=doc["active"],
        created_at=doc["createdAt"],
    )


def to_house(doc: Doc) -> House:
    vehicle = doc.get("vehicle")
    return House(
        id=str(doc["_id"]),
        subdivision_id=str(doc["subdivisionId"]),
        block=doc["block"],
        lot=doc["lot"],
        street=doc.get("street", ""),
        owner_name=doc["ownerName"],
        contact=doc.get("contact", ""),
        updated_at=doc["updatedAt"],
        vehicle=Vehicle(plate=vehicle["plate"], plate_display=vehicle["plateDisplay"])
        if vehicle
        else None,
        label=house_label(doc["block"], doc["lot"]),
        residence_label=residence_label(doc["ownerName"]),
    )


def to_user(doc: Doc) -> User:
    return User(
        id=str(doc["_id"]),
        subdivision_id=str(doc["subdivisionId"]),
        name=doc["name"],
        email=doc["email"],
        role=doc["role"],
        created_at=doc["createdAt"],
    )


def to_entry(doc: Doc) -> Entry:
    visitor = doc.get("visitor")
    if visitor:
        visitor = {
            "purpose": visitor["purpose"],
            "destination": visitor["destination"],
            "id_photo_url": file_url(visitor.get("idPhoto")),
            "exit_at": visitor.get("exitAt"),
        }
    return Entry.model_validate(
        {
            "id": str(doc["_id"]),
            "subdivision_id": str(doc["subdivisionId"]),
            "at": doc["at"],
            "plate": doc["plate"],
            "plate_raw": doc.get("plateRaw"),
            "verdict": doc["verdict"],
            "house_id": str(doc["houseId"]) if doc.get("houseId") else None,
            "house_label": doc.get("houseLabel"),
            "frame_url": file_url(doc.get("frame")),
            "visitor": visitor,
        }
    )
