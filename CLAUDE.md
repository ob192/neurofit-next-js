# CLAUDE.md

Guidance for AI coding agents working in this repository.

## What this is

Landing page for NeuroFit, a personal-training studio in Chernihiv, Ukraine.
Migrated from a single static `index.html` design export to a Next.js app.

Two deployables:

- **`web/`** — the site. Most work happens here.
- **`bot/`** — the Telegram booking bot (Python, aiogram). Booking is a hand-off
  to it; the site itself books nothing. See `docs/TELEGRAM_BOOKING.md`.

The root `index.html` and `images/` are the original design export, kept for
reference — do not edit them, and do not import from them.

```bash
cd web
npm run dev        # port 3000
npm run build
npm run lint
npm run typecheck
```

```bash
cd bot
pip install -r requirements.txt
python -m app
```

Before claiming a web change works, run `npm run lint` **and** `npm run
typecheck`. The build alone will not catch lint errors.

## Non-negotiables

1. **No CRM, no unrequested external services.** Do not add Supabase, Prisma or
   any provider SDK unless explicitly asked. Four integrations exist and all
   four were requested by the owner: the Telegram bot (`bot/`, aiogram), the
   Postgres the bot keeps its client→topic mapping in (`DATABASE_URL`, Neon,
   asyncpg), the GA4 Measurement Protocol, and, before all of them, Altegio.

   **The website has exactly one server route and one table, and that is the
   whole of its backend.** `/go/tg` logs a click and redirects to the bot; it
   writes `clicks` in the same Postgres and sends `generate_lead`. It replaced
   the rule that used to sit here — "the website has no database and no
   backend" — on the owner's instruction, so that advertising spend could be
   measured against bookings that happen in a Telegram chat. `docs/ANALYTICS.md`
   is the write-up; `docs/CONCESSIONS.md` §22 is the cost.

   That is the extent of it. The landing page is still statically rendered, the
   site still collects no contact details and still books nothing, and the
   `clicks` table holds no personal data. Anything past a click log needs asking
   again. The driver is `pg`, deliberately and not a Neon SDK — a provider SDK
   is still on the list above, and `pg` is what lets `/go/tg` be tested against
   a local Postgres.

   **The Altegio integration is dormant, not deleted.** Nothing in the running
   site imports it. Do not "clean it up" — the owner asked for it to be kept so
   the calendar can come back. It still compiles and is covered by `lint` and
   `typecheck` on every run, which is how it is stopped from rotting. The map of
   what lives where, and the restore procedure, is in
   `web/src/archive/README.md`.
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
├── app/          Routes, layout, globals.css, tokens.css
├── archive/      Dormant code — the Altegio API routes. Never imported.
├── components/   Cross-feature primitives (Icon, Section, Button, Tag, Brand…)
├── content/      All copy + site config as typed data
├── features/     One directory per landing section
└── lib/          date.ts, seo/, and the dormant altegio/, booking/, mock/

bot/app/
├── config.py     Environment, validated at startup
├── content.py    Every string the bot sends
├── keyboards.py  The persistent button + the three format buttons
├── relay.py      The two-way bridge; all Telegram calls for a client
├── storage.py    chat <-> topic mapping, one JSON file
└── handlers/     setup.py (/id), client.py (private), studio.py (group)
```

**Import rule:** `features/*` may import from `components/`, `content/` and
`lib/` — never from another feature. If two features need the same thing, it
belongs in `components/`.

Path alias is `@/*` → `src/*`.

## Conventions

- TypeScript strict, including `noUncheckedIndexedAccess`. Indexing an array
  yields `T | undefined`; handle it rather than reaching for `!`.
- Server components by default. Add `'use client'` only when you need state or
  event handlers — the gallery lightbox (`features/media/GalleryGrid.tsx`) is
  now the only live one, plus the dormant booking widget.
- Prefer a native element over a JS component. The FAQ accordion is
  `<details>`/`<summary>` on purpose; don't "upgrade" it to a client component.
- Comments explain *why*, not *what*. Match the density of the surrounding file.

## Analytics

**The conversion is measured on the server, because that is where it happens.**
Every CTA goes through `/go/tg`, which reads GA4's first-party cookies and the
campaign parameters off the `Referer`, writes a `clicks` row and hands its id to
the bot as the `/start` payload. The bot reports the rest of the funnel through
the Measurement Protocol. Full write-up: `docs/ANALYTICS.md`.

- **Four events, four names**: `generate_lead` (the click, from the site),
  `working_lead` (a format asked for in the bot), `qualify_lead` and
  `close_convert_lead` (a manager's `/qualified` and `/booked`). They are all
  GA4 key events; reusing one name across stages counts one client several
  times.
- **`rel="noopener"`, never `noreferrer`, on links built by `bookingHref()`.**
  `noreferrer` strips the header the campaign parameters are read from.
- **`client_id` is the browser's, from the click row.** Never invent one — a
  minted id files the booking as a new user from "direct / none".
- **`session_id` only on events inside that visit.** `Relay._live_session()`
  drops it past 30 minutes. Replaying it makes GA4 believe a two-day session is
  still open.
- **Nothing identifying goes to GA4.** No name, username, Telegram id or message
  text. The join lives in Postgres.
- **The `clicks` schema is owned by the bot**, which creates it at startup, and
  written by the site. Deploy the bot first. A missing table degrades to plain
  `t.me` deep links rather than failing.

## Booking

**Booking is a hand-off to Telegram.** Every "Записатися" CTA on the site is a
`t.me` link to `@neurofit_booking_bot`; a manager confirms the time in chat. The
site collects no contact details and books nothing. Full write-up:
`docs/TELEGRAM_BOOKING.md`.

- The link is built by `telegramBookingHref()` in `src/content/site.ts` — never
  hardcode a `t.me` URL. The handle comes from `NEXT_PUBLIC_TELEGRAM_BOT`.
- Service CTAs pass the service id as the bot's `/start` payload, so `ems`,
  `boxing` and `stretching` are **shared vocabulary** between
  `web/src/content/services.ts` and `bot/app/content.py`. Renaming one without
  the other silently downgrades those links to a generic prompt.
- `services.ts` still carries `bookable: false` on EMS Boxing. Nothing live
  reads it; the bot offers all three formats. It is left alone so the archived
  widget behaves as it did if restored.
- All bot copy lives in `bot/app/content.py`, for the same reason the site's
  copy lives in `src/content/` — the studio must be able to reword it without
  reading logic.

### The dormant Altegio stack

Kept on the owner's instruction, imported by nothing. `web/src/archive/README.md`
is the map and the restore procedure. What still holds if it is ever revived:

- **`src/lib/altegio/`** — a typed, server-only `fetch` wrapper over the Altegio
  *public* booking API. It can read the catalogue and availability and create
  bookings; it **cannot** cancel them or list existing appointments (that needs
  a business-user token we don't hold).
- **`src/lib/booking/`** — maps the site's model onto Altegio and picks the
  backend (live when env is set, `src/lib/mock/` otherwise).
- Mapping rules agreed with the owner — all three formats book the one Altegio
  service «Основне тренування» (`12935553`) with the format written into the
  appointment comment; bookable trainers are **Вікторія** and **Аліна** only
  (**Лідія**, `2879290`, is deliberately excluded); slots are 30 min from
  `book_dates`/`book_times`.

**Do not run both flows at once without deciding what owns the calendar.** They
share no state, so a slot a manager fills from a Telegram request is invisible
to Altegio.

## Things that will bite you

- **The bot's format ids are the site's service ids.** `ems`, `boxing`,
  `stretching` appear in `web/src/content/services.ts` *and* in
  `bot/app/content.py`, joined by the `?start=` deep link. Nothing checks that
  they still match; a rename shows up as CTAs that stopped preselecting.
- **The bot must be a group administrator.** Telegram's privacy mode means a
  non-admin bot never sees managers' replies, so the studio → client direction
  silently dies. `verify_group()` refuses to start without it.
- **Prices exist twice.** `web/src/content/pricing.ts` and the `PRICES` block in
  `bot/app/content.py`. Nothing keeps them in sync, and a stale price quoted in
  chat is worse than one on a page. Update both, and check the per-session
  figures still divide evenly.
- **The bot's format ids are also the `clicks.service_id` values.** The site
  writes `ems`/`boxing`/`stretching` into the click row and the bot reads the
  format back off it, so the shared vocabulary now has a third place it has to
  agree — see `docs/ANALYTICS.md`.
- **`/qualified` and `/booked` must be registered before the studio router.**
  `studio.on_manager_message` returns early on any line starting with `/`, so a
  command router placed after it is silently swallowed. Same trap `/id` has, same
  fix — see `handlers/commands.py`.
- **A manager's mark reports to GA4 once.** `qualified_at` and `booked_at` are
  stamped on the client row and coalesced in `put()` so they can only go from
  unset to set. Clearing one would let the same conversion be counted twice.
- **Run exactly one bot instance.** Two processes polling one token fight over
  `getUpdates` — Telegram 409s the loser and splits updates unpredictably
  between them. Before Postgres that also meant two disjoint state stores and a
  duplicate topic per client; they share state now, but the fight still drops
  work. If topics start duplicating, look for a second instance first.
- **Losing the client→topic mapping costs real money.** The Bot API cannot list
  forum topics, so a forgotten client gets a *new* topic and their history is
  stranded. Production keeps it in Postgres for that reason. The JSON fallback
  (`BOT_STATE_FILE`, used when `DATABASE_URL` is unset) is for tests and
  laptops — in Docker it needs a volume at `/data`, and `BOT_STATE_FILE` must
  stay unset so the image's own path wins.

The rest of this list concerns the **dormant** calendar. It is still true, and
still worth reading before restoring it, but none of it is live today.

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

- `docs/TELEGRAM_BOOKING.md` — why booking left the page, and how to undo it
- `bot/README.md` — the bot: flow, setup, deployment, what managers need to know
- `web/src/archive/README.md` — what is dormant and how to switch it back on
- `docs/ARCHITECTURE.md` — how it's built and why
- `docs/CONCESSIONS.md` — every deliberate deviation and its cost to undo
- `docs/CURRENT_STATE.md` — what's done, what's mocked, known bugs, launch blockers

There are three known bugs in the calendar's edge behaviour (seed window shorter
than the booking horizon, beyond-horizon days mislabelled `past`, unbounded
forward month navigation). They're described in `docs/CURRENT_STATE.md` — check
there before "fixing" something that's already logged. All three are in the
dormant calendar, so none of them affects anything the site currently renders.
