# Dashboard

The guard, HOA officer and provider screens, built with Vite and React. It runs on the guardhouse laptop and talks to `apps/server` through Vite's proxy (`/api`, `/files`).

- Guard: gate (live view, Scan, confirm, visitor form), Today (stat tiles, charts, Inside now with Return ID, latest entries), entry log, entry detail, registry lookup.
- HOA officer: Overview (registry tiles, recently updated houses, entries by hour with a 7 or 30 day switch, visitors by purpose), houses (add, edit, remove), and today's entry log, read-only.
- Provider: subdivision cards with status, camera, house count and a 7-day sparkline; add, edit, deactivate, reactivate.

Charts use the shadcn chart component (`src/components/chart.tsx`) on Recharts; `src/components/charts.tsx` has the dashboard's own charts. Data comes through TanStack Query. `src/api/useEventStream.ts` opens one EventSource per subdivision and writes events into the query cache. Types come from `@guardhouse/api-types`.

Open it at `http://localhost:5173` on the laptop itself: the ID photo uses `getUserMedia`, which needs localhost or HTTPS.
