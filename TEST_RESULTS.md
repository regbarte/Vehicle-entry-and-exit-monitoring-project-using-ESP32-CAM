# GatePass — ESP32-CAM guardhouse prototype

## What this package does

A guard clicks Scan. The ESP32-CAM sends a still photo over local Wi-Fi. Tesseract on the computer reads the central plate region. The guard corrects the text and checks the registry. An active pass allows guard-approved entry; otherwise a visitor form requires driver name, computer-webcam ID photo, purpose and a registered destination. The guard approves entry directly. **No resident confirmation, resident message or resident approval is involved.** The guard records exit manually with one click; the computer supplies the timestamp.

This version is a working software prototype for one guardhouse computer and one stopped vehicle at a time. It is not an unattended moving-vehicle recognition system. There is no automatic barrier, vehicle sensor, automatic exit camera, facial recognition or ID OCR. An unknown plate produces a visible alert; no siren or external notification is sent.

## 1. Prepare the equipment

- Windows 10/11 computer, webcam, Arduino IDE 2, Python 3.11 or 3.12 (64-bit).
- ESP32-CAM with OV2640 camera and **verified AI Thinker-compatible camera GPIO mapping**.
- Stable power supply appropriate for your exact board; a USB data cable for boards with an integrated USB programmer.
- A local 2.4 GHz Wi-Fi router; PC on the same local network. Internet is needed for installation, not routine operation.
- Fixed mount and steady lighting. Position the camera so a stopped vehicle's plate fills the green guide.

**Board compatibility matters:** USB Type-C, CH340, or an ESP32 label alone does not identify camera wiring. If your board is labeled “ESP32 CAM LCD” or uses a different module, obtain its camera pinout and change the `c.pin_*` assignments before uploading. This sketch assumes an original ESP32 with the AI Thinker camera mapping, not an ESP32-S3. Do not guess power connections. The package cannot identify your physical board remotely.

## 2. Extract the files

Right-click the ZIP → Extract All. Move the included `gatepass` folder to `C:\GatePass` so `C:\GatePass\app.py` exists. Do not run files from inside the ZIP.

Files:

- `app.py`: dashboard, OCR, registry and entry/exit database.
- `configure.py`: creates your local password and camera settings.
- `firmware\GateCamera\GateCamera.ino`: embedded camera software.
- `templates\`, `static\`: dashboard pages and webcam capture.
- `test_app.py`: automated backend tests.
- `requirements.txt`: computer dependencies.

## 3. Install Python and computer dependencies

Install Python from https://www.python.org/downloads/windows/ and enable **Add Python to PATH**. Open **Command Prompt** (the commands below are for CMD, not PowerShell):

```bat
cd /d C:\GatePass
py -3 --version
py -3 -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

If `py` is not recognized, reopen Command Prompt after installing Python, or use `python` instead of `py -3` for the first two Python commands.

## 4. Install Tesseract OCR

Use the Windows installer link in the official Tesseract documentation:
https://tesseract-ocr.github.io/tessdoc/Installation.html

The documentation points Windows users to the UB Mannheim installers. Include English recognition data. The usual installation path is:

```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

Verify in Command Prompt:

```bat
"C:\Program Files\Tesseract-OCR\tesseract.exe" --version
```

If installed elsewhere, use that actual path during configuration. Installing `pytesseract` alone does not install the Tesseract recognition engine.

## 5. Configure the dashboard

With the virtual environment active:

```bat
python configure.py
```

1. Choose a password with at least 12 characters. Password typing is hidden in the terminal; this is normal.
2. Enter a provisional camera URL, such as `http://192.168.1.50`. You will update it after reading the actual IP.
3. Enter the Tesseract executable path, or press Enter to accept the default.
4. Open the new `config.json` in Notepad.
5. Copy only the `camera_key` value, without the surrounding quotation marks.

The generated key is a shared secret between the PC and camera; it is not an access token you must obtain from a website. Keep `config.json` private. Do not commit it to Git or include it when sharing code. The password is hashed, but the camera key is stored locally.

## 6. Install ESP32 support in Arduino IDE

Official instructions: https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html

1. Open Arduino IDE → File → Preferences.
2. Add this under Additional Boards Manager URLs:

```text
https://espressif.github.io/arduino-esp32/package_esp32_index.json
```

3. Open Boards Manager, search **esp32**, and install **esp32 by Espressif Systems**, version 3.x.
4. Open `firmware\GateCamera\GateCamera.ino`.
5. For a verified AI Thinker-compatible module, select **Tools → Board → ESP32 Arduino → AI Thinker ESP32-CAM**.
6. Select the COM port that appears when your board is connected.
7. If exposed by your board settings, enable PSRAM. The sketch falls back to VGA if PSRAM is absent.

The Wi-Fi, WebServer and camera headers come with the Espressif board package; do not install unrelated libraries with similar names.

## 7. Edit and upload the embedded firmware

Change only these three strings initially:

```cpp
const char* WIFI_SSID = "YOUR_2_4_GHZ_WIFI";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* CAMERA_KEY = "PASTE_camera_key_FROM_config.json";
```

Use the exact key generated in Step 5. If your credentials contain a quotation mark or backslash, escape it correctly in the C++ string.

Click Verify, then Upload. Use a USB data cable, not a charging-only cable. For boards with onboard USB/auto-reset, try normal upload first. If the board requires manual boot mode, follow its vendor instructions; commonly hold BOOT while upload starts, then release. Bare AI Thinker modules often need an external programmer and GPIO0-to-GND during flashing. Disconnect that boot connection before normal running and reset. Do not add wiring to a USB-equipped board unless its documentation calls for it.

Open Serial Monitor at **115200 baud** and press Reset. Look for:

```text
Camera URL: http://192.168.1.50
```

Use the IP actually printed by your board. In a PC browser, opening that URL should show `GatePass camera ready`. Directly opening `/capture` gives Unauthorized because it requires the app's camera key—this is expected.

## 8. Enter the real camera URL

Close the PC application if running. Edit `config.json`:

```json
"camera_url": "http://192.168.1.50"
```

Replace the example IP with the Serial Monitor result. Keep valid JSON syntax. Do not include `/capture` in this setting. A router DHCP reservation helps keep the camera IP stable after restarts.

The PC requests images from the camera, so you do not need to expose the PC dashboard to the network or open an inbound Windows firewall port. Avoid guest Wi-Fi/client isolation, which can prevent the PC from reaching the camera.

## 9. Start the dashboard

```bat
cd /d C:\GatePass
.venv\Scripts\activate
python app.py
```

Keep the terminal open. In Chrome or Edge on **that same computer**, open:

http://localhost:5000

Sign in with the password from Step 5. Use `localhost`, not the computer's LAN IP: the app intentionally listens only on the computer, and localhost supports browser webcam permission. Ctrl+C stops the server.

## 10. Register destinations and car passes

1. Open **Registry**.
2. Add a fictional resident, e.g. `Sample Resident`, address `Block 1 Lot 2`.
3. Re-enter the supervisor password to save.
4. Add a test plate, e.g. `ABC1234`, linked to the resident.
5. Choose a future valid-through date and leave Active checked.

The expiry date is inclusive in Philippine time. Reusing the same plate in this form updates its pass. To revoke it, submit it with Active unchecked. Residents can be destinations without having a car pass.

This prototype uses one password for dashboard access and registry re-authentication, plus typed guard names in logs. It does not provide separate administrator/guard accounts or independently verified staff identities.

## 11. Test a car-pass entry

1. Stop the test vehicle and aim the camera at the plate.
2. Click **Scan ESP32-CAM plate**.
3. Inspect the photo; the green rectangle shows the OCR region.
4. Correct the recognized characters if needed (especially O/0, I/1, B/8).
5. Click **Check this plate**.
6. Confirm the active pass details.
7. Enter the guard's name, tick the verification checkbox and click **Allow entry & record time**.

The vehicle appears under Vehicles inside. The timestamp is recorded at approval, not at camera capture. The same plate cannot be admitted again while it is still marked Inside.

## 12. Test an unregistered visitor

1. Scan or manually enter a different plate, then click Check this plate.
2. The visible alert requires visitor registration. Expired/inactive passes also take this path.
3. Enter the driver name and purpose.
4. Select the resident/address being visited. **No confirmation is requested from the resident.**
5. Click **Start webcam** and allow the browser's camera permission.
6. Hold a **fictional test ID** in front of the PC webcam.
7. Click **Capture / retake ID**, inspect the still image and retake if necessary.
8. Enter guard name, verify the plate and click Allow entry & record time.

A visitor cannot be saved without a valid ID image, purpose and registered destination. The ID is photographed only; its fields are not extracted automatically. If a legitimate destination is missing, cancel and have the registry updated before trying again.

## 13. Record time out

1. Under Vehicles inside, find the departing plate using Search.
2. Confirm that it is the vehicle actually leaving.
3. Type the exit guard's name and click **Record exit now**.
4. Confirm the prompt. The computer saves current Philippine time and moves the record to recent completed visits.

The guard triggers the exit manually; they do not need to type a time. A repeated exit click will not overwrite the first exit time. Missed departures remain Inside until the guard records them; this prototype has no automatic departure detection or historical-time correction screen.

## 14. Test without the ESP32-CAM

Use **Manual plate entry** to exercise pass lookup, visitor registration, ID capture and exit. Alternatively upload a JPEG/PNG plate photograph to test OCR. Camera hardware is not required for these software checks.

Run the backend tests with:

```bat
python -m unittest -v test_app.py
```

## Troubleshooting

| Symptom | Action |
|---|---|
| No serial data received during upload | Check COM port/data cable, close Serial Monitor during upload, and follow your board's boot-mode procedure. |
| Camera initialization failed | Verify the exact camera pinout, camera ribbon seating and power supply; a USB connector does not prove pin compatibility. |
| Wi-Fi keeps retrying | Confirm 2.4 GHz SSID/password and signal; avoid isolated guest networks. |
| Capture failed | Open camera root URL from PC, verify camera_key on both ends, check IP/power and restart the camera. |
| OCR empty or wrong | Put the plate inside the green guide, reduce glare, improve focus/lighting, and keep the car stopped. Manually correct before approval. |
| Tesseract unavailable | Verify the executable path and English data, then restart the app. Manual plate entry remains available. |
| Webcam unavailable | Use localhost, allow camera access in browser/Windows, close Zoom or other camera apps, and choose the correct browser camera device. |
| Expired form error | Refresh, sign in again if needed, and retry. |
| Already recorded | Check Vehicles inside and exit the earlier visit only if that vehicle has actually left. |
| Can't open localhost:5000 | Keep the app terminal open; check its error output. Another app may already use port 5000. |

## Data, privacy and boundaries

- All data stays in `data\gate.db` on the PC; images are stored inside the database, outside the public static folder. Back up the whole database with the app stopped.
- Records survive app restarts. Secure the computer account, restrict folder access and use disk encryption before any real personal data is stored.
- This academic version has no scheduled deletion, per-user roles, login throttling, encrypted database, tamper-resistant audit log or disaster recovery service. Use fictional IDs until those operational controls and an appropriate retention policy are implemented.
- Camera HTTP traffic is not encrypted; the camera key restricts requests but does not provide confidentiality. Use a dedicated trusted local network for the prototype. Do not port-forward the camera or PC to the internet.
- Plate matching is exact after removing spaces/punctuation and uppercasing. It does not silently replace similar characters or assume a previous visitor is a pass holder.
- OCR is fixed-region Tesseract, not a trained automatic plate detector. It cannot promise accuracy across motion, darkness, reflective plates, angle changes or all Philippine plate formats. Record observed accuracy in a representative supervised trial.
- No resident messages, automatic resident confirmation, gate actuator or cloud service is included.
- PC timestamps use UTC+08:00; keep Windows date/time correct. There is no independent camera clock authority.

## Verification supplied with this package

The included backend tests cover active-pass entry, duplicate protection, visitor ID requirement, expired/inactive passes, missing destinations, camera errors, authentication/CSRF, protected images, rendering and manual exit. See TEST_RESULTS.md for the actual execution result. Physical ESP32 upload, real webcam access and real-world OCR accuracy must be checked on your equipment.

## Official references

- Espressif installation: https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html
- Camera driver: https://github.com/espressif/esp32-camera
- Official camera example/pin configurations: https://github.com/espressif/arduino-esp32/tree/master/libraries/ESP32/examples/Camera/CameraWebServer
- Tesseract installation: https://tesseract-ocr.github.io/tessdoc/Installation.html
