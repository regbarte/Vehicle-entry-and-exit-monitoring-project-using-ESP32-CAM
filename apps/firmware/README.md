# Firmware

The prototype uses two boards. Each has its own Arduino IDE sketch.

| Board | Sketch | Job | Connects to the laptop by |
|---|---|---|---|
| AI-Thinker ESP32-CAM | `arduino/guardhouse_camera/` | Gate camera: photographs arriving cars | Wi-Fi (the guardhouse hotspot) |
| Arduino Uno (or Nano) | `arduino/gate_barrier/` | Boom barrier: a push button and a servo | USB cable (serial) |

The server talks to the camera over HTTP and to the barrier over the USB serial port. The browser never talks to either board directly.

## What you need

- Arduino IDE 2.x
- ESP32-CAM with a USB programmer (an ESP32-CAM-MB board or a USB-to-serial adapter)
- Arduino Uno or Nano, with its USB cable
- Push button and a servo (SG90 or similar)
- Jumper wires. The button and servo can plug straight into the Arduino's pins, so a breadboard is optional.
- A stable 5 V supply for the ESP32-CAM

## 1. Set up Arduino IDE

1. Install Arduino IDE 2.x.
2. Under **File > Preferences > Additional Boards Manager URLs**, add
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
3. In **Boards Manager**, install **esp32 by Espressif Systems**. The Uno and Nano boards and the `Servo` library come with the IDE.

## 2. Gate camera (ESP32-CAM)

The sketch implements the server's camera contract:

- `GET /capture`: UXGA 1600×1200 JPEG
- `GET /preview`: VGA 640×480 JPEG
- `GET /status`: JSON with `uptimeSeconds` and `signalDbm`
- `GET /flash/on` and `GET /flash/off`: server-controlled reduced-power light

To set it up:

1. Copy `wifi_secrets.example.h` to `wifi_secrets.h` in the sketch folder, and enter the 2.4 GHz Wi-Fi name and password of the laptop hotspot or router. The ESP32 can't join 5 GHz networks. Git ignores `wifi_secrets.h`.
2. Select **AI Thinker ESP32-CAM**, the programmer's port, 115200 upload speed, and PSRAM enabled if Arduino IDE shows that option.
3. Upload. With a plain USB-to-serial adapter, connect GPIO0 to GND while uploading, then remove that wire and press reset. The ESP32-CAM-MB board does this for you.
4. Open the Serial Monitor at 115200 baud and press reset. The board prints `Gate camera address: http://IP-ADDRESS`.
5. Check that the laptop can reach the camera:
   ```bash
   curl http://IP-ADDRESS/status
   ```
   You should get JSON with `uptimeSeconds` and `signalDbm`. If the request times out, the laptop and the camera are on different networks.
6. In the dashboard, open the provider screen and set the subdivision's **Camera address** to `http://IP-ADDRESS`.
7. Set `mock_camera = false` in `apps/server/config.toml`.

After the upload, the camera only needs USB for power. The server reaches it over Wi-Fi, so the ESP32-CAM's serial port doesn't need to be free.

Use stable 5 V power. The laptop turns on the reduced-power onboard light only for dark captures, then turns it off to limit heat and glare. Mount the camera nearly square to the plate and focus it at the vehicle stopping line.

## 3. Boom barrier (Arduino)

### Wiring

| Part | Wire | Arduino pin |
|---|---|---|
| Push button | one leg | 2 |
| Push button | the diagonally opposite leg | GND |
| Servo | brown or black | GND |
| Servo | red | 5V |
| Servo | orange or yellow (signal) | 8 |

The sketch uses the Arduino's internal pull-up resistor, so the button needs no resistor. Pin 2 reads `HIGH` when released and `LOW` when pressed. On a four-leg button, use diagonal legs: legs on the same side may already be connected, and the button then reads as always pressed.

An SG90 can run from the Arduino's 5V pin. A larger servo, such as an MG996R, needs its own 5 V supply, with that supply's GND connected to the Arduino's GND. Otherwise the Arduino resets when the servo moves.

### Serial commands

The sketch listens at 9600 baud. Every command ends with a newline.

| The server sends | The Arduino does | The Arduino answers |
|---|---|---|
| `OPEN` | Raises the barrier, unless it is already open | `STATE:OPEN` |
| `CLOSE` | Lowers the barrier, unless it is already closed | `STATE:CLOSED` |
| `STATUS` | Nothing | The current state |
| (the button is pressed) | Toggles the barrier | The new state |

The Arduino answers every command, even when the barrier doesn't move, so the server always knows the real state. The button toggles because the person pressing it can see the barrier. The server sends `OPEN` or `CLOSE` because it can't.

### Upload and test

1. Stop `bun dev` if it's running. Uploading needs the serial port.
2. Open `arduino/gate_barrier/gate_barrier.ino`. Select your board under **Tools > Board** and its port under **Tools > Port**.
3. Upload.
4. Open the Serial Monitor at **9600** baud, and set the line ending to **Newline**.
5. Check each row:

   | Do this | Expect |
   |---|---|
   | Press the button | The barrier opens; the monitor prints `STATE:OPEN` |
   | Press it again | The barrier closes; the monitor prints `STATE:CLOSED` |
   | Send `OPEN` | The barrier opens; the monitor prints `STATE:OPEN` |
   | Send `OPEN` again | No movement; the monitor prints `STATE:OPEN` |
   | Send `STATUS` | The monitor prints the current state |

6. **Quit Arduino IDE** with Cmd+Q (macOS) or File > Quit. Closing the Serial Monitor window isn't enough: the IDE can keep the port open in the background.

## 4. Point the server at both boards

### Find the Arduino's port

With the Arduino plugged in, run:

```bash
ls /dev/cu.usb*
```

A genuine Uno shows up as `/dev/cu.usbmodem…`. Clones with a CH340 chip show up as `/dev/cu.usbserial-…` or `/dev/cu.wchusbserial…`. If the ESP32-CAM's programmer is plugged in too, unplug the Arduino and run the command again: the line that disappears is the Arduino's port.

On macOS, the port name depends on which USB socket you use. Always plug the Arduino into the same socket so the name doesn't change.

On Windows, the port is a COM port such as `COM3`. Find it in **Device Manager > Ports (COM & LPT)**.

### Set the barrier in `.env`

Add these lines to `apps/server/.env`, next to `MONGO_URI`:

```
BARRIER_PORT=/dev/cu.usbmodem11101
BARRIER_SUBDIVISION_ID=6720f1a2b3c4d5e6f7a8b9c0
```

- `BARRIER_PORT` is the port you found. Leave it out to use a fake barrier, which lets you work on the dashboard without hardware.
- `BARRIER_SUBDIVISION_ID` is the subdivision whose gate has the barrier. To find it, open the guard's Gate screen and copy the id from the address bar: `/guard/<id>/gate`.

Keep `barrier_port = ""` and `barrier_subdivision_id = ""` in `config.toml`. That file is committed, and port names differ between laptops. Values in `.env` take priority over `config.toml`.

## 5. Start and stop the prototype

Follow this order every time:

1. **Upload any sketch changes first**, while `bun dev` is stopped.
2. **Quit Arduino IDE.**
3. **Plug in both boards.** The Arduino goes into the laptop's USB port; the ESP32-CAM goes into 5 V power and joins the hotspot.
4. **Start the server and dashboard** from the repo root:
   ```bash
   bun dev
   ```
5. **Wait for the server pane** to show `Application startup complete`. Until then, the dashboard shows `Request failed (502)` and the dashboard pane logs `http proxy error ... ECONNREFUSED`. That's normal for the first few seconds while the server connects to MongoDB Atlas.
6. **Open the dashboard**, pick Guard and the subdivision, and check that the Gate screen shows **Barrier: Closed** and a live camera view.
7. **Stop everything** with Ctrl+C in the `bun dev` terminal. This also releases the Arduino's port.

Restart `bun dev` after you change `.env`. The server reloads on its own when a Python file changes, but not when `.env` changes. Each reload reopens the serial port, which resets the Arduino; the barrier shows **Not connected** for about 2 seconds, then recovers.

## 6. Check the connections

Run these while `bun dev` is running.

### Who holds the Arduino's port

```bash
lsof /dev/cu.usbmodem*
```

Replace `usbmodem*` with `usbserial*` for a clone board.

| Output | Meaning | What to do |
|---|---|---|
| One line, `python3…` | The server holds the port. This is correct. | Nothing |
| `python3…` **and** `serial-mo…` | Arduino IDE's Serial Monitor is reading too, and steals some `STATE:` lines | Quit Arduino IDE |
| Only `serial-mo…` | The IDE has the port, so the server can't use it | Quit Arduino IDE; the server retries every 3 seconds |
| Nothing | The server isn't connected | Check that `bun dev` is running and that `BARRIER_PORT` matches `ls /dev/cu.usb*` |

After you stop `bun dev`, the same command should print nothing. If a `python3` line remains, an old server is still running: stop it with `kill <PID>`, using the number from the `PID` column.

On Windows there is no `lsof`. Windows lets only one program open a COM port at a time, so a busy port fails at once with "Access is denied" in the server pane.

### Whether the server is running

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

You should see two `python3` lines: the file watcher and the server itself. Nothing means the server isn't running; check the server pane for errors.

### What the server knows about the barrier

```bash
curl http://localhost:8000/api/subdivisions/<id>/barrier
```

| Answer | Meaning |
|---|---|
| `{"state":"closed"}` or `{"state":"open"}` | Working |
| `{"state":"unknown"}` | The server can't read the Arduino: see the `lsof` check |
| `{"detail":"This subdivision has no barrier"}` | `BARRIER_SUBDIVISION_ID` doesn't match this subdivision's id |

### Whether the camera answers

```bash
curl http://IP-ADDRESS/status
```

JSON means the camera is up. A timeout means the camera isn't on the same network as the laptop, or its address changed. Check its Serial Monitor for the current address.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Server pane repeats `The barrier on … is not answering; retrying` | The port is busy, unplugged, or misnamed | Run the `lsof` check, then `ls /dev/cu.usb*` |
| Gate screen shows **Barrier: Not connected** | Same as above, or the server restarted in the last 2 seconds | Same as above |
| `GET …/barrier` returns 404 in the server pane | Wrong `BARRIER_SUBDIVISION_ID` | Copy the id from the Gate screen's address bar, then restart `bun dev` |
| Pressing the button does nothing | The button uses legs on the same side, or isn't wired to pin 2 and GND | Use diagonal legs; check that the Serial Monitor prints `STATE:` lines |
| One press toggles twice | Contact bounce | Increase `DEBOUNCE_MS` in the sketch |
| Arduino resets when the servo moves | The servo draws too much current through USB | Give the servo its own 5 V supply, sharing GND with the Arduino |
| Upload fails with "port busy" | `bun dev` or the Serial Monitor holds the port | Stop `bun dev`, close the Serial Monitor, upload again |
| Serial Monitor shows gibberish | Wrong baud rate | 9600 for the barrier, 115200 for the camera |
| Commands typed in the Serial Monitor do nothing | Line ending isn't Newline | Set the dropdown next to the input box to **Newline** |
| Camera prints `ERROR: Wi-Fi connection timed out` | Wrong Wi-Fi details, or a 5 GHz network | Fix `wifi_secrets.h` and use a 2.4 GHz network |
