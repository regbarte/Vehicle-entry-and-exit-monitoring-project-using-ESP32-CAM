# Architecture

## Overview

Everything runs on one guardhouse laptop, offline. The ESP32-CAM joins the laptop's hotspot. The server pulls photos from the camera, reads plates, and pushes updates to the dashboard in the guard's browser.

```text
ESP32-CAM <--(HTTP GET over the hotspot)-- FastAPI server <--> MongoDB
                                                  ^
                                                  |  SSE down, REST up
                                                  v
Laptop webcam --------------------------> Dashboard (laptop browser)
```

## Repo and tooling

- Bun workspaces and Turborepo run the JavaScript tasks. `bun dev` at the root opens the Turborepo TUI, with one pane for the server and one for the dashboard.
- Python packages form a uv workspace. Each Python package also has a small `package.json` whose scripts call `uv run`, so Turborepo can run them.
- The firmware has a `package.json` with one script, `deploy`. It uses mpremote to copy files to the board. The firmware has no dev pane.
- MongoDB is already installed and running on each development device. Turborepo does not start it.
- Python tools: ruff (lint and format), pyright (types), pytest.
- JavaScript tools: Biome (lint and format), Vitest.
- There is no CI yet.
- The plate accuracy script in `packages/plate-reader` scores the reader against a folder of sample photos with known plates. It runs on demand.

## Firmware

`apps/firmware` runs MicroPython with the lemariva camera build. The `microdot` web library is vendored in `apps/firmware/lib`.

- `GET /capture` returns a high resolution still. The default is UXGA 1600x1200 at JPEG quality about 10. The plate reader uses it.
- `GET /preview` returns a small frame, QVGA or VGA. The live view uses it.
- `GET /status` returns uptime and Wi-Fi signal.
- The flash LED stays off.
- The camera answers at the hostname `guardcam.local` (mDNS). `CAMERA_URL` in `.env` overrides it.
- Wi-Fi credentials live in `apps/firmware/secrets.py`. Git ignores that file.

## Server

`apps/server` runs FastAPI on Python 3.12.

- A Scan calls `/capture` once. Continuous mode calls it about once a second, from a server timer. Continuous mode is a later feature.
- Photo resolution is a `config.toml` value. Continuous mode may need SVGA to keep up.
- Plate reading runs in a thread pool (`run_in_threadpool`), so it does not block the event loop.
- Live updates reach the dashboard over Server-Sent Events at `GET /api/events`. An in-memory event hub sends them. The event types are `detection`, `entry`, and `camera`.
- Actions such as confirm and Return ID are plain POST requests.
- The event hub, the waiting list and the repeat window live in memory, so the server runs as a single worker process. A restart clears them. Only confirmed entries are saved.
- The repeat window lasts 30 seconds and is set in `config.toml`. In continuous mode only, it ignores the same normalized plate when the camera sees it again. A manual Scan always creates a detection.
- The server polls the camera's `/status` every 5 seconds and pushes a `camera` event. Two misses in a row mark the camera offline.
- MongoDB access uses PyMongo's async client (`AsyncMongoClient`). Pydantic models describe the data. The same models produce the OpenAPI schema.
- `config.toml` is committed. It holds the tunables: repeat window, continuous mode interval, photo resolution, and near match distance.
- `.env` holds `CAMERA_URL` and `MONGO_URI`. Both files load through `pydantic-settings`.
- Photos (car frames and ID photos) are files under `apps/server/data/`, which git ignores. MongoDB stores only their paths.
- In the prototype, the team deletes old photos by hand. The real product needs a sweeper. It deletes ID photos and car frames 30 days after the entry's exit, or 30 days after entry for registered vehicles. This follows the Data Privacy Act (RA 10173).
- Times are stored in UTC and shown in Asia/Manila time.

## Plate reader

`packages/plate-reader` is a Python package.

- Finding the plate region in a photo sits behind a `PlateDetector` interface. The first version uses classical OpenCV (edges and contours).
- A trained model replaces it later, with no changes elsewhere. The plan has two steps. A pretrained plate detector comes first. Then a YOLO nano model, fine tuned on Philippine plates, is exported to ONNX and run with onnxruntime.
- Tesseract (pytesseract) reads the cropped plate. It is limited to letters and digits.
- Near match: the package normalizes the plate (uppercase, letters and digits only). It treats common OCR confusions as equal (0 and O, 1 and I, 8 and B, 5 and S). Then it accepts registered plates within edit distance 1, using `rapidfuzz`.

## Data

MongoDB holds two collections, `houses` and `entries`. Their shape looks like this:

```text
houses:  { block, lot, street, ownerName, contact,
           vehicle?: { plate (normalized, unique), plateDisplay } }
entries: { at, plate, plateRaw, verdict: "registered" | "visitor", houseId?,
           frame: path | null,
           visitor?: { purpose: "delivery" | "guest" | "service" | "other",
                       destination: { kind: "block", block }
                                  | { kind: "residence", houseId, label },
                       idPhoto: path | null, exitAt: time | null } }
```

- The registry is the `houses` collection. It lists every house, with or without a car. A house with no car can still be a visitor's destination.
- `plate` in an entry is the confirmed plate. `plateRaw` keeps the plate reading the system made.
- A destination is either a block (for example "Block 19") or a residence picked from the registry. A residence is stored as the house id plus a label, such as "Dela Cruz Residence".
- Delivery suggests a block. Guest suggests a residence.
- `exitAt` stays empty until the guard returns the Held ID.
- The registry seed file format is not decided yet.

## API

```text
POST /api/scan                      -> Detection (also pushed over SSE)
GET  /api/waiting                   -> Detection[]
POST /api/detections/{id}/confirm   {plate} -> registered: entry saved, house details returned
                                              not registered: {verdict: "visitor"}, nothing saved yet
POST /api/entries/visitor           multipart: detectionId, plate, purpose, destination, idPhoto
POST /api/entries/{id}/return-id
GET  /api/entries?plate=&date=&verdict=
GET  /api/entries/inside
GET  /api/houses?q=
GET  /api/camera/preview            (server proxies the camera's /preview)
GET  /api/events                    (SSE)
GET  /files/...                     (photos)
```

TypeScript types come from the OpenAPI schema. The Turborepo task `gen:types` dumps `openapi.json` from the server and runs `openapi-typescript` into `packages/api-types`. The dashboard's `dev` and `build` tasks depend on `gen:types`. The generated file is committed.

## Dashboard

`apps/dashboard` is a Vite app built with React and TypeScript.

- It uses React Router for screens and TanStack Query for data.
- Tailwind v4 reads the palette as theme tokens: Shadow Grey #3A2E39, Dark Teal #1E555C, Almond Silk #F4D8CD, and Sandy Clay #EDB183. The app uses no component library.
- One hook, `useEventStream`, opens the EventSource once and writes events into the TanStack Query cache. Screens use plain `useQuery`. On reconnect, the hook refetches.
- The role is "Log in as guard" or "Log in as admin". The browser stores the role in localStorage only. The API has no auth, so the role is not a security control.
- The team adds two mp3 files. `apps/dashboard/public/sounds/registered.mp3` is a chime. `apps/dashboard/public/sounds/not-registered.mp3` loops until the guard confirms. HTMLAudioElement plays them. A missing file fails quietly.
- The ID photo uses `getUserMedia` to reach the laptop webcam. The dashboard draws a frame to a canvas and uploads it as a JPEG. `getUserMedia` needs a secure context, so the guard opens the dashboard on the laptop itself at localhost.

## Deferred decisions

- Admin duties
- Registry seed file format
- Plate model training dataset
- Guardhouse laptop OS
- Demo accuracy target
