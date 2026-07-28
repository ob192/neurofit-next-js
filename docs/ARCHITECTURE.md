# Architecture

How the NeuroFit app is put together and why. For *what deviates from the ideal
and why we accepted it*, see [CONCESSIONS.md](CONCESSIONS.md). For *what is
finished and what is broken*, see [CURRENT_STATE.md](CURRENT_STATE.md).

## Where this came from

The original was a single 2,536-line `index.html` exported from a design tool
(Pencil). Four characteristics shaped every decision below:

- **Tailwind via CDN** with `preflight` disabled, using arbitrary values
  throughout — `bg-[#6D28A8]`, `text-[13.5px]/[normal]`, `[flex:1_1_0]`.
  Effectively inline styles wearing a utility-class costume.
- **406 `<div>`s, zero semantic elements.** No `<h1>`, `<button>`, `<a>`,
  `<form>` or `<input>` anywhere. Headings were divs with a large font size;
  the phone number was not a link.
- **21 unique Lucide icons inlined 37 times**, each with a hardcoded `fill`.
- **No JavaScript.** The booking flow, calendar and FAQ accordion were *painted
  states*: July 2026 with the 24th highlighted, one FAQ row drawn open.

The port is therefore less a translation than a reconstruction: the design
supplied the visual target, and the behaviour had to be invented.

## Directory layout

```
web/src/
├── app/                  Routes, layout, global CSS, API handlers
│   ├── layout.tsx        Fonts, metadata, the centred shell
│   ├── page.tsx          Composes the seven sections, emits JSON-LD
│   ├── tokens.css        Design tokens (colours, radii, type, motion)
│   ├── globals.css       Reset + base element styles only
│   └── api/              Mock route handlers
├── components/           Cross-feature primitives
├── content/              All Ukrainian copy as typed data
├── features/             One directory per landing section
│   ├── hero/ services/ why-ems/ media/ faq/ footer/
│   └── booking/          The only interactive feature
└── lib/                  date.ts, mock/ (the store), seo/
```

### The import rule

**`features/*` may import from `components/`, `content/` and `lib/` — never
from another feature.**

This is the constraint that keeps the structure honest. Any section is
deletable by deleting its directory. If two features need the same thing, it
graduates to `components/`. `booking/` is the only feature with internal
structure (`components/`, `api.ts`, `types.ts`) because it is the only one with
behaviour.

Path alias: `@/*` → `src/*`.

### The content layer

No user-facing string lives in a component. `content/` holds the copy as typed
data — `site.ts` (NAP, hours, socials), `services.ts`, `faq.ts`, `reviews.ts`,
`whyEms.ts`, `gallery.ts`.

This exists for one concrete reason beyond tidiness: `content/site.ts` is the
single source for the studio's name, address and phone, and it feeds *both* the
rendered footer *and* the JSON-LD. The visible NAP and the structured data
cannot drift apart, because there is only one of them.

## Rendering strategy

The page is `dynamic = 'force-dynamic'` — rendered per request. The booking
section server-renders live availability, so a cached HTML shell would advertise
slots that are already gone.

### The booking split

`BookingSection` (server) reads the mock store directly and hands the result to
`BookingWidget` (client) as props.

```
BookingSection (server) ──reads──> lib/mock/availability <──reads── /api/availability
      │                                                                    ▲
      └──props──> BookingWidget (client) ──fetch on interaction────────────┘
```

Consequences:

- The HTML contains a real calendar with real busy days before any JS runs.
- No loading spinner on first paint.
- The client issues **zero** requests on mount.

`BookingSection` deliberately does *not* `fetch('/api/availability')` during
SSR. Calling your own route handler server-side costs a full HTTP round-trip and
can deadlock a single-worker server. Both paths sit on the same
`lib/mock/availability` functions, so there is one implementation of
availability rather than two that can disagree.

### Client/server boundary

Five components carry `'use client'`, all under `features/booking/`:
`BookingWidget`, `ServicePicker`, `Calendar`, `TimePicker`, `BookingForm`.

Everything else — six of the seven sections — is server-rendered and ships no
JavaScript. The FAQ accordion is native `<details>`/`<summary>` rather than a
client component: no JS, correct keyboard and screen-reader semantics for free,
and every answer stays in the server-rendered DOM. That last point is
load-bearing, not cosmetic — the page publishes `FAQPage` structured data, and
marking up answers that aren't in the DOM is a structured-data mismatch.

### Two hydration hazards, both handled

1. **Seed data.** The store fabricates booked slots. With `Math.random()` the
   server and client would disagree about which days look busy and React would
   report a mismatch. The store uses a seeded mulberry32 PRNG keyed on the
   current date, so the sequence is identical everywhere.
2. **"Today".** Computed once on the server via `Intl.DateTimeFormat` pinned to
   `Europe/Kyiv`, then passed down as `minMonth`. The client never calls
   `new Date()` to decide what is bookable, so a visitor in another timezone
   sees the studio's calendar rather than their own.

### Derived loading state

`BookingWidget` has no `isLoading` boolean. Data that doesn't match the current
`(service, month, date)` selection *is* the loading state:

```ts
const monthIsStale = monthAvailability.month !== month || …;
const monthLoading = monthIsStale && !failedKeys.has(monthKey);
```

This falls out of the SSR design: the initial props are already the answer for
the initial selection, so the fetch effects compare against the *data* rather
than firing on mount. It also avoids calling `setState` synchronously inside an
effect, which React's `react-hooks/set-state-in-effect` rule flags as a
cascading-render hazard.

`failedKeys` exists so a failed request doesn't leave the UI permanently
stale-and-therefore-loading. Any fresh interaction clears it, which doubles as
the retry mechanism.

All fetches use `AbortController` and abort on cleanup, so rapidly switching
service or month cannot land an out-of-order response.

## Styling

CSS Modules, one file per component, colocated. No utility framework.

Every colour, radius and gradient from the export is named once in
`app/tokens.css` and referenced as `var(--color-primary)` thereafter. The export
used `#6D28A8` in 20 places; changing the brand purple is now one line. A hex
literal appearing in a module is a bug.

`globals.css` is deliberately tiny: box-sizing, margin resets, focus-visible,
and an `.srOnly` utility. The export relied on Tailwind's preflight being
disabled plus a two-rule `<style>` block, so there is little to reproduce.

Two places where the port diverges from the export's markup while producing
identical output:

- **Grids instead of hardcoded rows.** The stats block was two flex rows of
  two; the calendar was five flex rows of seven. Both are now `display: grid`,
  so a fifth stat or a 31-day month starting on a Sunday needs no markup change.
- **A shared `Section` component.** The band (flex column, gutter padding,
  background tone) was repeated seven times with slight drift.

### Fonts

`next/font/google` self-hosts Inter and Montserrat and exposes them as
`--font-body` / `--font-heading`. The export loaded them from the Google CDN
with a render-blocking `<link>`, costing a third-party connection and a
font-swap layout shift on every visit.

## The mock store

`lib/mock/store.ts` — a module-level `Map` hung off `globalThis` under a
`Symbol.for` key. Without that key, Next's dev-mode module reloading hands you a
fresh, empty store on every file save.

Studio constraints live in one place and nothing hardcodes them elsewhere:

| Constant | Value | Meaning |
| --- | --- | --- |
| `STUDIO_OPENS` / `STUDIO_CLOSES` | `07:00` / `22:00` | Opening hours |
| `SLOT_STEP_MINUTES` | `10` | Booking granularity |
| `BOOKING_HORIZON_DAYS` | `90` | How far ahead you may book |

The last bookable start is 21:50 — a session must finish by closing time —
which is why the hour grid runs 07:00 to 21:00.

### Replacing it with a real backend

Three functions form the entire seam:

```ts
listBookings(filter?)                // → Booking[]
isSlotTaken(serviceId, date, time)   // → boolean
createBooking(input)                 // → Booking | null   (null = conflict)
```

Nothing outside `store.ts` touches the `Map`. `lib/mock/availability.ts` derives
month and day views from those three; the route handlers and `BookingSection`
consume `availability.ts`. Swap the three implementations and the rest of the
app is unchanged.

## Dates

`lib/date.ts` operates on `YYYY-MM-DD` **strings**, not `Date` objects.
Round-tripping calendar dates through `Date` is the classic source of
off-by-one-day bugs across timezones. Where a weekday is genuinely needed, the
lookup anchors at **UTC noon** so no DST shift can roll the date over.

Ukrainian needs two month forms and the code carries both: nominative for the
calendar header ("Липень 2026") and genitive when a day number precedes it
("25 липня"). Weekdays are Monday-first, matching the design and Ukrainian
convention.

## Accessibility

The export had none of this; it was 406 divs.

- Real landmarks: `<header>`, `<main>`, `<footer>`, `<section aria-labelledby>`.
- One `<h1>`; sections use `<h2>`, cards `<h3>`.
- The service picker is a `radiogroup` with `role="radio"` / `aria-checked`.
- Calendar days carry `aria-label="27 липня — немає вільних місць"`, so an
  unavailable day announces *why*.
- Inputs have real (visually hidden) `<label>`s, plus `aria-invalid` and
  `aria-describedby` wired to their error messages.
- Icons are `aria-hidden` by default and take a `label` only when they carry
  meaning alone (the footer's social links).
- `prefers-reduced-motion` zeroes the transition tokens.

## SEO

Metadata comes from the Next Metadata API in `layout.tsx`: title template,
description, canonical, `uk_UA` Open Graph, Twitter card, theme colour. Plus
generated `robots.txt` and `sitemap.xml` (API routes disallowed).

`lib/seo/jsonLd.ts` emits one `@graph` with stable `@id`s so nodes
cross-reference rather than repeating the business three times:

- `Organization` and `WebSite` — the brand and the property
- `WebPage` — this one document, `isPartOf` the site and `about` the business.
  It is what carries `primaryImageOfPage`; the FAQ hangs off it rather than off
  the site
- `HealthAndBeautyBusiness` + `ExerciseGym` — address, phone, `geo`, `hasMap`
  pointing at the Google Business Profile, seven-day
  `openingHoursSpecification`, `sameAs` (the Google listing plus socials), an
  `OfferCatalog` of the three services, and a `ReserveAction` at `#booking`
- `FAQPage` with all six questions
- Two `ImageObject`s — the logo and the hero — referenced by `@id` from
  wherever they're needed rather than repeated as bare URLs with dimensions
  that can drift

The rule for adding a node or a property: it must be backed by something on the
page or by `content/site.ts`. `sameAs` uses the Google listing's canonical
`?cid=` URL rather than the `share.google` redirector the studio sent, because
a redirector asserts nothing about identity.

The governing rule: **anything marked up as structured data must be visible in
the rendered DOM.** See [CONCESSIONS.md](CONCESSIONS.md) for what was left out
of the graph on purpose.
