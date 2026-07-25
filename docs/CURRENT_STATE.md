# Current state

Last updated: 2026-07-25

## Summary

The static `index.html` design export has been migrated to a Next.js 16 app in
`web/`. All seven sections are ported, the booking flow is interactive against a
mock API, and the page is server-rendered with JSON-LD structured data.

`npm run build`, `npm run lint` and `npm run typecheck` all pass clean.

**This is not production-ready.** The booking API is a mock: nothing is
persisted, and no one is notified when a client submits a request. See
[Before launch](#before-launch).

## Done

### Migration
- [x] Next.js 16 App Router + React 19 + TypeScript (strict) scaffolded in `web/`
- [x] All seven sections ported: Hero, Services, WhyEMS, Booking, Media, FAQ, Footer
- [x] Tailwind CDN removed; CSS Modules per component, tokens in `app/tokens.css`
- [x] 21 Lucide icons deduplicated into one `Icon` component with `currentColor`
- [x] Google Fonts `<link>` replaced with self-hosted `next/font`
- [x] All Ukrainian copy extracted from markup into typed `src/content/` modules
- [x] Semantic HTML and accessibility added (the export was 406 `div`s)
- [x] Mobile-only 390px layout preserved, centred on wider viewports

### Booking
- [x] Service picker, month calendar, hour grid, 10-minute grid, summary, form
- [x] Server-rendered initial availability — no spinner, no fetch on mount
- [x] Submit → success, with slot-conflict (409) and per-field validation (422) handling
- [x] Month navigation, service switching, aborted in-flight requests

### Mock API
- [x] `GET /api/services`
- [x] `GET /api/availability` (by month or by date)
- [x] `GET /api/bookings`, `POST /api/bookings`
- [x] In-memory store, deterministically seeded, stateful within a server run

### SEO
- [x] Metadata API: title template, description, canonical, Open Graph, Twitter
- [x] JSON-LD graph: Organization, WebSite, HealthAndBeautyBusiness/ExerciseGym, FAQPage
- [x] `robots.txt` and `sitemap.xml`

## Verified

Checked against a running dev server:

| Check | Result |
| --- | --- |
| SSR HTML contains headline, booking heading, calendar, FAQ answers, footer NAP | Pass |
| JSON-LD parses; 4 nodes, 6 FAQ questions, 3 service offers, correct phone/address | Pass |
| 31 calendar day cells server-rendered, past and full days disabled | Pass |
| `POST /api/bookings` → 201, slot flips to unavailable, repeat → 409 | Pass |
| Validation: bad phone, empty name, past date, off-step time, unknown service | Pass (422/400) |
| Full UI flow: pick hour → minute → fill form → submit → success state | Pass |
| Booking made through the UI persists and removes the slot | Pass |
| Service switch and month navigation refetch and reset dependent state | Pass |
| No horizontal overflow at 375px; shell centred at 1166px | Pass |
| Fonts resolve to Montserrat (headings) / Inter (body) | Pass |
| No console errors, no hydration warnings | Pass |

Not verified: real-device testing, cross-browser (only Chromium), Lighthouse
scores, and visual pixel-diffing against the original export.

## Mocked / not real

| Area | Status |
| --- | --- |
| Booking persistence | In-memory `Map`. **Lost on server restart.** |
| Booked slots shown in the calendar | Fabricated by a seeded PRNG, not real |
| Booking notifications | None. Nobody is told a request came in. |
| CRM / Altegio | Not integrated, by request. Root `.env` still holds unused Altegio vars. |
| Instagram gallery | Six static Unsplash photos, not the real feed |
| Service card images | Unsplash placeholders from the design export |
| Reviews | Placeholder testimonials from the mock |
| Social links | Guessed URLs in `content/site.ts` — **need confirming** |
| Address/phone | Taken from the design; assumed correct but unverified |
| Trainers, pricing, memberships | Not in the design, not built |

## Known gaps

1. **Five FAQ answers were written during migration.** The original only had the
   first answer; the other five rows were drawn collapsed and empty. They are
   marked `drafted: true` in `web/src/content/faq.ts` and exported as
   `faqNeedsReview`. They are published as `FAQPage` structured data, so
   incorrect content here is worse than none — the safety claims in
   "Чи безпечні EMS-тренування?" in particular need the studio's sign-off.
2. **No `aggregateRating` / `Review` markup.** Deliberate — see
   `docs/ENGINEERING.md`. Blocked on real reviews.
3. **Desktop is a centred mobile frame,** as specified. There is no desktop
   layout.
4. **No tests.** No unit, integration or e2e coverage. The date helpers and the
   availability logic are the obvious first candidates.
5. **`POST /api/bookings` is unauthenticated and unthrottled.** Fine for a mock;
   a real endpoint needs rate limiting and spam protection.
6. **`GET /api/bookings` lists every booking.** Contact details are stripped,
   but a real implementation must not expose the schedule to anonymous callers.
7. **`NEXT_PUBLIC_SITE_URL` is unset,** so canonical URLs and JSON-LD `@id`s
   currently point at `localhost:3000`.
8. **Only one `<h1>`, but the OG image is the hero photo** (828 KB PNG) rather
   than a purpose-made 1200×630 social card.
9. **Not a git repository.** There is no version history for any of this.

## Before launch

Ordered by what blocks what.

1. Have the studio review the five drafted FAQ answers.
2. Confirm address, phone and social URLs in `web/src/content/site.ts`.
3. Replace the mock booking API with a real backend, or wire it to the studio's
   booking provider. Reimplement `listBookings` / `isSlotTaken` /
   `createBooking` in `lib/mock/store.ts`; nothing else touches the store.
4. Add notification on submit (email/Telegram/SMS) — right now a submitted
   request reaches no one.
5. Set `NEXT_PUBLIC_SITE_URL`.
6. Swap Unsplash placeholders for real studio photography.
7. Add rate limiting to `POST /api/bookings`.
8. Produce a proper 1200×630 Open Graph image.
9. Initialise git.

## Original files

`index.html` and `images/` at the repo root are the untouched design export,
kept for reference. Nothing in `web/` imports from them — the hero image was
copied to `web/public/images/hero-ems-studio.png`. They can be deleted once the
port is signed off.
