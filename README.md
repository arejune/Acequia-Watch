# Acequia Watch

Acequia Watch helps volunteer acequia stewards record fire and flood damage
with no signal, and share it with agencies when their acequia agrees. Its
public side is for anyone who wants to learn about acequias or help them.

It is one installable web app (a PWA) that runs full screen and offline. The
first screen asks who you are:

- **Steward** (`/steward`): log damage with a photo, GPS, severity and a cost range with no signal; sync later with no duplicates; see which structures nobody has checked, closest to damage first; share an event with agencies; print a damage packet.
- **Agency reviewer** (`/agency`): shared reports on a map, low/likely/high cost totals, coverage, gaps, CSV export.
- **Admin** (`/admin`): approve new accounts, manage events and acequias.
- **Everyone else** (no account): `/explore`, `/learn` (a source on every fact), `/act` (issues, the 2026 acequia bills, programs, a letter builder) and `/play` (*Turno*, an arcade game about running the compuertas).

It does **not** submit anything to DHSEM, FEMA or the Interstate Stream
Commission, and is not endorsed by NMAA. All demo data is fictional.

## Run it

Needs Node 22.18 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

No setup or keys needed. Without Supabase keys the app runs on a demo server
inside the browser, seeded with made-up data. On the sign-in screen, open
**Try a demo** and pick a role.

To try it on your phone, run `npm run dev:phone` and open the `Network:`
address it prints (same Wi-Fi). GPS, install and offline need HTTPS, so test
those on a deployed link.

## Test it

```bash
npm test               # 61 unit and security tests (sync engine, gaps, totals, CSV, game, row-level security)
npm run test:browser   # end-to-end in Chrome at phone size
```

`test:browser` starts its own server and runs these suites (pick some with
`npm run test:browser -- core packet`):

| Suite | Checks |
|---|---|
| `core` | a steward reports offline with a photo, reconnects, syncs, no duplicates |
| `quick` | camera-first quick report, offline |
| `packet` | packet photos online and offline, PDF pages and size, refusals for other stewards |
| `tour` | guided tours stay on screen; create account → admin approves → sign in |
| `phone` | every route at 3 phone sizes: no sideways scroll, tap targets ≥ 44 px, no errors |
| `a11y` | axe-core WCAG 2.1 A/AA on every screen |
| `offline` | production build opens with no network after one visit |

It needs Google Chrome; set `CHROME_PATH` if it isn't in the usual place.
Results go in `docs/TEST-LOG.md`.

## What's real and what's simulated

- **The demo** runs on the in-browser server, and access rules there are **simulated**.
- **The security model** is real Postgres row-level security in `supabase/schema.sql`, tested against real Postgres with PGlite (`supabase/rls.test.ts`). No live Supabase project has been tested yet.
- **The demo data is made up** and placed in the San Pedro Parks Wilderness, where there are no real structures. Dashboard totals are synthetic, not findings.

## Connect Supabase (optional, demo project only)

1. Create a Supabase project used **only** for fake demo data.
2. In the SQL editor, run `supabase/schema.sql`.
3. Under Authentication → URL configuration, add your deployed URL (for magic links).
4. Seed it. The service key stays on your machine:
   ```bash
   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=... npm run seed:supabase
   ```
5. Create `.env.local` (gitignored) with only the public values:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

Demo logins (password `demo-acequia-2026`): `steward@`, `steward2@`, `agency@`
and `admin@demo.acequiawatch.org`.

## Deploy

Any static host with HTTPS. Build command `npm run build`, output `dist`.
`vercel.json` and `public/_redirects` already send every path to
`index.html`. Set the two `VITE_` variables in the host's settings if you use
Supabase.

## Layout

```
src/
  app/          screens, one folder per side (steward, agency, community, learn, packet)
  components/   shared UI: map, photo and location fields, tour, sheets
  content/      Learn facts, issues, bills and programs as data, each with a source
  db/           IndexedDB schema, outbox and sync engine, backends (Supabase, in-browser)
  lib/          geo, photo compression, totals, gap detection, CSV
  game/         Turno rules (pure functions, unit tested)
  config/       labels, severity scale, packet layout
  demo/         made-up seed data
  styles.css    all styles
supabase/       schema.sql (tables and row-level security) and its tests
scripts/        browser tests, Supabase seeding, State Engineer data refresh, icons
public/         icons and the saved State Engineer acequia map data
docs/           test log, decisions, sources, AI use log
```

## Data sources

Acequia lines and headgates come from the Office of the State Engineer (EDAC),
saved in `public/data/` as-is and incomplete. Refresh them with
`node scripts/fetch-ose.mjs`. Base map © OpenStreetMap contributors. Fact
sources are in `src/content/learn.ts` and `docs/SOURCES.md`.

## AI use

See `docs/AI-USE-LOG.md`.
