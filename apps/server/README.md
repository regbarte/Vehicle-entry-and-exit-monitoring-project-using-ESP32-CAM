# Server

FastAPI app on the guardhouse laptop. It gets photos from the ESP32-CAM, reads plates, looks them up in the subdivision's registry, stores entries in MongoDB Atlas, and pushes live updates to the dashboard over Server-Sent Events.

- `guardhouse/models.py` is the API contract. The OpenAPI schema and `packages/api-types` come from it.
- `guardhouse/routes/` holds the routes: subdivisions (provider), gate (scan, confirm, camera view, events), entries, and houses (registry).
- `guardhouse/camera.py` has `MockCamera` and `mock_read_plate`. With `mock_camera = true` in `config.toml` (the only mode so far), Scan draws a fake car photo, and the camera always reports online. The real ESP32-CAM client and `packages/plate-reader`'s OpenCV and Tesseract reader replace them later.
- Photos go under `data/`, which git ignores.

Run with `bun dev` from the repo root, or `uv run fastapi dev guardhouse/main.py --port 8000` here. Set `MONGO_URI` in `.env` to your Atlas connection string (see `.env.example`). Tests run against that cluster; they use and drop the `guardhouse_test` database.
