# Server

FastAPI app on the guardhouse laptop. It gets photos from the ESP32-CAM, reads plates, looks them up in the subdivision's registry, stores entries in MongoDB Atlas, and pushes live updates to the dashboard over Server-Sent Events.

- `guardhouse/models.py` is the API contract. The OpenAPI schema and `packages/api-types` come from it.
- `guardhouse/routes/` holds the routes: subdivisions (provider), gate (scan, confirm, camera view, events), entries, and houses (registry).
- `guardhouse/camera.py` has both a mock camera and the ESP32-CAM HTTP client.
  Develop with `mock_camera = true`; set it to `false` to use each
  subdivision's configured camera address and the OpenCV/Tesseract reader.
- Photos go under `data/`, which git ignores.

Run with `bun dev` from the repo root, or `uv run fastapi dev guardhouse/main.py --port 8000` here. Set `MONGO_URI` in `.env` to your Atlas connection string (see `.env.example`). Tests run against that cluster; they use and drop the `guardhouse_test` database.

For real hardware, install Tesseract OCR and put `tesseract.exe` on `PATH`, set
`mock_camera = false` in `config.toml`, restart the server, and use the provider
screen to set the camera address. The laptop and ESP32-CAM must be on the same
hotspot network.
