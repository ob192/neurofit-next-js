# Current state

Last updated: 2026-08-04 · branch `feat/telegram-booking`

Status snapshot. For *how it works* see [ARCHITECTURE.md](ARCHITECTURE.md); for
*why it deviates from the design* see [CONCESSIONS.md](CONCESSIONS.md).

## Summary

The static `index.html` export has been migrated to a Next.js 16 app in `web/`.
All seven sections are ported and the page is prerendered as static HTML with
JSON-LD.

**Booking is a hand-off to Telegram.** Every "Записатися" CTA opens
`@neurofit_booking_bot` (`bot/`, Python + aiogram); a manager confirms the time
in chat. The site itself books nothing and collects no contact details. See
[TELEGRAM_BOOKING.md](TELEGRAM_BOOKING.md).

`npm run lint` and `npm run typecheck` pass clean; `make check` runs both plus
the bot's compile check.

> **The Altegio integration is dormant, not deleted.** Nothing imports it, the
> API routes are unregistered, and it all still type-checks. The map and the
> restore procedure are in `web/src/archive/README.md`. The calendar edge-case
> bugs listed below belong to that dormant code — they are not live.

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

**Analytics**
- [x] GTM `GTM-PB7X3PL2` in `layout.tsx` — snippet in `<head>`, noscript iframe
      immediately after `<body>`, exactly as Google's install page specifies
- [x] GA4 `G-DHQ8N6RZ39` configured *in the container*, not in the app
- [x] **Server-side conversions through the Measurement Protocol.** Four key
      events — `generate_lead` from `/go/tg`, `working_lead` when a format is
      asked for in the bot, `qualify_lead` and `close_convert_lead` from a
      manager's `/qualified` and `/booked`. Full write-up in
      [ANALYTICS.md](ANALYTICS.md)
- [x] Click log: `/go/tg` reads GA4's first-party cookies and the campaign
      parameters off the `Referer`, writes a `clicks` row and passes its id to
      the bot as the `/start` payload. No JavaScript, landing page still static
- [ ] ~~Conversion: `booking_submitted` → GA4 `generate_lead`~~ — **was dead.**
      The only `pushEvent` caller is the dormant `BookingWidget`, so this
      recorded nothing from the day booking moved to Telegram until the events
      above were built. **The container tag is still there and should be
      retired** — if the calendar ever comes back it would double-count
- [ ] ~~Funnel: `booking_step` (service → date → time)~~ — dormant with the
      widget, for the same reason
- [ ] `contact` is not a distinct event: phone, Telegram and Instagram clicks
      are all `cta_click` with different `cta_id`s. One container tag away
- [x] Engagement: `cta_click` (11 marked CTAs), `section_view` (all 8
      sections), `scroll_depth` at 25/50/75/90 — all driven by markup
      attributes, so the six server-rendered sections still ship no JavaScript
- [x] GA4 property: currency USD → **UAH**, event retention 2 → **14 months**,
      stream `defaultUri` corrected to the live domain
- [x] Six custom dimensions registered, without which every parameter above is
      collected but invisible in reports
- [ ] **No consent banner.** See [CONCESSIONS.md](CONCESSIONS.md) §21 — this is
      a launch blocker, not a nicety

**Pricing**
- [x] EMS and stretching price lists, singles + packages, best-value highlighted
- [x] **Boxing prices** — supplied by the studio on 2026-08-05, quoted for
      boxing in the EMS suit. Added to `content/pricing.ts` *and* the `PRICES`
      block in `bot/app/content.py`; nothing keeps those two in sync.
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
| GTM snippet: in `<head>`, noscript 79 bytes after `<body>` | Pass |
| GA4 `page_view` reaches `/g/collect` with `tid=G-DHQ8N6RZ39` | Pass |
| `cta_click` fires with correct `cta_id` when a child element is clicked | Pass |
| `booking_step` reaches GA4 with service/step parameters | Pass |
| `generate_lead` carries service, date, time — and no personal data | Pass (dormant widget) |
| `/go/tg` → 302 to `t.me/<bot>?start=<click id>`; row written with cookies, gclid and UTMs | Pass |
| MP payloads accepted by Google's validator, with and without `session_id` | Pass |
| Database down → plain `?start=ems` fallback; back up → recovers with no restart | Pass |
| Bot claims the click, refuses a second chat presenting the same id | Pass |
| Two-day-old click → event keeps `client_id`, drops `session_id` | Pass |
| `next build`: landing page still static, only `/go/tg` dynamic | Pass |
| All 11 CTA and 8 section markers present in the DOM | Pass |
| Fonts resolve to Montserrat (headings) / Inter (body) | Pass |
| No console errors; no hydration warnings | Pass |

**Not verified:** `scroll_depth` and `section_view`. Both depend on scroll
events and `IntersectionObserver`, and the automation pane does not composite
frames — `window.scrollY` moves but no `scroll` event is dispatched and the
observer never reports. The tags and triggers are confirmed present in the
published container; the firing itself needs a real browser to check.

Also not verified: real devices, any browser other than Chromium, Lighthouse
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
untrustworthy at the edges — and all three are in the dormant calendar, so
none of them is reachable today.

### The site and the bot disagree about the session — **live**

On 2026-08-04 the studio confirmed the real shape of a session: **20 minutes of
EMS, then a 10-minute lymphatic-drainage massage**, 30 minutes in total. The bot
says exactly that. The website still presents the whole 30 minutes as EMS:

- `content/hero.ts` — "30 хвилин EMS дають навантаження, порівнянне з 2 годинами
  у звичайному залі", and the proof numerals beside it
- `content/whyEms.ts` — "30 хв · тривалість заняття"
- `content/services.ts` — `durationMinutes: 30` and the "30 хв" tag on EMS
- `content/faq.ts` — the `session-length` answer, still `drafted`, is now known
  to be wrong on both counts: it claims 30 minutes of EMS *and* "close to an
  hour" in total, which the studio has since removed from the bot

A visitor who reads the page and then asks the bot gets two different answers.
Correcting it is a **marketing decision, not a typo fix** — the "30 хвилин = 2
години" claim is the page's strongest argument and restating it at 20 minutes
changes what is being claimed. The studio has to choose the wording; the FAQ
answer should be corrected regardless, since it is drafted, wrong, and shipped
as `FAQPage` structured data.

### ~~Лімфодренажний масаж is priced *and* included~~ — resolved

It is a standalone 450 грн service that comes free with an EMS session. Both
places that mention it now say «бонусом» — the price card in `pricing.ts`, via
the item's `note`, and the bot's price list and what's-included answer — so a
client tapping «Ціни» and «Що входить у вартість» in a row is not left
reconciling them.

## Mocked / not real

Full rationale for each in [CONCESSIONS.md](CONCESSIONS.md).

| Area | Status |
| --- | --- |
| Booking | **Real, but human.** A request reaches a manager in the studio's Telegram group; they confirm the time by hand. Nothing is written to a calendar. |
| Booking record | The group topic *is* the record. `bot/data/state.json` holds only the client→topic mapping. |
| Booking notifications | Telegram itself — the 🆕 request is the only message in a topic that pings. |
| Free slots on the site | **Not shown at all.** The calendar left with the widget. |
| CRM / Altegio | **Dormant.** Kept, compiling, unimported — `web/src/archive/README.md`. |
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
3. **Run the bot somewhere.** `make deploy` publishes
   `sasha192bunin/neurofit-bot`; the host needs `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_GROUP_CHAT_ID` and a volume for the state file. Exactly one
   instance — two pollers on one token fight, and Telegram 409s the loser.
   Until it runs, every CTA on the site opens a bot that answers nothing.
4. **Agree who watches the group.** A missed message is a lost client; there is
   no queue, no reminder and no second channel. Muting the group defeats it.
5. Fix the three known issues above — or don't: they are in dormant code and
   affect nothing until the calendar is restored.
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
9. **Add a consent banner and GTM Consent Mode v2** before any real traffic.
   [CONCESSIONS.md](CONCESSIONS.md) §21.
10. Add a square-cropped favicon. The supplied artwork is a wide logo
   letterboxed into a square, so it is illegible at 16×16
   ([CONCESSIONS.md](CONCESSIONS.md) §20).
11. Add tests for `lib/date.ts` and `lib/mock/availability.ts`.

## Repository

Initialised 2026-07-27; initial commit `284a5d6` on `main`, 78 files. No remote
configured, nothing pushed.

`index.html` and `images/` at the root are the untouched design export, kept for
reference. Nothing in `web/` imports from them. The export's hero image is gone
too: `web/public/images/hero-ems-studio.webp` is now a real studio photo, and
every service card and gallery tile is a studio original under
`web/public/images/gallery/`. Safe to delete once the port is signed off; they
are preserved in git history.
