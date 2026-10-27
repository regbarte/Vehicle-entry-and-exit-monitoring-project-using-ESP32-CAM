"""The API contract. These models produce the OpenAPI schema, and from it the
dashboard's TypeScript types in packages/api-types.

Fields are snake_case in Python and camelCase on the wire.
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# Subdivisions


class Subdivision(ApiModel):
    id: str
    name: str
    address: str
    camera_url: str
    active: bool
    created_at: datetime


class SubdivisionSummary(ApiModel):
    """What the provider sees: status and counts, never houses, entries or photos."""

    id: str
    name: str
    address: str
    active: bool
    camera_online: bool
    house_count: int
    entries_last_7_days: int
    daily_entries: list[int] = Field(
        description="Entries per day over the last 7 days, oldest first, today last."
    )


class SubdivisionCreate(ApiModel):
    name: Annotated[str, Field(min_length=1)]
    address: str = ""
    camera_url: Annotated[str, Field(min_length=1)]


class SubdivisionUpdate(ApiModel):
    name: Annotated[str, Field(min_length=1)] | None = None
    address: str | None = None
    camera_url: Annotated[str, Field(min_length=1)] | None = None
    active: bool | None = None


# Users: the accounts that will sign in once the cloud side has logins. The
# provider adds a subdivision's HOA officers; an HOA officer adds guards and other
# HOA officers. The prototype stores them but has no passwords yet.

UserRole = Literal["guard", "hoa_officer"]


class User(ApiModel):
    id: str
    subdivision_id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime


class UserCreate(ApiModel):
    name: Annotated[str, Field(min_length=1)]
    email: Annotated[str, Field(min_length=3, pattern=r"^[^@\s]+@[^@\s]+$")]
    role: UserRole


# Registry


class Vehicle(ApiModel):
    plate: str = Field(description="Normalized: uppercase letters and digits only.")
    plate_display: str = Field(description="As the HOA officer typed it, for example 'NBC 1234'.")


class House(ApiModel):
    id: str
    subdivision_id: str
    block: str
    lot: str
    street: str
    owner_name: str
    contact: str
    updated_at: datetime
    vehicle: Vehicle | None
    label: str = Field(description="For example 'Block 19 Lot 4'.")
    residence_label: str = Field(description="For example 'Dela Cruz Residence'.")


class HouseCreate(ApiModel):
    block: Annotated[str, Field(min_length=1)]
    lot: Annotated[str, Field(min_length=1)]
    street: str = ""
    owner_name: Annotated[str, Field(min_length=1)]
    contact: str = ""
    plate: str | None = Field(default=None, description="The registered vehicle's plate, if any.")


class HouseUpdate(ApiModel):
    """Only the fields sent change. Send `plate: null` to remove the vehicle."""

    block: Annotated[str, Field(min_length=1)] | None = None
    lot: Annotated[str, Field(min_length=1)] | None = None
    street: str | None = None
    owner_name: Annotated[str, Field(min_length=1)] | None = None
    contact: str | None = None
    plate: str | None = None


# At the gate


class Suggestion(ApiModel):
    """A registered plate close to the plate reading. Distance 0 is an exact match."""

    plate: str
    plate_display: str
    house_id: str
    house_label: str
    owner_name: str
    distance: int


class Detection(ApiModel):
    id: str
    subdivision_id: str
    at: datetime
    source: Literal["scan", "continuous"]
    plate_reading: str | None = Field(description="Null when no plate was found in the photo.")
    frame_url: str
    suggestions: list[Suggestion]


class ConfirmRequest(ApiModel):
    plate: Annotated[str, Field(min_length=1)]


class BlockDestination(ApiModel):
    kind: Literal["block"]
    block: Annotated[str, Field(min_length=1)]


class ResidenceDestination(ApiModel):
    kind: Literal["residence"]
    house_id: str
    label: str


class ResidenceDestinationInput(ApiModel):
    kind: Literal["residence"]
    house_id: str


Destination = Annotated[BlockDestination | ResidenceDestination, Field(discriminator="kind")]
DestinationInput = Annotated[
    BlockDestination | ResidenceDestinationInput, Field(discriminator="kind")
]

Purpose = Literal["delivery", "guest", "service", "other"]
Verdict = Literal["registered", "visitor"]


class VisitorInfo(ApiModel):
    purpose: Purpose
    destination: Destination
    id_photo_url: str | None
    exit_at: datetime | None


class Entry(ApiModel):
    id: str
    subdivision_id: str
    at: datetime
    plate: str = Field(description="The confirmed plate.")
    plate_raw: str | None = Field(description="The plate reading before the guard confirmed it.")
    verdict: Verdict
    house_id: str | None
    house_label: str | None
    frame_url: str | None
    visitor: VisitorInfo | None


class ConfirmResult(ApiModel):
    """Registered: the entry is saved. Visitor: nothing is saved until the visitor form."""

    verdict: Verdict
    plate: str
    entry: Entry | None
    house: House | None


class CameraStatus(ApiModel):
    online: bool
    uptime_seconds: int | None
    signal_dbm: int | None
    checked_at: datetime | None


# Live updates, sent over GET /api/subdivisions/{sid}/events. The SSE `event:`
# field matches `type`.


class DetectionEvent(ApiModel):
    type: Literal["detection"]
    action: Literal["added", "removed"]
    detection: Detection


class EntryEvent(ApiModel):
    type: Literal["entry"]
    action: Literal["created", "exited"]
    entry: Entry


class CameraEvent(ApiModel):
    type: Literal["camera"]
    camera: CameraStatus


# The boom barrier's state comes from the Arduino; "unknown" until it answers.
BarrierState = Literal["open", "closed", "unknown"]


class BarrierStatus(ApiModel):
    state: BarrierState


class BarrierEvent(ApiModel):
    type: Literal["barrier"]
    state: BarrierState


GateEvent = Annotated[
    DetectionEvent | EntryEvent | CameraEvent | BarrierEvent, Field(discriminator="type")
]


# Stats: totals only. Days and hours are in the server laptop's local time.


class HourCount(ApiModel):
    hour: Annotated[int, Field(ge=0, le=23)]
    registered: int
    visitor: int


class TodayStats(ApiModel):
    """The guard's Today screen."""

    entries: int
    registered: int
    visitors: int
    inside: int = Field(description="Visitors whose held ID has not been returned, from any day.")
    waiting: int
    by_hour: list[HourCount] = Field(description="24 rows, hour 0 to 23.")


class HourlyStats(ApiModel):
    """Entries by hour of day over the last `days` days, today included."""

    days: int
    by_hour: list[HourCount] = Field(description="24 rows, hour 0 to 23.")


class PurposeCount(ApiModel):
    purpose: Purpose
    count: int


class PurposeStats(ApiModel):
    """Visitors by purpose over the last `days` days, today included, most first."""

    days: int
    purposes: list[PurposeCount]


class HouseCount(ApiModel):
    house_id: str
    registered: int = Field(description="Entries by the house's registered vehicle.")
    visitors: int = Field(description="Visitors who named this house as their residence.")


class BlockCount(ApiModel):
    block: str
    visitors: int = Field(description="Visitors who named this block, not a house.")


class HouseStats(ApiModel):
    """Entries per house over the last `days` days, today included. Houses with no
    entries in the window are left out."""

    days: int
    houses: list[HouseCount]
    blocks: list[BlockCount]
