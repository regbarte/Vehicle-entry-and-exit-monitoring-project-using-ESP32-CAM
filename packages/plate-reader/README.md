# Plate reader

Python library used by `apps/server`.

1. A trained model finds the plate anywhere in the photo.
2. Tesseract reads the cropped plate.
3. The text is normalized: uppercase, spaces and dashes removed.
4. Near matches are registered plates that differ by one character.

Training scripts go in `training/`. Datasets and model runs stay out of git.

Not written yet.
