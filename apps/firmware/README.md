# Firmware

MicroPython for the ESP32-CAM (AI-Thinker board on the HW-381 ESP32-CAM-MB programmer).

Stock MicroPython has no camera module. Flash the build from `lemariva/micropython-camera-driver` first.

The board joins the laptop's hotspot and sends JPEG photos to `apps/server`. Wi-Fi credentials go in `secrets.py`, which git ignores.

Not written yet.
