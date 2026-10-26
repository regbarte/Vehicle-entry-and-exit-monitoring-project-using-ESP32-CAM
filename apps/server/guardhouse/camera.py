"""The gate camera, and a fake one that stands in for the ESP32-CAM.

The real camera answers GET /capture, /preview and /status. MockCamera draws
frames instead, and `mock_read_plate` stands in for packages/plate-reader.
"""

import io
import random
import string
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from PIL import Image, ImageDraw, ImageFont


@dataclass
class CameraReport:
    uptime_seconds: int
    signal_dbm: int


class Camera(Protocol):
    async def capture(self) -> bytes: ...
    async def preview(self) -> bytes: ...
    async def status(self) -> CameraReport: ...


_STARTED = time.monotonic()
_LOOKALIKES = {"0": "O", "O": "0", "1": "I", "I": "1", "8": "B", "B": "8", "5": "S", "S": "5"}


def _visitor_plate() -> str:
    letters = "".join(random.choices(string.ascii_uppercase, k=3))
    digits = "".join(random.choices(string.digits, k=4))
    return f"{letters} {digits}"


def _misread(plate: str) -> str:
    """Change one character, the way OCR gets a plate slightly wrong."""
    chars = list(plate)
    positions = [i for i, c in enumerate(chars) if c.isalnum()]
    i = random.choice(positions)
    chars[i] = _LOOKALIKES.get(chars[i], random.choice(string.digits))
    return "".join(chars)


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


class MockCamera:
    """Draws a car frame with a plate on it.

    Half the time the plate comes from the registry, sometimes misread by one
    character; otherwise it is a made-up visitor plate. One frame in ten has no
    plate. The plate text rides in the JPEG comment so `mock_read_plate` can find it.
    """

    def __init__(self, registered_plates: Callable[[], Awaitable[list[str]]]) -> None:
        self._registered_plates = registered_plates

    async def _pick_plate(self) -> str | None:
        roll = random.random()
        if roll < 0.1:
            return None
        registered = await self._registered_plates()
        if registered and roll < 0.45:
            return random.choice(registered)
        if registered and roll < 0.6:
            return _misread(random.choice(registered))
        return _visitor_plate()

    async def capture(self) -> bytes:
        plate = await self._pick_plate()
        image = Image.new("RGB", (800, 600), (58, 46, 57))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((150, 180, 650, 470), radius=40, fill=(30, 85, 92))
        draw.rectangle((210, 230, 590, 330), fill=(20, 60, 66))
        draw.ellipse((190, 430, 290, 530), fill=(25, 20, 25))
        draw.ellipse((510, 430, 610, 530), fill=(25, 20, 25))
        if plate:
            draw.rectangle(
                (270, 370, 530, 440), fill=(250, 250, 245), outline=(20, 20, 20), width=3
            )
            draw.text((400, 405), plate, fill=(20, 20, 20), font=_font(44), anchor="mm")
        stamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        draw.text((16, 16), f"MOCK CAMERA  {stamp}", fill=(244, 216, 205), font=_font(18))
        out = io.BytesIO()
        image.save(out, "JPEG", quality=80, comment=(plate or "").encode())
        return out.getvalue()

    async def preview(self) -> bytes:
        image = Image.new("RGB", (320, 240), (58, 46, 57))
        draw = ImageDraw.Draw(image)
        # A car that drives across the frame every 8 seconds.
        x = int((time.time() % 8) / 8 * 440) - 120
        draw.rounded_rectangle((x, 110, x + 120, 180), radius=14, fill=(30, 85, 92))
        draw.rectangle((x + 40, 160, x + 80, 175), fill=(250, 250, 245))
        draw.line((0, 200, 320, 200), fill=(237, 177, 131), width=2)
        stamp = datetime.now(UTC).strftime("%H:%M:%S UTC")
        draw.text((8, 8), f"MOCK  {stamp}", fill=(244, 216, 205), font=_font(14))
        out = io.BytesIO()
        image.save(out, "JPEG", quality=70)
        return out.getvalue()

    async def status(self) -> CameraReport:
        return CameraReport(
            uptime_seconds=int(time.monotonic() - _STARTED),
            signal_dbm=random.randint(-67, -55),
        )


def mock_read_plate(jpeg: bytes) -> str | None:
    """Stands in for the plate reader: returns the plate MockCamera drew."""
    with Image.open(io.BytesIO(jpeg)) as image:
        comment = image.info.get("comment", b"")
    text = comment.decode() if isinstance(comment, bytes) else str(comment)
    return text or None
