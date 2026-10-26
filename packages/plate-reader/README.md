# Plate reader

Python library used by `apps/server`.

1. The current OpenCV contour detector finds likely plate boxes. It implements
   `PlateDetector`, so a trained model can replace it later.
2. Tesseract reads the cropped plate.
3. The text is normalized: uppercase, spaces and dashes removed.
4. Near matches are registered plates that differ by one character.

Training scripts go in `training/`. Datasets and model runs stay out of git.

Install the native Tesseract program separately; `pytesseract` is only its
Python adapter. On Windows, install Tesseract OCR, ensure `tesseract.exe` is on
`PATH`, and check with `tesseract --version`.

For best results, collect fictional labelled examples from the final camera
position. Classical contours are a prototype baseline, not a promise of robust
Philippine plate detection in every angle or lighting condition.
