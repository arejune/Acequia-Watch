# Acequia Watch

Acequia Watch helps volunteer acequia stewards document fire and flood damage, even when there's no cell service. Reports can be saved in the field and synced later. The app also includes resources for people who want to learn about acequias or support them.

It's an installable progressive web app (PWA) that works offline. The app has separate views for stewards, agency reviewers, administrators, and the general public.

## What it does

- **Steward** (`/steward`): Record damage with photos, GPS, severity, and estimated costs. Save reports offline, sync them later without duplicates, check which structures still need inspection, share reports with agencies, and generate damage packets.
- **Agency reviewer** (`/agency`): View shared reports on a map, review cost estimates and inspection coverage, identify gaps, and export data as CSV.
- **Admin** (`/admin`): Approve accounts and manage events and acequias.
- **Public** (`/explore`, `/learn`, `/act`, `/play`): Explore acequia information, read educational material with sources, browse legislation and programs, draft letters, and play *Turno*, an arcade game about operating irrigation gates.

Acequia Watch does **not** submit reports directly to DHSEM, FEMA, or the Interstate Stream Commission, and it is not endorsed by NMAA. All demonstration records are fictional.

## Run locally

Requires Node.js 22.18 or newer.

```bash
npm install
npm run dev
```

Open the address printed by Vite, usually `http://localhost:5173`.

The app runs without Supabase credentials using an in-browser demo backend seeded with fictional data. On the sign-in screen, select **Try a demo** and choose a role.

To test on a phone, run:

```bash
npm run dev:phone
```

Open the network address printed in the terminal from a device on the same Wi-Fi network. GPS, installation, and offline behavior should be tested over HTTPS on a deployed site.

## Tests

Run the unit and security tests with:

```bash
npm test
```

Run the browser tests with:

```bash
npm run test:browser
```

The test suite covers synchronization, inspection gaps, cost totals, CSV exports, game logic, and database access policies. Browser tests run end-to-end checks in Chrome.

| Suite | What it checks |
|---|---|
| `core` | Creating a report offline, reconnecting, and syncing without duplicates |
| `quick` | The quick-report workflow when offline |
| `packet` | Packet generation, photos, PDF output, and access restrictions |
| `tour` | Guided tours and account approval |
| `phone` | Layout and interaction checks at three phone sizes |
| `a11y` | Automated accessibility checks using axe-core |
| `offline` | Opening the production build without a network connection after an initial visit |

Run selected browser suites by passing their names:

```bash
npm run test:browser -- core packet
```

Google Chrome is required. Set `CHROME_PATH` if Chrome is installed in a nonstandard location. Test results are recorded in `docs/TEST-LOG.md`.

## Demo and backend behavior

The app has two backend modes:

- **Demo backend:** Runs in the browser and uses simulated access rules and fictional data.
- **Supabase backend:** Uses Postgres row-level security policies defined in `supabase/schema.sql`. The policies are tested against Postgres using PGlite, but the repository has not yet been tested against a live Supabase project.

The seeded demonstration data is placed in the San Pedro Parks Wilderness, where the mapped records do not represent actual acequia infrastructure. Dashboard totals and sample incidents are fictional.

## Connect Supabase (optional)

Use a separate Supabase project for demonstration data only.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Under Authentication → URL Configuration, add the deployed app URL if using magic links.
4. Seed the project from your local environment:

   ```bash
   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=... npm run seed:supabase
   ```

5. Create a `.env.local` file with the public configuration values:

   ```bash
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

Do not commit `.env.local` or expose the Supabase service key.

Demo accounts use the password `demo-acequia-2026`:

- `steward@`
- `steward2@`
- `agency@`
- `admin@demo.acequiawatch.org`

## Deploy

The app can be deployed to a static host that supports HTTPS.

- **Build command:** `npm run build`
- **Output directory:** `dist`

The repository includes `vercel.json` and `public/_redirects` for client-side routing. If using Supabase, configure the two `VITE_` environment variables in the hosting provider's settings.

## Project structure

```text
src/
  app/          Application screens
  components/   Shared interface components
  content/      Educational material, issues, bills, and programs
  db/           IndexedDB, synchronization, and backend implementations
  lib/          Geographic utilities, photo processing, totals, gap detection, CSV
  game/         Turno game logic
  config/       Labels, severity scales, and packet layout
  demo/         Fictional seed data
  styles.css    Global styles
supabase/       Database schema and security tests
scripts/        Browser tests, seeding, data refresh, and icons
public/         Static assets and saved map data
docs/           Test logs, decisions, sources, and AI-use log
```

## Data sources

Acequia line and headgate data comes from the New Mexico Office of the State Engineer's EDAC resources. The saved data in `public/data/` is incomplete and should not be treated as a comprehensive inventory.

Refresh the data with:

```bash
node scripts/fetch-ose.mjs
```

Base map data © OpenStreetMap contributors. Sources for educational content are maintained in `src/content/learn.ts` and `docs/SOURCES.md`.

## AI use

See [`docs/AI-USE-LOG.md`](docs/AI-USE-LOG.md) for a record of AI assistance during development.
