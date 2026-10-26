# ESP32-CAM firmware

Arduino IDE firmware for the AI-Thinker ESP32-CAM. Open
`arduino/guardhouse_camera/guardhouse_camera.ino` in Arduino IDE.

The sketch implements the server's camera contract:

- `GET /capture`: UXGA 1600×1200 JPEG
- `GET /preview`: VGA 640×480 JPEG
- `GET /status`: JSON with `uptimeSeconds` and `signalDbm`
- `GET /flash/on` and `GET /flash/off`: server-controlled reduced-power light

## Arduino IDE setup

1. Install Arduino IDE 2.x.
2. Add `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
   under **File > Preferences > Additional Boards Manager URLs**.
3. Install **esp32 by Espressif Systems** in Boards Manager.
4. Copy `wifi_secrets.example.h` to `wifi_secrets.h` in the sketch folder and
   enter the laptop hotspot or router's 2.4 GHz Wi-Fi credentials.
5. Select **AI Thinker ESP32-CAM**, the correct COM port, 115200 upload speed,
   and PSRAM enabled if Arduino IDE shows that option.
6. Upload, open Serial Monitor at 115200, and reset the board. Save the printed
   `http://IP-ADDRESS` as the subdivision's camera address in the provider
   screen.

Use stable 5 V power. The laptop turns on the reduced-power onboard light only
for dark captures, then turns it off to limit heat and glare. Mount the camera
nearly square to the plate and focus it at the vehicle stopping line.
