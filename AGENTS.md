# AGENTS.md

A guardhouse prototype. An ESP32-CAM photographs arriving cars, a laptop server reads the plates, and a dashboard tells the guard whether each car is registered.

## Read first

- `docs/intent.md`: the problem, the outcome, constraints and open questions.
- `CONTEXT.md`: the glossary. Use its terms in code, UI text and docs, and avoid the words it lists under _Avoid_.

## Layout

```
apps/
  dashboard/       Vite + React, the guard's screens
  server/          FastAPI, MongoDB access
  firmware/        MicroPython for the ESP32-CAM
packages/
  plate-reader/    Python: plate model, Tesseract, plate normalization, near matches
  api-types/       TypeScript types generated from the server's OpenAPI schema
docs/
  intent.md
```

JavaScript packages use a pnpm workspace (`pnpm-workspace.yaml`). Python packages use a uv workspace (root `pyproject.toml`). The firmware is plain MicroPython files, outside both workspaces.

## Rules

- The guard confirms every plate. Never save an entry from a plate reading alone.
- The registry is read-only in the dashboard. It is loaded from a seed file.
- A house has at most one registered vehicle.
- Only visitors have exits.
- ID photos are deleted 30 days after the visitor's exit.
- Everything runs on the guardhouse laptop. Don't add cloud services.
- Use fictional names, plates and IDs in seeds, tests and screenshots.
- Don't commit secrets. Wi-Fi credentials go in `apps/firmware/secrets.py` and server settings in `.env`; git ignores both.

## Commands

Each app's commands are added here when the app is scaffolded.

## Git

`main` holds the base structure. Feature work goes on branches named `wends/<topic>`. Don't push or open a pull request without asking first.
