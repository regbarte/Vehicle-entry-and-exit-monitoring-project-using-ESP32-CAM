"""Plate text helpers shared by the server.

Finding and reading the plate in a photo (OpenCV and Tesseract) is not written yet.
"""

from plate_reader.plates import NearMatch, near_matches, normalize

__all__ = ["NearMatch", "near_matches", "normalize"]
