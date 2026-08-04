# `src/archive/` — dormant code

Nothing in here is imported by the running app, and nothing in here is a route.
It is kept, compiling and type-checked, so that the Altegio booking flow can be
switched back on without reconstructing it from git history.

## Why it is dormant

The studio retired the on-page booking calendar. Every "Записатися" CTA now
opens the Telegram bot in [`../../../bot/`](../../../bot/), and a human manager
confirms the time in chat. See [`docs/TELEGRAM_BOOKING.md`](../../../docs/TELEGRAM_BOOKING.md).

## What is here

| Path | Was |
| --- | --- |
| `api/availability/route.ts` | `GET /api/availability` |
| `api/bookings/route.ts` | `GET`/`POST /api/bookings` |
| `api/services/route.ts` | `GET /api/services` |

Moving the route files out of `src/app/` is what deregisters the endpoints —
Next.js only serves `route.ts` under the app directory. The files are otherwise
untouched.

## The rest of the dormant stack

These stayed where they were, because their imports resolve there and moving
them would mean rewriting paths in code we are trying to preserve verbatim.
Nothing in the live tree imports any of them:

- `src/lib/altegio/` — the Altegio public-booking API client
- `src/lib/booking/` — the provider that picks Altegio or the mock
- `src/lib/mock/` — the in-memory store and its seeded availability
- `src/features/booking/AltegioBookingSection.tsx` (+ its `.module.css`)
- `src/features/booking/components/` — the calendar widget
- `src/features/booking/api.ts` — the browser client for the routes above
- `src/features/booking/types.ts` — still the shared vocabulary for all of it

## Turning it back on

1. `git mv src/archive/api src/app/api`
2. In `src/app/page.tsx`, import `AltegioBookingSection` instead of
   `BookingSection`, pass `preselectedService={service}`, and restore the
   `searchParams` prop plus `export const dynamic = 'force-dynamic'` (the
   calendar needs per-request rendering).
3. Point the CTAs back at `#booking` — `features/hero/Hero.tsx`,
   `features/pricing/Pricing.tsx`, `features/services/ServiceCard.tsx`
   (which used `/?service=<id>#booking`), and the `ReserveAction` target in
   `lib/seo/jsonLd.ts`.
4. Set `ALTEGIO_PARTNER_TOKEN` and `ALTEGIO_LOCATION_ID`, or leave them unset to
   run against the mock.

Decide first whether the two flows should coexist. They do not share state: a
slot the manager fills from a Telegram request is not written to Altegio, so
running both at once double-books the studio.
