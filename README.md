# Vehicle entry and exit monitoring using ESP32-CAM

A guardhouse prototype for a subdivision gate. An ESP32-CAM photographs arriving cars, a laptop server reads the plates, and a dashboard shows the guard whether each car is registered. Visitors leave an ID photo, and the guard records their exit.

- What and why: [docs/intent.md](docs/intent.md)
- Glossary: [CONTEXT.md](CONTEXT.md)
- Working in this repo: [AGENTS.md](AGENTS.md)

## Run the prototype

1. Install Bun, Python 3.12, uv, MongoDB, and Tesseract OCR.
2. Run `bun install` and `uv sync`.
3. Start local MongoDB, then run `bun dev`.
4. Keep `mock_camera = true` in `apps/server/config.toml` while building the
   dashboard. Follow `apps/firmware/README.md` for hardware, then change it to
   `false` when the ESP32-CAM is reachable from the laptop.

The guard must confirm or correct every plate reading. A detection alone never
creates an entry.
