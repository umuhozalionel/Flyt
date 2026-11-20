# Flyt

Flyt is a ride-booking platform for Kigali, Rwanda. It connects riders with cars and professional drivers from RURA-licensed taxi and rental firms, with the fare shown before every trip.

This repository contains the Flyt web application: the rider app, and the foundation for the driver app, the operations dashboard and the company portal.

## How Flyt works

- **Licensed partners only.** Every car and driver belongs to a partner firm that holds a RURA licence. Each ride runs under that firm's licence, and the firm's name and licence number are shown to the rider.
- **Upfront pricing.** The rider sees the full fare before booking, and the fare is fixed at booking.
- **Direct payment to the firm.** Riders pay the partner firm by MTN MoMo or Airtel Money, or the trip is billed to their employer's company account. Flyt does not hold rider funds.
- **Tax compliance.** The partner firm issues an EBM receipt for every fare. Flyt Ltd invoices each firm a platform fee.
- **Business accounts.** Companies can open monthly accounts for staff trips, airport transfers and shared staff commutes.

## Status

| Area | Route | Status |
| --- | --- | --- |
| Start page | `/` | Built |
| Rider app | `/rider` | Built |
| Operations dashboard | `/ops` | Built |
| Driver app | `/driver` | Built |
| Company portal | `/company` | Built |
| Live trip sharing page | `/share` | Built |

Two data sources: sample data in the browser (`mock`, the default) or Supabase (`supabase`, local CLI for now). Riders pay the firm directly by MoMo or Airtel Money; Flyt never holds rider money.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router) with React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui components on Base UI
- lucide-react icons
- MapLibre GL with OpenFreeMap map styles (free, no key), behind `components/shared/map-view.tsx`
- motion (screen and sheet animation), vaul (draggable sheets), Inter from @fontsource (self-hosted)
- Supabase (Postgres, auth, realtime, storage) for the backend
- pnpm

## Getting started

### Requirements

- Node.js 20.9 or later
- pnpm (the version is pinned in `package.json`; run `corepack enable` to use it)

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build (type errors fail the build) |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | Run the TypeScript type check |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run the Vitest tests (fare engine, seed data, data store) |
| `pnpm check` | Typecheck, lint, test and build in one go |
| `pnpm test:db` | Database tests against the local Supabase (reset it first: they change data) |
| `pnpm cloud:check` | Refuses settings that must never reach a cloud project (the test SMS code, dev sign-in) |
| `pnpm cloud:config-push` | Runs `cloud:check`, then `supabase config push`. Never run `supabase config push` on its own |

### Data source

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_DATA_SOURCE=mock` (the default) runs the demo in the browser with sample data; changes show at once in every open tab. `supabase` uses the Supabase backend.

### Supabase (local)

```bash
npx supabase start          # prints the local URL and anon key for .env.local
npx supabase db reset       # applies supabase/migrations and supabase/seed.sql
npx supabase test db        # pgTAP tests (row level security and the trip flow)
```

- Money (fares, platform fees, invoice totals) and every trip status change are worked out in Postgres functions, never taken from the browser.
- The test SMS code `123456` works only on the local CLI. `pnpm cloud:check` blocks it, and dev email sign-in, from a cloud project.
- Browser notifications use free Web Push with VAPID keys. Make a pair with `npx web-push generate-vapid-keys`. The public key goes in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; the private key goes only in `supabase/functions/.env` (see `supabase/functions/.env.example`). The `push` edge function sends them; a trigger calls it when a notification is saved.

### Maps

The map style URLs come from `NEXT_PUBLIC_MAP_STYLE_URL` and `NEXT_PUBLIC_MAP_STYLE_DARK_URL` (OpenFreeMap "liberty" and "dark" by default). If the style or tiles fail to load, the map switches to a plain built-in map of our places, so booking still works. Routes are straight lines between places and distances come from the table in `lib/places.ts`: no paid routing. In version 1 drivers share their zone, not GPS, so cars are drawn moving slowly around their zone. MapLibre's worker file is copied into `public/vendor` on install, dev and build (`scripts/copy-map-worker.mjs`).

### Installable

`app/manifest.ts` (served at `/manifest.webmanifest`), the icons in `public/icons`, and one service worker (`public/sw.js`) for notifications, cached app files and the offline page (`public/offline.html`). The service worker is registered in production builds only.

## Project structure

```
app/                  Routes only (client pages): /, /rider
components/
  rider/              Rider app, one file per screen
  shared/             Shared pieces: logo, badges, money, trip card, map, toast, skeleton, theme
  ui/                 Base UI components
lib/
  api.ts              The only data door for screens
  data/               Data sources behind api.ts: mock.ts (browser store) and supabase.ts
  mock-data.ts        Sample data, built with the fare engine
  pricing.ts          Fare engine (price previews)
  places.ts           The 10 Kigali places and the distance table
  trip-rules.ts       Allowed trip status moves
  documents.ts        Document status from expiry dates
  invoices.ts         Invoice totals
  time.ts             Kigali time helpers
  types.ts            Shared data types
  config.ts           Feature flags and demo settings
  format.ts           Currency, phone and date formatting
  i18n/               Interface text (English; Kinyarwanda and French keys ready)
tests/                Vitest tests
public/               Icons and static assets
```

## Architecture notes

- **One data layer.** Screens read and write data only through `lib/api.ts`, which forwards to the mock or Supabase data source. ESLint blocks screens from importing mock data or Supabase directly.
- **Client-side data.** Every page loads its data in the browser, so the app can be ported to Vite and Capacitor.
- **Portable front end.** Next.js is used for routing only. The app avoids server actions, API routes and middleware, so the screens can later be packaged as iOS and Android apps.
- **Feature flags.** Features that are not part of the first release are switched off in `lib/config.ts`:

  | Flag | Default | Controls |
  | --- | --- | --- |
  | `publicSharedRides` | `false` | Shared rides between members of the public |
  | `privateOwnerCars` | `false` | Cars owned by private individuals |
  | `cardPayments` | `false` | Card payments |

## Pricing model

Fares are calculated in `lib/pricing.ts` from the active plan. Distances come from the table in `lib/places.ts`. All amounts are whole Rwandan francs.

| Rule | Value |
| --- | --- |
| Baseline plan (pilot weeks 1 to 4) | Rwf 1,500 for the first km, then Rwf 1,000 per km |
| Test plan (pilot weeks 5 to 8) | Rwf 1,200 for the first km, then Rwf 750 per km |
| Shared commute seat | 40% of the private fare for the same distance, billed to the company |
| Hourly and daily hire | The firm's own rate times the number of hours or days |
| Airport transfer | Fixed price for the zone at the other end; private-ride fare where no zone price is set |
| Platform fee | Set per firm: 10%, 12% or 15% of the fare, paid by the partner firm |

One plan is active at a time. Amounts are shown in Rwandan francs without decimals (for example, Rwf 4,200). Times, "today" figures and invoice periods use Kigali time.

## Roadmap

1. Operations dashboard: overview, dispatch, trips, firms, drivers and cars
2. Driver app: job offers, trip flow, earnings and documents
3. Operations dashboard: riders, companies, shared commutes, pricing, invoices, pilot report, incidents and settings
4. Company portal: staff, trips, invoices and commute routes
5. Backend, authentication and live maps (local Supabase; cloud before the pilot)
6. Riders and drivers extras: notifications, trip PIN, chat, favourites, sharing, lost and found, tips and points
7. Map first, motion and installable web app
8. iOS and Android apps

## License

Proprietary. Copyright © 2026 Flyt Ltd. All rights reserved.
