# CLAUDE.md

Guidance for AI coding agents working in this repository.

## What this is

Landing page for NeuroFit, a personal-training studio in Chernihiv, Ukraine.
Migrated from a single static `index.html` design export to a Next.js app.

**All work happens in `web/`.** The root `index.html` and `images/` are the
original design export, kept for reference — do not edit them, and do not import
from them.

```bash
cd web
npm run dev        # port 3000
npm run build
npm run lint
npm run typecheck
```

Before claiming a change works, run `npm run lint` **and** `npm run typecheck`.
The build alone will not catch lint errors.

## Non-negotiables

1. **No CRM, no database, no unrequested external services.** Do not add
   Supabase, Prisma or any provider SDK unless explicitly asked. The booking
   backend **is now wired to Altegio (alteg.io)** — added on the owner's
   explicit request — but through a plain `fetch` client (`src/lib/altegio/`),
   **not** an SDK. It is gated by env (`ALTEGIO_PARTNER_TOKEN` +
   `ALTEGIO_LOCATION_ID` in `web/.env.local`); when those are unset the flow
   falls back to the in-memory mock (`src/lib/mock/`), so dev and CI still run
   credential-free. Do not remove the Altegio integration as "unrequested" —
   see `docs/CONCESSIONS.md` and the "Booking backend" section below.
2. **No CSS framework.** No Tailwind, no styled-components, no CSS-in-JS.
   One `*.module.css` per component, colocated.
3. **No new colour/spacing literals.** Add a token to `src/app/tokens.css` and
   reference `var(--…)`. Hex values in a module are a bug.
4. **No user-facing copy in components.** All Ukrainian text lives in
   `src/content/`. Components read from there.
5. **The site is Ukrainian.** All UI strings, `aria-label`s and error messages
   are in Ukrainian. No i18n framework — do not add one unprompted.
6. **Two breakpoints, and only two.** 768px (tablet) and 1024px (desktop),
   written as literals because media queries can't read custom properties.
   Grep for them before inventing a third. Phone-width layout is the base;
   everything above it is layered on with `min-width` queries.

   *(This replaced the original mobile-only-390px rule when the desktop and
   tablet layouts were built. `docs/CONCESSIONS.md` §5 has the history.)*

## Layout

```
web/src/
├── app/          Routes, layout, globals.css, tokens.css, api/
├── components/   Cross-feature primitives (Icon, Section, Button, Tag, Brand…)
├── content/      All copy + site config as typed data
├── features/     One directory per landing section
└── lib/          date.ts, mock/ (booking store), seo/
```

**Import rule:** `features/*` may import from `components/`, `content/` and
`lib/` — never from another feature. If two features need the same thing, it
belongs in `components/`.

Path alias is `@/*` → `src/*`.

## Conventions

- TypeScript strict, including `noUncheckedIndexedAccess`. Indexing an array
  yields `T | undefined`; handle it rather than reaching for `!`.
- Server components by default. Add `'use client'` only when you need state or
  event handlers — currently only under `features/booking/`.
- Prefer a native element over a JS component. The FAQ accordion is
  `<details>`/`<summary>` on purpose; don't "upgrade" it to a client component.
- Comments explain *why*, not *what*. Match the density of the surrounding file.

## Booking backend

The booking flow has two interchangeable backends behind one provider
(`src/lib/booking/`). Route handlers and the server-rendered `BookingSection`
call the provider — never a backend directly.

- **`src/lib/altegio/`** — a typed, server-only `fetch` wrapper over the Altegio
  *public* booking API (`Bearer {partner_token}`). It can read the catalogue and
  availability and create bookings; it **cannot** cancel them or list existing
  appointments (that needs a business-user token we don't hold). Treat a created
  booking as irreversible via this app.
- **`src/lib/booking/`** — maps the site's model onto Altegio and picks the
  backend. Live when env is set, mock otherwise.

Mapping rules (in `src/lib/booking/mapping.ts` + `src/content/trainers.ts`),
agreed with the owner — don't "correct" them to match the raw Altegio catalogue:

- All three marketing formats (EMS, Стретчинг, **EMS Boxing**) book the **one**
  Altegio service «Основне тренування» (`12935553`). The chosen format is written
  into the appointment **comment** (`"EMS Boxing — <client note>"`).
- Bookable trainers are **Вікторія** and **Аліна** only. Altegio staff **Лідія**
  (`2879290`) is deliberately excluded — she is not a bookable trainer.
- Slots are **30 min** (Altegio's grid); the calendar/times come straight from
  `book_dates`/`book_times`, so it reflects the studio's real schedule.

`GET /api/bookings` returns 501 on the live backend by design (no public listing;
would leak PII). The mock still serves it for local demos.

## Things that will bite you

- **Dates are `YYYY-MM-DD` strings, not `Date` objects.** Use `lib/date.ts`.
  Converting to `Date` and back introduces off-by-one-day bugs across
  timezones. Weekday lookups anchor at UTC noon to survive DST.
- **"Today" is Kyiv time**, from `studioToday()`, computed on the server and
  passed down. Never call `new Date()` client-side to decide what's bookable.
- **The mock store's seed data must stay deterministic.** It uses a seeded
  mulberry32 PRNG precisely so SSR and hydration agree on which days look busy.
  Introducing `Math.random()` into that path causes hydration mismatches.
- **The store lives on `globalThis`** under a `Symbol.for` key so dev-mode module
  reloading doesn't silently reset it.
- **Don't `fetch` your own API routes during SSR.** `BookingSection` calls
  `lib/mock/availability` directly. Server components and route handlers share
  those functions; keep it that way.
- **`BookingWidget` has no `isLoading` state, on purpose.** Loading is derived
  from whether the data matches the current selection. Adding a `setState` at
  the top of those effects trips `react-hooks/set-state-in-effect`.
- **`src/components/Icon/iconPaths.ts` is generated** from the original export.
  Don't hand-edit it.

## Structured data

`lib/seo/jsonLd.ts` builds the schema.org graph. Two rules:

- Business details come from `content/site.ts` — the same source the footer
  renders. Never hardcode the address or phone in the JSON-LD; the visible NAP
  and the markup must not drift.
- **Do not add `aggregateRating` or `Review` nodes.** The testimonials are
  placeholder copy with no verifiable author, and fabricated review markup is
  treated as spam by search engines — the penalty hits the whole page. This is
  documented in `content/reviews.ts` and `lib/seo/jsonLd.ts`.

Anything marked up as structured data must also be visible in the rendered DOM.

## Content caution

Five of the six FAQ answers were **written during the migration**, not supplied
by the studio. They are flagged `drafted: true` in `content/faq.ts` and are
published as `FAQPage` structured data.

If you touch FAQ content, keep the flags accurate. Do not invent further factual
claims about pricing, medical safety, or contraindications — flag them for the
studio instead.

## More context

- `docs/ARCHITECTURE.md` — how it's built and why
- `docs/CONCESSIONS.md` — every deliberate deviation and its cost to undo
- `docs/CURRENT_STATE.md` — what's done, what's mocked, known bugs, launch blockers

There are three known bugs in the calendar's edge behaviour (seed window shorter
than the booking horizon, beyond-horizon days mislabelled `past`, unbounded
forward month navigation). They're described in `docs/CURRENT_STATE.md` — check
there before "fixing" something that's already logged.
