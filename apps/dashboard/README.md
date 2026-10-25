# Dashboard

The guard, HOA officer and provider screens, built with Vite and React. It runs on the guardhouse laptop and talks to `apps/server` through Vite's proxy (`/api`, `/files`).

- Guard: gate (live view, Scan, confirm, visitor form), Inside now with Return ID, entry log, entry detail, registry lookup.
- HOA officer: houses (add, edit, remove), Inside now and entry log, read-only.
- Provider: subdivisions with status and house counts; add, edit, deactivate, reactivate.

Data comes through TanStack Query. `src/api/useEventStream.ts` opens one EventSource per subdivision and writes events into the query cache. Types come from `@guardhouse/api-types`.

Open it at `http://localhost:5173` on the laptop itself: the ID photo uses `getUserMedia`, which needs localhost or HTTPS.
