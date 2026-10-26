import re
from dataclasses import dataclass

from rapidfuzz.distance import Levenshtein

# Characters Tesseract mixes up on Philippine plates. Each maps to the digit it
# is confused with, so "ABO 1234" and "AB0 1234" compare equal.
_CONFUSIONS = str.maketrans({"O": "0", "I": "1", "B": "8", "S": "5"})


def normalize(text: str) -> str:
    """Uppercase the plate and keep only letters and digits."""
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def _canonical(plate: str) -> str:
    return normalize(plate).translate(_CONFUSIONS)


@dataclass(frozen=True)
class NearMatch:
    plate: str
    distance: int


def near_matches(reading: str, registered: list[str], max_distance: int = 1) -> list[NearMatch]:
    """Registered plates within `max_distance` edits of the reading, closest first.

    Common OCR confusions count as equal. An exact match has distance 0.
    """
    target = _canonical(reading)
    if not target:
        return []
    found = []
    for plate in registered:
        distance = Levenshtein.distance(target, _canonical(plate), score_cutoff=max_distance)
        if distance <= max_distance:
            found.append(NearMatch(plate=plate, distance=distance))
    return sorted(found, key=lambda m: (m.distance, m.plate))
