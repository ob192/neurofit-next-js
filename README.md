# NeuroFit

Landing page for **NeuroFit**, a personal-training studio in Chernihiv, Ukraine
(EMS training, stretching, boxing). Ukrainian-language, mobile-first, with an
online booking flow backed by a mock API.

```
neurofit/
├── web/            ← the Next.js application (all active development)
├── index.html      ← the original static design export (reference only)
├── images/         ← source assets for the original export
└── docs/           ← architecture and project-state documentation
```

## Quick start

```bash
cd web && npm install && npm run dev
```

Then open <http://localhost:3000>.

## Scripts

All scripts run from `web/`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` |

## Stack

- **Next.js 16** (App Router) with React 19, server-rendered per request
- **TypeScript**, strict, with `noUncheckedIndexedAccess`
- **CSS Modules** — one `*.module.css` per component, tokens in
  `src/app/tokens.css`. No CSS framework.
- **next/font** self-hosting Inter and Montserrat
- **No CRM, no database.** Booking data lives in an in-memory mock store.

## Environment

Everything is optional; copy `web/.env.example` to `web/.env.local` to change it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URLs, Open Graph tags, JSON-LD `@id`s |

Set `NEXT_PUBLIC_SITE_URL` in production, or search engines will index
`localhost` URLs.

## Mock API

Route handlers under `web/src/app/api/`. All responses are JSON. There is no
authentication and no external service — the store is a `Map` that resets when
the server restarts.

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

Month response — one entry per calendar day, `status` is `available` | `full` | `past`:

```json
{ "month": "2026-07", "serviceId": "ems",
  "days": [{ "date": "2026-07-25", "status": "available", "freeSlots": 62 }] }
```

Day response — every 10-minute start between 07:00 and 22:00:

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

## Documentation

- [`docs/ENGINEERING.md`](docs/ENGINEERING.md) — architecture and the reasoning
  behind the non-obvious decisions
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — what is done, what is
  mocked, and what must happen before launch
- [`CLAUDE.md`](CLAUDE.md) — conventions for AI coding agents

## Before this goes live

See [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) for the full list. The two
that matter most:

1. **Five FAQ answers were written during the migration** and are marked
   `drafted: true` in `web/src/content/faq.ts`. They are published as
   structured data, so the studio must confirm they are factually correct.
2. **The booking API is a mock.** Nothing is persisted or sent to anyone.
