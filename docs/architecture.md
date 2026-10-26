# Architecture

## Overview

Everything runs on one guardhouse laptop, offline. One server holds every subdivision; each subdivision has one gate and one camera. The ESP32-CAM joins the laptop's hotspot. The server pulls photos from the camera, reads plates, and pushes updates to the dashboard in the browser.

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
- The firmware is an Arduino IDE sketch and is uploaded separately. It has no Turborepo task or dev pane.
- MongoDB is already installed and running on each development device. Turborepo does not start it.
- Python tools: ruff (lint and format), pyright (types), pytest.
- JavaScript tools: Biome (lint and format), Vitest.
- There is no CI yet.
- The plate accuracy script in `packages/plate-reader` scores the reader against a folder of sample photos with known plates. It runs on demand.

## Firmware

`apps/firmware/arduino/guardhouse_camera` is an Arduino IDE sketch for the AI-Thinker ESP32-CAM and OV2640 camera.

- `GET /capture` returns a high resolution still. The default is UXGA 1600x1200 at JPEG quality about 10. The plate reader uses it.
- `GET /preview` returns a VGA 640×480 frame. The live view uses it.
- `GET /status` returns uptime and Wi-Fi signal.
- Before a scan, the server measures preview brightness. For a dark image it
  turns on the ESP32-CAM LED at reduced power, waits for exposure, captures the
  frame, and turns the LED off again to limit heat and plate glare.
- The camera is mounted at a fixed spot where cars slow down or stop, aimed so each plate appears at about the same size and angle. Training photos come from the same spot.
- The camera answers at the hostname `guardcam.local` (mDNS). Each subdivision stores its camera's address, which the provider sets.
- Wi-Fi credentials live in `apps/firmware/arduino/guardhouse_camera/wifi_secrets.h`. Git ignores that file.

## Server

`apps/server` runs FastAPI on Python 3.12.

- Continuous mode is the main mode. A server timer calls `/capture` about once a second for each active subdivision. Photos with no plate are dropped.
- A car shows up in several photos as it pulls up. After the first photo with a plate, the server reads up to `frames_per_car` photos in a row (default 3), then sends one detection with the plate reading that came up most often. On a tie, it picks the reading the detector was most sure of. If the plate leaves the photo sooner, it sends what it has. The detection keeps the photo of the chosen reading as its frame.
- A Scan calls `/capture` once and reads that one photo. It is the backup for a car that continuous mode missed.
- Photo resolution is a `config.toml` value. Continuous mode uses UXGA, one photo a second. Cars stop at the gate before the guard lets them in, so a photo that arrives a little late still shows the plate.
- Plate reading runs in a thread pool (`run_in_threadpool`), so it does not block the event loop.
- Live updates reach the dashboard over Server-Sent Events, one stream per subdivision. An in-memory event hub sends them. The event types are `detection`, `entry`, and `camera`.
- Actions such as confirm and Return ID are plain POST requests.
- The event hub, the waiting lists and the repeat windows live in memory, one set per subdivision, so the server runs as a single worker process. A restart clears them. Only confirmed entries are saved.
- The repeat window lasts 30 seconds and is set in `config.toml`. In continuous mode only, it ignores the same normalized plate when the camera sees it again. A manual Scan always creates a detection.
- The server polls each active subdivision's camera `/status` every 5 seconds and pushes a `camera` event. Two misses in a row mark that camera offline.
- Every route under `/api/subdivisions/{sid}` only reads and writes that subdivision's records. For an inactive subdivision, the server rejects scans, entries and registry changes with `409 Conflict`; reads still work.
- MongoDB access uses PyMongo's async client (`AsyncMongoClient`). Pydantic models describe the data. The same models produce the OpenAPI schema.
- `config.toml` is committed. It holds the tunables: repeat window, continuous mode interval, frames per car, photo resolution, and near match distance.
- `.env` holds `MONGO_URI`. Both files load through `pydantic-settings`.
- Photos (car frames and ID photos) are files under `apps/server/data/`, which git ignores. MongoDB stores only their paths.
- In the prototype, the team deletes old photos by hand. The real product needs a sweeper. It deletes ID photos and car frames 30 days after the entry's exit, or 30 days after entry for registered vehicles. This follows the Data Privacy Act (RA 10173).
- Times are stored in UTC. Days and hours (the entry log's date, "today", the stats windows) use the laptop's local time zone, and the dashboard shows times in local time too.

## Plate reader

`packages/plate-reader` is a Python package.

- Finding the plate region in a photo sits behind a `PlateDetector` interface. The first version uses classical OpenCV (edges and contours).
- A trained model replaces it later, with no changes elsewhere. The plan has two steps. A pretrained plate detector comes first. Then a YOLO nano model, fine tuned on Philippine plates, is exported to ONNX and run with onnxruntime.
- The detector returns each plate's box and how sure it is. In continuous mode most photos show an empty gate, so it must return nothing for them. Training photos include the empty gate for this reason.
- Tesseract (pytesseract) reads the cropped plate. It is limited to letters and digits.
- Near match: the package normalizes the plate (uppercase, letters and digits only). It treats common OCR confusions as equal (0 and O, 1 and I, 8 and B, 5 and S). Then it accepts registered plates within edit distance 1, using `rapidfuzz`.

## Data

MongoDB holds three collections, `subdivisions`, `houses` and `entries`. Their shape looks like this:

```text
subdivisions: { name, address, cameraUrl, active, createdAt }
houses:  { subdivisionId, block, lot, street, ownerName, contact, updatedAt,
           vehicle?: { plate (normalized, unique per subdivision), plateDisplay } }
entries: { subdivisionId, at, plate, plateRaw, verdict: "registered" | "visitor",
           houseId?, houseLabel?,
           frame: path | null,
           visitor?: { purpose: "delivery" | "guest" | "service" | "other",
                       destination: { kind: "block", block }
                                  | { kind: "residence", houseId, label },
                       idPhoto: path | null, exitAt: time | null } }
```

- Every house and entry carries its `subdivisionId`. Queries always filter by it.
- The registry is a subdivision's `houses`. It lists every house, with or without a car. A house with no car can still be a visitor's destination. The HOA officer adds, edits and removes houses; `updatedAt` records the last change.
- An entry copies what it needs when it is saved: the confirmed plate, `houseLabel` for a registered car, and the destination label for a visitor. Editing or removing a house never changes past entries; `houseId` may then point to nothing.
- `plate` in an entry is the confirmed plate. `plateRaw` keeps the plate reading the system made.
- A destination is either a block (for example "Block 19") or a residence picked from the registry. A residence is stored as the house id plus a label, such as "Dela Cruz Residence".
- Delivery suggests a block. Guest suggests a residence.
- `exitAt` stays empty until the guard returns the Held ID.
- There is no seed file. How test and demo data get created is not decided yet.

## API

Provider routes:

```text
GET   /api/subdivisions                -> [{id, name, address, active, cameraOnline, houseCount,
                                            entriesLast7Days, dailyEntries}]
POST  /api/subdivisions                {name, address, cameraUrl}
PATCH /api/subdivisions/{sid}          {name?, address?, cameraUrl?, active?}
```

Guard and HOA officer routes, all under `/api/subdivisions/{sid}`:

```text
POST   .../scan                          -> Detection (also pushed over SSE)
GET    .../waiting                       -> Detection[]
POST   .../detections/{id}/confirm       {plate} -> registered: entry saved, house details returned
                                                   not registered: {verdict: "visitor"}, nothing saved yet
POST   .../entries/visitor               multipart: detectionId, plate, purpose, destination, idPhoto
POST   .../entries/{id}/return-id
GET    .../entries?plate=&date=&verdict=
GET    .../entries/inside                (guard only)
GET    .../stats/today                   (guard Today: counts, entries per hour today)
GET    .../stats/hourly?days=7|30        (HOA Overview: entries by hour of day, by verdict)
GET    .../stats/purposes?days=7|30      (HOA Overview: visitors by purpose)
GET    .../houses?q=
POST   .../houses                        (HOA officer)
PATCH  .../houses/{id}                   (HOA officer)
DELETE .../houses/{id}                   (HOA officer)
GET    .../camera/preview                (server proxies the camera's /preview)
GET    .../events                        (SSE)
GET    /files/...                        (photos)
```

A stats window of 7 or 30 days is today plus the days before it, from local midnight. `dailyEntries` is 7 counts, oldest first, today last.

The provider list returns counts and status only, never houses, entries or photos. The API has no auth in the prototype, so this is a convention the dashboard follows, not a control.

TypeScript types come from the OpenAPI schema. The Turborepo task `gen:types` dumps `openapi.json` from the server and runs `openapi-typescript` into `packages/api-types`. The dashboard's `dev` and `build` tasks depend on `gen:types`. The generated file is committed.

## Dashboard

`apps/dashboard` is a Vite app built with React and TypeScript.

- It uses React Router for screens and TanStack Query for data.
- Tailwind v4 reads the palette as theme tokens: Shadow Grey #3A2E39, Dark Teal #1E555C, Almond Silk #F4D8CD, and Sandy Clay #EDB183. The page background is cream (#F8F5EE). Text uses Atkinson Hyperlegible Next, and plates and times use Atkinson Hyperlegible Mono, both self-hosted through Fontsource.
- The app uses no component library, except for charts. Charts use the shadcn/ui chart component (`src/components/chart.tsx`, copied in as shadcn intends) on top of Recharts. `src/components/charts.tsx` holds the dashboard's own charts built on it.
- One hook, `useEventStream`, opens the EventSource once and writes events into the TanStack Query cache. Screens use plain `useQuery`. On reconnect, the hook refetches.
- The root page offers three roles: guard, HOA officer and provider. A guard or HOA officer then picks an active subdivision; the provider goes straight to the subdivisions list. The browser stores the role and subdivision in localStorage only. The API has no auth, so this is not a security control.
- Guard screens: gate (the landing page), Today, visitor form, entry log, entry detail, registry lookup. Today shows stat tiles (entries today, visitors inside, waiting list), an arc of today's entries split registered vs visitor, entries per hour today, a short Inside now list with Return ID, and the latest five entries.
- HOA officer screens: Overview (the landing page), houses (add, edit, remove), and today's entry log, read-only. Overview shows registry tiles, recently updated houses, entries by hour of day with a 7-day or 30-day switch, and visitors by purpose over the last 7 days. There is no heatmap. The HOA officer has no Inside now list, but the entry log and entry detail show each visitor's exit time, or "Not yet exited". They can't return IDs.
- Provider screens: subdivisions as cards (status, camera, house count, 7-day entries sparkline), add and edit a subdivision, deactivate or reactivate it.
- Charts use Dark Teal for registered and Sandy Clay for visitors, always with a legend or direct labels.
- An inactive subdivision shows a banner on every guard and HOA officer screen, and hides the actions that save.
- The team adds two mp3 files. `apps/dashboard/public/sounds/registered.mp3` is a chime. `apps/dashboard/public/sounds/not-registered.mp3` loops until the guard confirms. HTMLAudioElement plays them. A missing file fails quietly.
- The ID photo uses `getUserMedia` to reach the laptop webcam. The dashboard draws a frame to a canvas and uploads it as a JPEG. `getUserMedia` needs a secure context, so the guard opens the dashboard on the laptop itself at localhost.

## Deferred decisions

- Business model and billing
- Real user accounts
- How test and demo data are created
- Several gates per subdivision
- Several vehicles per house
- Plate model training dataset
- Guardhouse laptop OS
- Demo accuracy target
- Small photos to find plates, then one UXGA photo to read them, if UXGA once a second can't keep up
