# API types

TypeScript types for the server's API, generated from its OpenAPI schema. The dashboard imports these so a renamed field fails the dashboard build.

- `src/schema.ts` is generated. Run `bun run gen:types` after changing `apps/server/guardhouse/models.py` or a route, and commit the result.
- `src/index.ts` gives the schemas short names, such as `Detection` and `Entry`.
- The live updates on `GET /api/subdivisions/{sid}/events` are `GateEvent`: the SSE `event:` field is the event's `type`.
