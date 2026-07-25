# Engineering notes

Architecture of the NeuroFit Next.js app, and the reasoning behind the choices
that aren't self-evident from the code.

## Where this came from

The original was a single 2,536-line `index.html` exported from a design tool
(Pencil). Characteristics that shaped the migration:

- **Tailwind via CDN**, configured with `preflight` disabled, using arbitrary
  values throughout — `bg-[#6D28A8]`, `text-[13.5px]/[normal]`,
  `[flex:1_1_0]`. Effectively inline styles wearing a utility-class costume.
- **406 `<div>`s, no semantic elements.** No `<h1>`, `<button>`, `<a>`, `<form>`,
  `<input>` — anywhere. Headings were divs with a large font size; the phone
  number was not a link.
- **21 unique Lucide icons inlined 37 times**, each with a hardcoded `fill`.
- **Zero JavaScript.** The booking flow, calendar and FAQ accordion were painted
  states: July 2026 with the 24th highlighted, one FAQ row drawn open.
- **A fixed 390px frame**, mobile only.

## Layout structure

```
src/
├── app/                  Routes, layout, global CSS, API handlers
│   ├── layout.tsx        Fonts, metadata, the centred shell
│   ├── page.tsx          Composes the seven sections, emits JSON-LD
│   ├── tokens.css        Design tokens (colours, radii, type)
│   ├── globals.css       Reset + base element styles only
│   └── api/              Mock route handlers
├── components/           Cross-feature primitives (Icon, Section, Button, Tag…)
├── content/              All Ukrainian copy as typed data
├── features/             One directory per landing section
│   ├── hero/  services/  why-ems/  media/  faq/  footer/
│   └── booking/          The only interactive feature
└── lib/                  date/, mock/ (the store), seo/
```

The rule that keeps this honest: **`features/*` may import from `components/`,
`content/` and `lib/`, but never from each other.** A section is deletable by
deleting its directory. `booking/` is the one feature with internal structure
(`components/`, `api.ts`, `types.ts`) because it's the only one with behaviour.

## Styling

CSS Modules, one file per component, colocated. No utility framework.

Every colour, radius and gradient from the export was named once in
`app/tokens.css` and referenced as `var(--color-primary)` thereafter. The
export used `#6D28A8` in 20 places; changing the brand purple is now one line.

Two places where the port deliberately diverges from the export's markup while
producing identical output:

- **Grids instead of hardcoded rows.** The stats block was two flex rows of two;
  the calendar was five rows of seven. Both are now `display: grid`, so adding a
  fifth stat or rendering a 31-day month starting on a Sunday needs no markup
  change.
- **`gap` on a shared `Section` instead of per-section padding.** The section
  band (flex column, gutter padding, background tone) was repeated seven times.

### Fonts

`next/font/google` self-hosts Inter and Montserrat and exposes them as
`--font-body` / `--font-heading`. The export loaded them from the Google Fonts
CDN with a render-blocking `<link>`, costing a third-party connection and a
font-swap layout shift on every visit.

## Rendering strategy

The page is `dynamic = 'force-dynamic'`: it renders per request. The booking
section server-renders live availability, so a cached HTML shell would show
slots that are no longer free.

**The booking section server-renders real data.** `BookingSection` (server)
reads the mock store directly and passes the result to `BookingWidget`
(client) as props. Consequences worth stating:

- The HTML contains a real calendar with real busy days before any JS runs.
- There is no loading spinner on first paint.
- The client makes **zero** requests on mount.

`BookingSection` calls `lib/mock/availability` directly rather than `fetch`ing
its own `/api/availability`. Fetching your own route handler during SSR costs a
full HTTP round-trip and can deadlock a single-worker server. The route
handlers and the server component sit on the same functions instead, so there
is one implementation of availability, not two.

### Client/server split

Only four components are client components, all under `features/booking/`:
`BookingWidget`, `ServicePicker`, `Calendar`, `TimePicker`, plus `BookingForm`.
Everything else — all six other sections — is server-rendered with no JS
shipped.

The FAQ accordion is **native `<details>`/`<summary>`**, not a client component:
no JavaScript, correct keyboard and screen-reader semantics for free, and every
answer stays in the server-rendered DOM. That last point isn't cosmetic — the
page publishes `FAQPage` structured data, and marking up answers that aren't in
the DOM is a structured-data mismatch.

### Avoiding hydration mismatches

Two specific hazards, both handled:

1. **Seed data.** The mock store fabricates booked slots. With `Math.random()`
   the server and client would disagree about which days look busy and React
   would report a mismatch. The store uses a seeded mulberry32 PRNG keyed on the
   current date, so the sequence is identical everywhere.
2. **"Today".** Computed once on the server via `Intl.DateTimeFormat` pinned to
   `Europe/Kyiv`, then passed down as `minMonth`. The client never calls
   `new Date()` to decide what is bookable, so a user in another timezone sees
   the studio's calendar, not their own.

### Derived loading state

`BookingWidget` has no `isLoading` boolean. Data that doesn't match the current
`(service, month, date)` selection *is* the loading state:

```ts
const monthIsStale = monthAvailability.month !== month || …;
const monthLoading  = monthIsStale && !failedKeys.has(monthKey);
```

This falls out of the SSR design — the initial props are already the answer for
the initial selection, so the fetch effects compare against the data rather than
firing on mount. It also avoids calling `setState` synchronously inside an
effect, which React's `react-hooks/set-state-in-effect` rule flags as a
cascading-render hazard. `failedKeys` exists so a failed request doesn't leave
the UI stale-and-therefore-loading forever; any fresh interaction clears it,
which doubles as the retry mechanism.

All fetches use `AbortController` and abort on cleanup, so rapidly switching
service or month can't land an out-of-order response.

## The mock store

`lib/mock/store.ts`. A module-level `Map` hung off `globalThis` under a
`Symbol.for` key — without that, Next's dev-mode module reloading hands you a
fresh empty store on every edit.

Seeded with ~45 days of plausible bookings: roughly a third of slots taken,
weighted towards 17:00–21:00, with ~8% of service-days fully booked so the
calendar has "full" days to show. Reseeds when the studio date rolls over.

Replacing it with a real provider means reimplementing three functions —
`listBookings`, `isSlotTaken`, `createBooking`. Nothing else touches the `Map`.

Constraints encoded in one place (`STUDIO_OPENS`, `STUDIO_CLOSES`,
`SLOT_STEP_MINUTES`, `BOOKING_HORIZON_DAYS`): 07:00–22:00, 10-minute
granularity, 90-day booking horizon. The last bookable start is 21:50 — a
session must finish by closing time — which is why the hour grid shows 07:00
through 21:00 and not the 22:00 chip the design drew.

## Dates

`lib/date.ts` operates on `YYYY-MM-DD` strings, not `Date` objects. Round-tripping
calendar dates through `Date` is the classic source of off-by-one-day bugs
across timezones. Where a weekday is genuinely needed, the lookup anchors at
**UTC noon** so no DST shift can roll the date over.

Ukrainian needs two month forms and the code carries both: nominative for the
calendar header ("Липень 2026") and genitive when a day number precedes it
("25 липня"). Weekdays are Monday-first, matching the design and Ukrainian
convention.

## Accessibility

The export had none of this; it was all `div`s.

- Real landmarks: `<header>`, `<main>`, `<footer>`, `<section aria-labelledby>`.
- One `<h1>`; sections use `<h2>`, cards `<h3>`.
- The service picker is a `radiogroup` with `role="radio"` and `aria-checked`.
- Calendar days carry `aria-label="27 липня — немає вільних місць"`, so an
  unavailable day announces *why*.
- Form inputs have real `<label>`s (visually hidden), `aria-invalid` and
  `aria-describedby` wired to their error messages.
- Icons are `aria-hidden` by default and take a `label` only when they carry
  meaning on their own (the social links).
- `prefers-reduced-motion` zeroes the transition tokens.

## SEO

Metadata comes from the Next Metadata API in `layout.tsx` — title template,
description, canonical, `uk_UA` Open Graph, Twitter card, theme colour. Plus
generated `robots.txt` and `sitemap.xml` (the API routes are disallowed).

`lib/seo/jsonLd.ts` emits one `@graph` with stable `@id`s so the nodes
cross-reference instead of repeating the business three times:

- `Organization` and `WebSite`
- `HealthAndBeautyBusiness` + `ExerciseGym` — address, phone, seven-day
  `openingHoursSpecification`, `sameAs` socials, an `OfferCatalog` of the three
  services, and a `ReserveAction` pointing at `#booking`
- `FAQPage` with all six questions

Business details (name, address, phone) come from `content/site.ts`, the same
source the footer renders from, so the visible NAP and the structured data
cannot drift apart.

**`aggregateRating` and `Review` are deliberately omitted.** The three
testimonials in the Media section are placeholder copy from the design mock with
no verifiable author. Google's structured-data policy treats fabricated review
markup as spam, and the penalty lands on the whole page's rich results — not
just the reviews. Add them when real, attributable reviews exist.

## What the port added that the design didn't have

- **Contact fields.** The mock showed a summary and a "Підтвердити запис" button
  with nothing to submit. A booking needs a name and a callback number, so those
  two (plus an optional comment) were added in the same visual language.
- **Empty, loading, error and success states.** The design drew exactly one
  fully-populated state.
- **Five FAQ answers.** Only the first was written; the rest were drawn
  collapsed with no content. See `docs/CURRENT_STATE.md`.
