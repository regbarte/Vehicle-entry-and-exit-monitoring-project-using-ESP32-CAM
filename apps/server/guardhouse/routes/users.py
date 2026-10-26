"""Users of one subdivision. The provider adds its HOA officers; an HOA officer adds
guards and other HOA officers. No passwords yet: logins come with the cloud side."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from guardhouse.db import Doc, to_user
from guardhouse.deps import ActiveSubdivisionDep, DbDep, SubdivisionDep
from guardhouse.models import User, UserCreate, UserRole

router = APIRouter(prefix="/api/subdivisions/{sid}/users", tags=["users"])


@router.get("")
async def list_users(
    subdivision: SubdivisionDep, db: DbDep, role: UserRole | None = None
) -> list[User]:
    query: Doc = {"subdivisionId": str(subdivision["_id"])}
    if role:
        query["role"] = role
    cursor = db.users.find(query).sort([("role", 1), ("name", 1)])
    return [to_user(doc) async for doc in cursor]


@router.post("", status_code=201)
async def add_user(body: UserCreate, subdivision: ActiveSubdivisionDep, db: DbDep) -> User:
    doc: Doc = {
        "subdivisionId": str(subdivision["_id"]),
        "name": " ".join(body.name.split()),
        "email": body.email.strip().lower(),
        "role": body.role,
        "createdAt": datetime.now(UTC),
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "That email already has an account") from None
    doc["_id"] = result.inserted_id
    return to_user(doc)
