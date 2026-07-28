# NeuroFit

Landing page for **NeuroFit**, a personal-training studio in Chernihiv, Ukraine
(EMS training, stretching, boxing). Ukrainian-language, mobile-first, with an
online booking flow backed by a mock API.

```
neurofit/
├── web/            ← the Next.js application (all active development)
├── docs/           ← architecture, concessions, project state
├── index.html      ← the original static design export (reference only)
└── images/         ← source assets for the original export
```

> **Status: not production-ready.** The booking API is a self-contained mock —
> nothing is persisted and no one is notified when a client books. See
> [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Quick start

```bash
cd web && npm install && npm run dev
```

Then open <http://localhost:3000>.

## Documentation

| Document | Answers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How is it built, and why that way? |
| [docs/CONCESSIONS.md](docs/CONCESSIONS.md) | Where does it depart from the design or the ideal, and what would undoing it cost? |
| [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) | What's done, what's mocked, what's broken, what blocks launch? |
| [CLAUDE.md](CLAUDE.md) | Conventions for AI coding agents |

## Scripts

All scripts run from `web/`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` |

`npm run build` will not catch lint errors — run `lint` and `typecheck` too.

## Stack

- **Next.js 16** (App Router), React 19, server-rendered per request
- **TypeScript** strict, with `noUncheckedIndexedAccess`
- **CSS Modules** — one `*.module.css` per component; tokens in
  `src/app/tokens.css`. No CSS framework.
- **next/font** self-hosting Inter and Montserrat
- **No CRM, no database.** Booking data lives in an in-memory mock store.

## Project structure

```
web/src/
├── app/          Routes, layout, globals.css, tokens.css, api/
├── components/   Cross-feature primitives (Icon, Section, Button, Tag, Brand…)
├── content/      All copy + site config as typed data
├── features/     One directory per landing section
└── lib/          date.ts, mock/ (booking store), seo/
```

`features/*` may import from `components/`, `content/` and `lib/` — never from
another feature. Path alias `@/*` → `src/*`.

## Environment

Everything is optional; copy `web/.env.example` to `web/.env.local` to change it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URLs, Open Graph tags, JSON-LD `@id`s |

Set this in production, or search engines will index `localhost` URLs.

## Mock API

Route handlers under `web/src/app/api/`. All responses are JSON. No
authentication, no external service — the store is a `Map` that resets when the
server restarts.

### `GET /api/services`

```json
{ "services": [{ "id": "ems", "name": "EMS-тренування", "shortName": "EMS", "durationMinutes": 30 }] }
```

### `GET /api/availability`

Requires `service`, plus exactly one of `month` or `date`.

```bash
curl 'localhost:3000/api/availability?service=ems&month=2026-07'
curl 'localhost:3000/api/availability?service=ems&date=2026-07-25'
```

Month — one entry per calendar day; `status` is `available` | `full` | `past`:

```json
{ "month": "2026-07", "serviceId": "ems",
  "days": [{ "date": "2026-07-25", "status": "available", "freeSlots": 62 }] }
```

Day — every 10-minute start between 07:00 and 21:50:

```json
{ "date": "2026-07-25", "serviceId": "ems",
  "slots": [{ "time": "09:30", "available": false }] }
```

### `GET /api/bookings`

Optional `service` and `date` filters. Contact details are stripped from the
response.

### `POST /api/bookings`

```bash
curl -X POST localhost:3000/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":"ems","date":"2026-07-25","time":"09:30",
       "name":"Олександр","phone":"095 123 45 67","comment":""}'
```

| Status | Meaning |
| --- | --- |
| `201` | Created. The slot is immediately unavailable to `/api/availability`. |
| `400` | Malformed JSON or unknown service. |
| `409` | `slot_taken` — someone booked it first. |
| `422` | `validation_failed`, with a `fields` map of per-field messages. |

Booking a slot really does remove it from availability, so the flow is
demonstrable end to end without a backend.

## The two things most likely to bite you

1. **Five of the six FAQ answers were written during the migration**, not
   supplied by the studio. They are flagged `drafted: true` in
   `web/src/content/faq.ts`, they ship as `FAQPage` structured data, and they
   make claims about medical contraindications. They need factual review.
2. **The booking API is a mock.** A client who books receives a success screen,
   and nothing else happens.

Both, plus 16 other deliberate trade-offs, are documented in
[docs/CONCESSIONS.md](docs/CONCESSIONS.md).
