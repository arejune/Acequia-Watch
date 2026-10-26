# AI use log

Every use of AI recorded.

| Date | Tool | What it did | Where it landed | Human check |
|---|---|---|---|---|
| 2026-10-21 | Claude Code (Opus 5.5)| Wrote the offline store, outbox, sync engine, both backends, and sync tests. | `src/db/` | Prompted AI to architect local-first PGlite-to-Supabase sync, outbox retry logic, and edge-case sync tests. |
| 2026-10-21 | Claude Code (Opus 5.5)| Wrote the Postgres schema, RLS policies, and the PGlite security tests. | `supabase/` | Used AI to draft RLS policies and PGlite test suites to ensure tenant isolation across local and remote DBs. |
| 2026-10-25 | Claude Code (Opus 5.5) | Review fixes, then code cleanup: removed dead code, merged two stylesheets, four SQL migrations into `supabase/schema.sql`, and 17 scripts into one browser test runner. | `src/`, `supabase/`, `scripts/`, `README.md`, `docs/` | Guided AI through structural cleanup pass to consolidate migrations and test runners without breaking state. |
| 2026-10-21 | Claude Code (Opus 5.5)| Wrote gap detection, totals, CSV, geo, and photo compression with unit tests. | `src/lib/` | Asked AI to write pure functions for geospatial processing, client-side photo compression, and CSV parsing with unit tests. |
