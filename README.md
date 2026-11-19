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
| Operations dashboard | `/ops` | In development |
| Driver app | `/driver` | In development |
| Company portal | `/company` | In development |

All data is currently sample data served through a local data layer. Payments, sign-in and maps are simulated.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router) with React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui components on Base UI
- lucide-react icons
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
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm exec tsc --noEmit` | Run the TypeScript type check |

The production build does not run type checking (see `next.config.mjs`), so run the type check before committing.

## Project structure

```
app/
  layout.tsx          Root layout and metadata
  page.tsx            Start page
  rider/              Rider app route
components/
  flyt/               Flyt screens and shared components (map, badges, trip cards)
  ui/                 Base UI components
lib/
  api.ts              Data layer used by every screen
  mock-data.ts        Sample firms, drivers, cars, riders, trips and pricing
  pricing.ts          Fare engine
  types.ts            Shared data types
  config.ts           Feature flags and demo settings
  format.ts           Currency, phone and date formatting
  i18n/               Interface text (English; Kinyarwanda and French planned)
public/               Icons and static assets
```

## Architecture notes

- **One data layer.** Screens read and write data only through `lib/api.ts`. It currently uses the sample data in `lib/mock-data.ts`; connecting a real backend means replacing this layer, not the screens.
- **Portable front end.** Next.js is used for routing only. The app avoids server actions, API routes and middleware, so the screens can later be packaged as iOS and Android apps.
- **Feature flags.** Features that are not part of the first release are switched off in `lib/config.ts`:

  | Flag | Default | Controls |
  | --- | --- | --- |
  | `publicSharedRides` | `false` | Shared rides between members of the public |
  | `privateOwnerCars` | `false` | Cars owned by private individuals |
  | `cardPayments` | `false` | Card payments |

## Pricing model

Fares are calculated in `lib/pricing.ts` from the plan values in `lib/mock-data.ts`.

| Rule | Value |
| --- | --- |
| Baseline plan | Rwf 1,500 for the first km, then Rwf 1,000 per km |
| Test plan (pilot) | Rwf 1,200 for the first km, then Rwf 750 per km |
| Shared commute seat | 40% of the private fare for the same distance, billed to the company |
| Hourly and daily hire | Set by each partner firm |
| Airport transfer | Fixed price per zone; private-ride fare where no zone price is set |
| Platform fee | 12% of the fare, paid by the partner firm |

One plan is active at a time. Amounts are shown in Rwandan francs without decimals (for example, Rwf 4,200).

## Roadmap

1. Operations dashboard: overview, dispatch, trips, firms, drivers and cars
2. Driver app: job offers, trip flow, earnings and documents
3. Operations dashboard: riders, companies, shared commutes, pricing, invoices, pilot report, incidents and settings
4. Company portal: staff, trips, invoices and commute routes
5. Backend, authentication and live maps
6. iOS and Android apps

## License

Proprietary. Copyright © 2026 Flyt Ltd. All rights reserved.
