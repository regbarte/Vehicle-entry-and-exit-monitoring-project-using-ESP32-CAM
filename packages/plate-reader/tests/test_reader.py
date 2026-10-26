import cv2
import numpy as np
from plate_reader import (
    ContourPlateDetector,
    PlateBox,
    clean_plate,
    image_brightness,
    read_plate,
)


class FixedDetector:
    def detect(self, image):
        return [PlateBox(20, 20, 260, 70, 0.93)]


def test_cleanup_enlarges_and_grayscales():
    crop = np.full((40, 140, 3), 255, dtype=np.uint8)
    cleaned = clean_plate(crop)
    assert cleaned.ndim == 2
    assert cleaned.shape[1] >= 500


def test_invalid_jpeg_is_rejected():
    try:
        read_plate(b"not a jpeg")
    except ValueError as error:
        assert "valid JPEG" in str(error)
    else:
        raise AssertionError("invalid JPEG should fail")


def test_brightness_reads_a_uniform_frame():
    image = np.full((20, 30, 3), 12, dtype=np.uint8)
    ok, jpeg = cv2.imencode(".jpg", image)
    assert ok
    assert 10 <= image_brightness(jpeg.tobytes()) <= 14


def test_brightness_ignores_dark_outer_background():
    image = np.zeros((200, 300, 3), dtype=np.uint8)
    cv2.rectangle(image, (70, 65), (230, 145), (120, 120, 120), -1)
    ok, jpeg = cv2.imencode(".jpg", image)
    assert ok
    assert image_brightness(jpeg.tobytes()) >= 100


def test_detector_accepts_a_plate_that_fills_much_of_the_frame():
    image = np.zeros((240, 320, 3), dtype=np.uint8)
    cv2.rectangle(image, (15, 45), (285, 145), (255, 255, 255), 4)
    boxes = ContourPlateDetector().detect(image)
    assert any((box.width * box.height) / (320 * 240) > 0.15 for box in boxes)


def test_detector_finds_a_dim_tilted_plate():
    image = np.full((400, 600, 3), 5, dtype=np.uint8)
    plate = cv2.boxPoints(((360, 245), (300, 95), -16)).astype(np.int32)
    cv2.fillConvexPoly(image, plate, (70, 70, 70))
    boxes = ContourPlateDetector().detect(image)
    assert any(box.width > 250 and box.height > 100 for box in boxes)


def test_reader_tries_single_word_mode_when_line_mode_is_empty(monkeypatch):
    image = np.full((110, 300, 3), 220, dtype=np.uint8)
    ok, jpeg = cv2.imencode(".jpg", image)
    assert ok
    modes = []

    def fake_tesseract(_image, config):
        modes.append(config)
        return "NBC 1234" if "--psm 8" in config else ""

    monkeypatch.setattr("plate_reader.reader.pytesseract.image_to_string", fake_tesseract)
    reading = read_plate(jpeg.tobytes(), FixedDetector())
    assert reading is not None
    assert reading.text == "NBC1234"
    assert any("--psm 7" in config for config in modes)
    assert any("--psm 8" in config for config in modes)
