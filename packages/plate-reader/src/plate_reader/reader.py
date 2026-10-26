"""Classical plate detection and Tesseract OCR.

The detector is deliberately replaceable: a trained detector can implement the
same PlateDetector protocol without changing the server.
"""

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import cv2
import numpy as np
import pytesseract


def _configure_tesseract() -> None:
    """Find the standard Windows install when it is absent from server PATH."""
    if shutil.which("tesseract"):
        return
    candidate = Path("C:/Program Files/Tesseract-OCR/tesseract.exe")
    if candidate.is_file():
        pytesseract.pytesseract.tesseract_cmd = str(candidate)


_configure_tesseract()


@dataclass(frozen=True)
class PlateBox:
    x: int
    y: int
    width: int
    height: int
    confidence: float


@dataclass(frozen=True)
class PlateReading:
    text: str
    box: PlateBox


class PlateDetector(Protocol):
    def detect(self, image: np.ndarray) -> list[PlateBox]: ...


class ContourPlateDetector:
    """Find likely rectangular plate regions using edges and contours."""

    def detect(self, image: np.ndarray) -> list[PlateBox]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        smooth = cv2.bilateralFilter(gray, 11, 17, 17)
        edges = cv2.Canny(smooth, 40, 160)
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        image_area = image.shape[0] * image.shape[1]
        candidates: list[PlateBox] = []
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:50]:
            x, y, width, height = cv2.boundingRect(contour)
            area_ratio = (width * height) / image_area
            aspect = width / max(height, 1)
            # A fixed guardhouse camera can see a plate close to the lens, so
            # accept regions occupying up to 65% of the image. The earlier 15%
            # ceiling rejected clear, near-field plates such as the demo card.
            if not 1.8 <= aspect <= 6.5 or not 0.002 <= area_ratio <= 0.65:
                continue
            polygon = cv2.approxPolyDP(
                contour, 0.03 * cv2.arcLength(contour, True), True
            )
            rectangularity = min(cv2.contourArea(contour) / max(width * height, 1), 1.0)
            shape_score = 1.0 if 4 <= len(polygon) <= 6 else 0.65
            confidence = round(rectangularity * shape_score, 3)
            candidates.append(PlateBox(x, y, width, height, confidence))

        # Low-light frames often lose the plate's outer edges completely. Find
        # large bright, rotated rectangles as a fallback. Adding a little above
        # Otsu's threshold separates a reflective plate from the dark vehicle.
        otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]
        _, bright = cv2.threshold(gray, min(245, otsu + 15), 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (max(9, image.shape[1] // 50), max(5, image.shape[0] // 80)),
        )
        bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, kernel, iterations=2)
        bright_contours, _ = cv2.findContours(
            bright, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        for contour in sorted(bright_contours, key=cv2.contourArea, reverse=True)[:20]:
            (_, _), (rect_width, rect_height), _ = cv2.minAreaRect(contour)
            long_side = max(rect_width, rect_height)
            short_side = max(min(rect_width, rect_height), 1)
            aspect = long_side / short_side
            area_ratio = (rect_width * rect_height) / image_area
            if not 1.8 <= aspect <= 6.5 or not 0.002 <= area_ratio <= 0.65:
                continue
            x, y, width, height = cv2.boundingRect(contour)
            fill = min(cv2.contourArea(contour) / max(rect_width * rect_height, 1), 1.0)
            candidates.append(PlateBox(x, y, width, height, round(0.55 + 0.3 * fill, 3)))
        return sorted(candidates, key=lambda box: box.confidence, reverse=True)


def _order_corners(points: np.ndarray) -> np.ndarray:
    ordered = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    differences = np.diff(points, axis=1).ravel()
    ordered[0] = points[np.argmin(sums)]
    ordered[2] = points[np.argmax(sums)]
    ordered[1] = points[np.argmin(differences)]
    ordered[3] = points[np.argmax(differences)]
    return ordered


def _deskew_plate(gray: np.ndarray) -> np.ndarray:
    """Straighten a bright tilted plate inside a detector's axis-aligned crop."""
    otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]
    _, bright = cv2.threshold(gray, min(245, otsu + 10), 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (max(5, gray.shape[1] // 35), max(3, gray.shape[0] // 35)),
    )
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(bright, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    crop_area = gray.shape[0] * gray.shape[1]
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        rectangle = cv2.minAreaRect(contour)
        rect_width, rect_height = rectangle[1]
        long_side = max(rect_width, rect_height)
        short_side = max(min(rect_width, rect_height), 1)
        if not 1.8 <= long_side / short_side <= 6.5:
            continue
        if rect_width * rect_height < crop_area * 0.12:
            continue
        source = _order_corners(cv2.boxPoints(rectangle).astype(np.float32))
        output_width = max(int(long_side), 1)
        output_height = max(int(short_side), 1)
        target = np.array(
            [
                [0, 0],
                [output_width - 1, 0],
                [output_width - 1, output_height - 1],
                [0, output_height - 1],
            ],
            dtype=np.float32,
        )
        straight = cv2.warpPerspective(
            gray,
            cv2.getPerspectiveTransform(source, target),
            (output_width, output_height),
        )
        return straight
    return gray


def clean_plate(crop: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    gray = _deskew_plate(gray)
    scale = max(2.0, 500 / max(gray.shape[1], 1))
    enlarged = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    equalized = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(enlarged)
    blurred = cv2.GaussianBlur(equalized, (0, 0), 1.2)
    sharpened = cv2.addWeighted(equalized, 1.8, blurred, -0.8, 0)
    return cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]


def image_brightness(jpeg: bytes) -> float:
    """Useful-subject brightness from 0 (black) to 255 (white).

    Ignore the outer frame, which commonly contains a dark wall or night sky,
    and use the 70th percentile so a correctly lit plate can keep the flash off
    even when much of the vehicle and background are dark.
    """
    image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("The camera response is not a valid JPEG")
    height, width = image.shape
    subject = image[
        int(height * 0.20) : int(height * 0.85),
        int(width * 0.15) : int(width * 0.85),
    ]
    return float(np.percentile(subject, 70))


def read_plate(
    jpeg: bytes, detector: PlateDetector | None = None
) -> PlateReading | None:
    image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The camera response is not a valid JPEG")
    boxes = (detector or ContourPlateDetector()).detect(image)
    for box in boxes[:5]:
        crop = image[box.y : box.y + box.height, box.x : box.x + box.width]
        cleaned = clean_plate(crop)
        # A perspective-corrected plate is sometimes classified by Tesseract
        # as one word rather than one text line. Try the strict line mode first,
        # then the single-word modes that work better for tilted demo plates.
        for page_mode in (7, 8, 13):
            text = pytesseract.image_to_string(
                cleaned,
                config=(
                    f"--oem 3 --psm {page_mode} "
                    "-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                ),
            )
            text = "".join(character for character in text.upper() if character.isalnum())
            if 4 <= len(text) <= 10:
                return PlateReading(text=text, box=box)
    return None
