# Current state

Last updated: 2026-07-27 · commit `284a5d6`

Status snapshot. For *how it works* see [ARCHITECTURE.md](ARCHITECTURE.md); for
*why it deviates from the design* see [CONCESSIONS.md](CONCESSIONS.md).

## Summary

The static `index.html` export has been migrated to a Next.js 16 app in `web/`.
All seven sections are ported, the booking flow is interactive against a mock
API, and the page is server-rendered with JSON-LD.

`npm run build`, `npm run lint` and `npm run typecheck` all pass clean.

> **Not production-ready.** The booking API is a mock: nothing is persisted, and
> **no one is notified** when a client submits a request. Three known bugs are
> listed below. See [Before launch](#before-launch).

## Done

**Migration**
- [x] Next.js 16 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`)
- [x] All seven sections: Hero, Services, WhyEMS, Booking, Media, FAQ, Footer
- [x] Tailwind CDN removed; CSS Modules per component, tokens in `app/tokens.css`
- [x] 21 icons deduplicated from 37 inline copies into one `currentColor` component
- [x] Google Fonts `<link>` → self-hosted `next/font`
- [x] All Ukrainian copy extracted into typed `src/content/` modules
- [x] Semantic HTML + accessibility (the export was 406 `div`s)
- [x] Responsive: phone base, tablet at 768px, desktop at 1024px

**Booking**
- [x] Service picker, month calendar, hour grid, 10-minute grid, summary, form
- [x] Server-rendered initial availability — no spinner, no fetch on mount
- [x] Submit → success; 409 conflict and 422 per-field validation handled
- [x] Month navigation, service switching, aborted in-flight requests

**Mock API**
- [x] `GET /api/services`
- [x] `GET /api/availability` (by month or by date)
- [x] `GET /api/bookings`, `POST /api/bookings`
- [x] In-memory store, deterministically seeded, stateful within a server run

**SEO**
- [x] Metadata API: title template, description, canonical, Open Graph, Twitter
- [x] JSON-LD: 7 nodes — Organization, WebSite, WebPage,
      HealthAndBeautyBusiness/ExerciseGym, FAQPage and two `ImageObject`s
      (logo, primary image), fully cross-referenced by `@id` with no dangling
      references
- [x] `robots.txt`, `sitemap.xml`
- [x] Google Business Profile tied to the page: `hasMap` + `geo` on the business
      node, and the listing's canonical `?cid=` URL in `sameAs` on both the
      business and the organization
- [x] Location section (`features/location/`) embedding the same listing — the
      map, the visible address and the JSON-LD all read `content/site.ts`
- [x] Favicon set in `public/`: `.ico`, 96px PNG, 180px apple-touch, 192/512
      manifest icons, declared in `layout.tsx`'s `icons`
- [x] `app/manifest.ts` → `/manifest.webmanifest`, built from `content/site.ts`
- [x] Real 1200×630 Open Graph card (`images/og-cover.png`), replacing the hero
      photo that was declared 1200×630 but wasn't
- [x] JSON-LD `logo` now points at the logo rather than the hero photo
- [x] Priced `OfferCatalog` built from `content/pricing.ts`, plus a concrete
      `priceRange` — every figure in the markup is rendered in the DOM

**Pricing**
- [x] EMS and stretching price lists, singles + packages, best-value highlighted
- [ ] **Boxing has no prices.** The studio supplied EMS and stretching only.
      Boxing renders as a service everywhere but is absent from the pricing
      section and carries no `Offer` price in the JSON-LD. Do not interpolate a
      figure from the other two — ask the studio.
- [ ] Stretching packages (4/8/10) are assumed to be *individual* sessions:
      4200 ÷ 10 = 420 against the 500 individual rate is the stated 16%, which
      only works off the individual price. Unconfirmed — the mini-group rate of
      400/person may or may not have its own packages.

## Verified

Manually, against a running dev server. There is no automated test suite.

| Check | Result |
| --- | --- |
| SSR HTML contains headline, booking heading, calendar, FAQ answers, footer NAP | Pass |
| JSON-LD parses; 7 nodes, 6 FAQ questions, 12 offers, correct phone/address | Pass |
| Every `@id` reference in the graph resolves to a node in the same graph | Pass |
| Favicon, apple-touch, manifest icons and OG card all 200 with right MIME | Pass |
| `/manifest.webmanifest` returns `application/manifest+json` and studio copy | Pass |
| 31 calendar cells server-rendered; past and full days disabled | Pass |
| `POST /api/bookings` → 201; slot flips unavailable; repeat → 409 | Pass |
| Validation: bad phone, empty name, past date, off-step time, unknown service | Pass (422/400) |
| Full UI flow: hour → minute → form → submit → success | Pass |
| Booking made through the UI persists and removes the slot | Pass |
| Service switch and month nav refetch and reset dependent state | Pass |
| Map embed resolves to the studio's own listing, not a nearby pin | Pass |
| Location section: no overflow at 375/768/1024; both CTAs ≥44px, equal height | Pass |
| No horizontal overflow at 375px; shell centred at 1166px | Pass |
| Fonts resolve to Montserrat (headings) / Inter (body) | Pass |
| No console errors; no hydration warnings | Pass |

**Not verified:** real devices, any browser other than Chromium, Lighthouse
scores, visual pixel-diff against the original export. No screenshots were
captured — the browser pane was unavailable during the session, so layout was
verified by DOM measurement instead.

## Known issues

Unintentional defects. Deliberate trade-offs are in
[CONCESSIONS.md](CONCESSIONS.md).

1. **The seed window is shorter than the booking horizon.**
   `BOOKING_HORIZON_DAYS` is 90, but `seed()` in `lib/mock/store.ts` only
   populates 45 days. Days 46–90 therefore show as *completely* free, which
   looks obviously synthetic. Fix: seed the full horizon.
2. **Beyond-horizon days are labelled `past`.**
   `getMonthAvailability` assigns `status: 'past'` to any date outside the
   horizon — including dates in the *future*. They render correctly (disabled),
   but the status name is wrong and an `aria-label` explaining *why* the day is
   unavailable is missing. Fix: add a distinct `beyond_horizon` status.
3. **Month navigation has no upper bound.**
   The "next month" button never disables, so you can page to 2030 and find
   every day greyed out with no explanation. The back button is correctly bound
   to the current month. Fix: derive a `maxMonth` from the horizon and disable
   past it.

None of the three break the happy path; all three make the calendar look
untrustworthy at the edges.

## Mocked / not real

Full rationale for each in [CONCESSIONS.md](CONCESSIONS.md).

| Area | Status |
| --- | --- |
| Booking persistence | In-memory `Map`. **Lost on server restart.** |
| Booking notifications | None. Nobody is told a request came in. |
| Booked slots in the calendar | Fabricated by a seeded PRNG |
| CRM / Altegio | Not integrated, by request. Root `.env` holds unused vars. |
| Instagram gallery | Six static Unsplash photos, not the real feed |
| Service card images | Unsplash placeholders from the export |
| Reviews | Placeholder testimonials (rendered, not marked up) |
| Social links | Instagram only. The guessed Facebook/Telegram URLs were removed |
| Address | Confirmed against the Google Business Profile |
| Phone | From the design; still unverified |
| Trainers, pricing, memberships | Not in the design, not built |

## Before launch

Ordered by what blocks what.

1. **Studio reviews the five drafted FAQ answers** (`content/faq.ts`,
   `faqNeedsReview`). They ship as structured data and make medical claims.
2. **Confirm the phone number** in `content/site.ts`. Socials no longer need
   confirming — the guessed Facebook and Telegram URLs were removed rather
   than published as `sameAs` ([CONCESSIONS.md](CONCESSIONS.md) §9), and
   Instagram is confirmed. The address no
   longer needs confirming — the Google Business Profile the studio supplied
   lists "проспект Перемоги, 119А, Чернігів, Чернігівська область, 14000",
   which matches `site.address` field for field. Only the casing differs
   ("Проспект"/"проспект", "119а"/"119А"); the site keeps the design's form.
3. **Replace the mock booking API** with a real backend or the studio's
   provider. Seam:
   [ARCHITECTURE.md](ARCHITECTURE.md#replacing-it-with-a-real-backend).
4. **Add notification on submit** (email / Telegram / SMS). Currently a
   submitted booking reaches no one.
5. Fix the three known issues above.
6. **Set `NEXT_PUBLIC_SITE_URL` on the host.** It is in `web/.env.local` for
   local work (`https://neurofit-chernihiv.restreto-labs.com`), but that file
   is gitignored — the deploy platform needs its own copy. Without it every
   canonical URL, `og:image` and JSON-LD `@id` falls back to `localhost:3000`,
   which is why link previews show no image.
7. Add rate limiting to `POST /api/bookings`; stop `GET /api/bookings` serving
   the schedule anonymously.
8. Replace Unsplash placeholders with real studio photography. The Open Graph
   card would benefit most — it currently composites the logo with a screenshot
   of the page rather than showing the studio.
9. Add a square-cropped favicon. The supplied artwork is a wide logo
   letterboxed into a square, so it is illegible at 16×16
   ([CONCESSIONS.md](CONCESSIONS.md) §20).
10. Add tests for `lib/date.ts` and `lib/mock/availability.ts`.

## Repository

Initialised 2026-07-27; initial commit `284a5d6` on `main`, 78 files. No remote
configured, nothing pushed.

`index.html` and `images/` at the root are the untouched design export, kept for
reference. Nothing in `web/` imports from them — the hero image was copied to
`web/public/images/hero-ems-studio.png`. Safe to delete once the port is signed
off; they are preserved in git history.
