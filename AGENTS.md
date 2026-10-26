# AGENTS.md

A guardhouse prototype that serves many subdivisions. An ESP32-CAM photographs arriving cars, a laptop server reads the plates, and a dashboard tells the guard whether each car is registered. HOA officers maintain each subdivision's registry, and the provider manages the subdivisions.

## Read first

- `docs/intent.md`: the problem, the outcome, constraints and open questions.
- `docs/architecture.md`: the technical design (camera link, server, plate reader, data, API, dashboard).
- `CONTEXT.md`: the glossary. Use its terms in code, UI text and docs, and avoid the words it lists under _Avoid_.

## Layout

```
apps/
  dashboard/       Vite + React, the guard, HOA officer and provider screens
  server/          FastAPI, MongoDB access
  firmware/        Arduino IDE sketch for the ESP32-CAM
packages/
  plate-reader/    Python: plate model, Tesseract, plate normalization, near matches
  api-types/       TypeScript types generated from the server's OpenAPI schema
docs/
  intent.md
  architecture.md
```

JavaScript packages use Bun workspaces, and Turborepo runs tasks across the dashboard and server packages. Python packages use a uv workspace (root `pyproject.toml`); each also has a small `package.json` whose scripts call `uv run`, so Turborepo can run them. The firmware is uploaded separately through Arduino IDE.

## Rules

- The guard confirms every plate. Never save an entry from a plate reading alone.
- Every house and entry belongs to one subdivision. Every query filters by `subdivisionId`; never let one subdivision's screens or routes read another's records.
- The registry is a subdivision's list of houses, each with at most one registered vehicle. HOA officers maintain it in the dashboard; guards can only search it. There is no seed file.
- Entries keep a copy of their plate and destination. Editing or removing a house never changes past entries.
- The provider sees subdivision status and counts only, never houses, entries or photos.
- An inactive subdivision stays readable, but the server rejects its scans, entries and registry changes.
- Only visitors have exits.
- The real product deletes ID photos 30 days after the visitor's exit. The prototype has no sweeper; the team deletes old photos by hand. Don't add automatic deletion without asking.
- Everything runs on the guardhouse laptop. Don't add cloud services.
- Use fictional names, plates and IDs in tests and screenshots.
- Don't commit secrets. Wi-Fi credentials go in `apps/firmware/arduino/guardhouse_camera/wifi_secrets.h` and server settings in `.env`; git ignores both.
- The server runs one worker process. The waiting lists and the event hub live in memory.
- The role and subdivision are stored in the browser only. They are not security; don't treat them as access control.
- Business models, billing and real accounts are out of scope for now.

## Commands

- `bun install`: install JavaScript dependencies
- `uv sync`: install Python dependencies
- `bun dev`: Turborepo TUI with the server and the dashboard; needs `MONGO_URI` in `apps/server/.env` pointing at MongoDB Atlas
- `bun run gen:types`: regenerate the TypeScript types from the server's OpenAPI schema
- `bun run test`: run the tests in every app and package
- `bun run lint`: run the linters in every app and package
- Upload `apps/firmware/arduino/guardhouse_camera/guardhouse_camera.ino` with Arduino IDE

The apps are not scaffolded yet, so these commands start working as each app is added.

## Git

`main` holds the base structure. Feature work goes on branches named `wends/<topic>`. Don't push or open a pull request without asking first.
