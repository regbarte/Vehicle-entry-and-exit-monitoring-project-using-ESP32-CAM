# AGENTS.md

A guardhouse prototype. An ESP32-CAM photographs arriving cars, a laptop server reads the plates, and a dashboard tells the guard whether each car is registered.

## Read first

- `docs/intent.md`: the problem, the outcome, constraints and open questions.
- `docs/architecture.md`: the technical design (camera link, server, plate reader, data, API, dashboard).
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
  architecture.md
```

JavaScript packages use Bun workspaces, and Turborepo runs tasks across all apps. Python packages use a uv workspace (root `pyproject.toml`); each also has a small `package.json` whose scripts call `uv run`, so Turborepo can run them. The firmware's `package.json` only has a `deploy` script.

## Rules

- The guard confirms every plate. Never save an entry from a plate reading alone.
- The registry is the list of houses, each with at most one registered vehicle. It is read-only in the dashboard and loaded from a seed file.
- Only visitors have exits.
- The real product deletes ID photos 30 days after the visitor's exit. The prototype has no sweeper; the team deletes old photos by hand. Don't add automatic deletion without asking.
- Everything runs on the guardhouse laptop. Don't add cloud services.
- Use fictional names, plates and IDs in seeds, tests and screenshots.
- Don't commit secrets. Wi-Fi credentials go in `apps/firmware/secrets.py` and server settings in `.env`; git ignores both.
- The server runs one worker process. The waiting list and the event hub live in memory.
- The guard/admin role is stored in the browser only. It is not security; don't treat it as access control.

## Commands

- `bun install`: install JavaScript dependencies
- `uv sync`: install Python dependencies
- `bun dev`: Turborepo TUI with the server and the dashboard; needs MongoDB already running locally
- `bun run gen:types`: regenerate the TypeScript types from the server's OpenAPI schema
- `bun run test`: run the tests in every app and package
- `bun run lint`: run the linters in every app and package
- `bun run --filter @guardhouse/firmware deploy`: copy the firmware to the ESP32-CAM

The apps are not scaffolded yet, so these commands start working as each app is added.

## Git

`main` holds the base structure. Feature work goes on branches named `wends/<topic>`. Don't push or open a pull request without asking first.
