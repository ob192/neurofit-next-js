# Concessions

Every place this project knowingly departs from the design, from the brief, or
from what you'd build with unlimited time — and what it would cost to undo.

Everything here is **deliberate**. Unintentional defects live in
[CURRENT_STATE.md](CURRENT_STATE.md#known-issues).

| # | Concession | Driver | Cost to undo |
| --- | --- | --- | --- |
| 0 | Booking is a hand-off to Telegram; nothing is booked on the site | Owner | Low |
| 1 | ~~No CRM or database~~ — moot; the site books nothing | Brief | — |
| 2 | Fabricated "booked" slots | No real data | Low |
| 3 | Five FAQ answers written during migration | Design was incomplete | Low |
| 4 | No `Review` / `aggregateRating` markup | Search-spam risk | Low |
| 5 | Mobile-only 390px | Product decision | High |
| 6 | Contact fields invented | Design had none | — |
| 7 | Hour grid stops at 21:00, not 22:00 | Design was wrong | Low |
| 8 | Placeholder imagery | No studio assets | Low |
| 9 | ~~Guessed social URLs~~ — removed | Not supplied | — |
| 10 | Service CTA does a full page navigation | SSR correctness | Low |
| 11 | ~~Whole page is `force-dynamic`~~ — resolved | Booking left the page | — |
| 12 | Filled icon paths, not real Lucide strokes | Export format | Medium |
| 13 | No tests | Time | Medium |
| 14 | No i18n framework | Brief | Medium |
| 15 | Dimming instead of skeletons | Scope | Low |
| 16 | ~~Mock API is unauthenticated~~ — routes unregistered | Mock | — |
| 17 | ~~Hero PNG doubles as the OG image~~ — resolved | No social card | — |
| 18 | Original export kept in the repo | Reference | Trivial |
| 19 | Map is a keyless Google iframe | No API key | Low |
| 20 | Generated `favicon.svg` not shipped | 6.9 MB raster | Low |
| 21 | Analytics ship without a consent banner | Not built | **Blocker** |

---

## 0. Booking is a hand-off to Telegram

**What.** The site books nothing. Every "Записатися" CTA is a `t.me` link to
`@neurofit_booking_bot`; a manager confirms the time in chat. The calendar, the
time grid and the contact form are gone from the page.

**Why.** The studio asked for it — see `docs/TELEGRAM_BOOKING.md`. The
underlying reason is that a manager was already confirming every Altegio
booking by phone, so the calendar was a second source of truth nobody trusted.

**Cost.** A visitor cannot see free slots, and a request that a manager misses
is simply missed — there is no record outside the group chat. Against that: the
booking section ships no JavaScript, the page is static again, and the site
collects no personal data at all.

**Undo.** Nothing was deleted. `web/src/archive/README.md` is the map and the
procedure. Note the two flows share no state, so running both at once
double-books the studio.

## 1. No CRM or database

**What.** `POST /api/bookings` writes to a `Map` on `globalThis`. Restarting the
server erases every booking. Nobody is notified that a request arrived.

**Why.** Explicitly requested: mock API only, no Altegio, no Supabase, no
provider SDK. The root `.env` still holds unused Altegio credentials; nothing
reads them.

**Undo.** Reimplement three functions in `lib/mock/store.ts` — `listBookings`,
`isSlotTaken`, `createBooking`. Nothing else touches the `Map`. The seam is
described in [ARCHITECTURE.md](ARCHITECTURE.md#replacing-it-with-a-real-backend).
Separately, add a notification channel; right now a submitted booking reaches
no one, which is the single most dangerous thing about shipping this as-is.

## 2. Fabricated booked slots

**What.** The calendar's busy days and taken times are invented by a seeded
PRNG: ~⅓ of slots taken, weighted to 17:00–21:00, ~8% of service-days full.

**Why.** An empty calendar demonstrates nothing, and there is no real schedule
to read.

**Undo.** Delete `seed()` from `store.ts`. Note the determinism requirement is
not decorative — see
[ARCHITECTURE.md](ARCHITECTURE.md#two-hydration-hazards-both-handled).

## 3. Five FAQ answers were written during the migration

**What.** The export spelled out one answer ("Що таке EMS-тренування?"). The
other five rows were drawn collapsed and **empty**. Those five answers are mine.

**Why.** A `FAQPage` entry is invalid without an `acceptedAnswer`, and the
section was already committed to structured data.

**Risk.** This is the highest-risk item in the project. The answers make factual
claims about **medical contraindications** (pregnancy, pacemakers, epilepsy),
session length, and what to bring. If any are wrong they are wrong *publicly and
in machine-readable form*.

**Undo.** They are flagged `drafted: true` in `content/faq.ts` and exported as
`faqNeedsReview`. The studio must confirm each one; then clear the flags.

## 4. No `Review` or `aggregateRating` markup

**What.** The three testimonials render visually but are absent from the JSON-LD.

**Why.** They are placeholder copy from the design with no verifiable author.
Google's structured-data policy treats fabricated review markup as spam, and the
penalty applies to the whole page's rich results — not just the review snippet.
Star ratings are the single most tempting thing to fake and the most damaging.

**Undo.** Blocked on real, attributable reviews. Rationale is duplicated in
`content/reviews.ts` and `lib/seo/jsonLd.ts` so nobody "fixes" it by accident.

## 5. Mobile-only, 390px — *resolved, no longer a concession*

**What it was.** One fixed-width column, centred on a purple field on wider
screens. No desktop layout, no tablet breakpoint.

**Why.** Chosen deliberately when scoping the migration; the design only ever
existed at 390px.

**How it ended.** Two problems, in order. First, capping the shell at 390px on
every viewport meant phones between 391px and 429px — iPhone Pro at 393px,
Pixel at 412px, iPhone Plus at 414px — rendered a 1.5–12px strip of dark purple
down each side, too thin to read as a frame. Then tablet and desktop layouts
were requested outright.

**Where it landed.** The shell is full-bleed at every width with no max-width;
each `.section` insets its own content to `--content-max` via
`padding-inline: max(var(--gutter), calc((100% - var(--content-max)) / 2))`, so
backgrounds stay edge to edge while the readable column stays bounded. Sections
that want a narrower measure (FAQ 860px, booking 900px) override
`--content-max` on themselves. Breakpoints are 768px and 1024px.

`Section`'s `padding` prop became `padY` in the process: the old free-form
shorthand was set as an inline style, which outranked the breakpoint rules and
would have silently frozen those sections at their phone padding. `padY` is a
phone-width number that the stylesheet multiplies per breakpoint.

## 6. Contact fields were invented

**What.** Name, phone and an optional comment were added to the booking summary
card.

**Why.** The design drew a summary and a "Підтвердити запис" button with
**nothing to submit** — no inputs anywhere in the file. A booking request needs
a callback number.

They follow the surrounding visual language (translucent white on the purple
card). Phone validation accepts Ukrainian mobile formats with spaces, dashes and
an optional `+38`.

## 7. The hour grid stops at 21:00

**What.** The design drew hour chips 07:00 → 22:00. The app renders 07:00 →
21:00.

**Why.** The studio closes at 22:00 and a session runs 30 minutes, so 22:00 is
not a bookable start. Rendering it would offer a slot that must always fail. The
"7:00 – 22:00" label is retained beside the grid, because *that* is the opening
hours statement and it is correct.

Chosen functional correctness over pixel fidelity.

## 8. Placeholder imagery

**What.** Three service-card photos and six Instagram tiles are Unsplash URLs
carried over from the export. The gallery is static — not the real feed.

**Why.** No studio photography was supplied.

**Undo.** Replace the URLs in `content/services.ts` and `content/gallery.ts`.
Remote images are allow-listed in `next.config.ts`; self-hosting them lets you
drop that entry. Alt text is already written and Ukrainian.

## 9. Guessed social URLs — *resolved by removal*

**What it was.** `content/site.ts` carried Facebook and Telegram URLs inferred
from the `@neurofit.cn` handle shown in the design, because the design drew
three social buttons and only one destination was ever supplied.

**Why it mattered.** Both were emitted as `sameAs` in the JSON-LD. `sameAs` is
an identity assertion — "these profiles are this business" — so a guessed URL
does not merely fail to help, it tells search engines something false about who
the business is. A missing profile is a gap; a wrong one is misinformation.

**Where it landed.** Both removed, from `content/site.ts`, the footer and
`SAME_AS` in `lib/seo/jsonLd.ts`. Instagram — the one account the studio
confirmed — is all that ships.

The footer's social buttons changed shape as a result: they were 42px
icon-only squares, which works for a row of three and reads as an orphan for
one. They now carry a visible label beside the glyph.

**Undo.** Add the real URLs to `site.social`, then to the `socials` list in
`Footer.tsx` and to `SAME_AS`. Do not add a profile that has not been
confirmed by the studio.

## 10. The service CTA does a full page navigation

**What.** "Записатися" on a service card links to `/?service=boxing#booking` —
a real navigation, not client-side state.

**Why.** The server reads `?service=` and renders the booking form with that
service already selected, so the CTA works with JavaScript disabled and the
`#booking` fragment still scrolls correctly. My first attempt was
`#booking?service=boxing`, which is not a valid fragment — the browser looks for
an element with that literal id.

**Trade-off.** A full round-trip instead of an instant in-page update.

## 11. The whole page was `force-dynamic` — *resolved*

**What it was.** No static generation, no ISR. Every request re-rendered
everything, because the booking section server-rendered live availability and a
cached shell would advertise slots that were gone.

**How it ended.** Booking moved to Telegram (§0). With no live data left on the
page, `export const dynamic = 'force-dynamic'` went with it. The page is
prerendered again — `next build` reports `/` as static.

## 12. Filled icon paths rather than real Lucide icons

**What.** `components/Icon/iconPaths.ts` holds 21 single `<path>` glyphs
extracted from the export. Lucide's actual icons are multi-element **stroked**
outlines; the design tool flattened them to filled outlines.

**Why.** Re-deriving them from the real Lucide set risks subtle visual drift
from the approved design.

**Trade-off.** Stroke width cannot be adjusted, and the file is ~45 KB of path
data. `currentColor` was restored, so at least they theme correctly — the export
hardcoded a `fill` on each of the 37 copies.

**Note.** The file is generated. Don't hand-edit it.

## 13. No tests

**What.** No unit, integration or e2e coverage.

**Why.** Time, on a landing page whose logic is mostly presentational.

**Where it hurts.** `lib/date.ts` (timezone and DST edge cases, month
arithmetic) and `lib/mock/availability.ts` are the parts with real logic and
non-obvious failure modes. They are the obvious first targets. Verification so
far has been manual — see
[CURRENT_STATE.md](CURRENT_STATE.md#verified).

## 14. No i18n framework

**What.** Ukrainian strings live directly in `content/`. No `next-intl`, no
locale routing.

**Why.** The site serves one city in one language. A framework would add
indirection for a second locale that may never exist.

**Undo.** Moderate, and the content layer makes it tractable: the strings are
already centralised and typed, so the work is wrapping them rather than hunting
them down in markup.

## 15. Dimming instead of skeletons

**What.** While availability loads, the calendar and time grids drop to 45%
opacity and stop accepting input. No shimmer, no skeleton.

**Why.** The old grid stays in place, so the card keeps its height and the page
doesn't jump. Cheap and stable.

## 16. The mock API is unauthenticated and unthrottled

**What.** Anyone can POST bookings in a loop. `GET /api/bookings` returns the
whole schedule.

**Why.** It's a mock with no real data behind it. Contact details *are* stripped
from `GET` responses, and the endpoint is disallowed in `robots.txt`.

**Status.** Moot for now: the route handlers moved to `src/archive/api/` when
booking went to Telegram, so nothing is served. The warning stands for whoever
restores them — rate limiting and spam protection are mandatory before that
endpoint is real, and a real `GET /api/bookings` must not serve the schedule
anonymously.

## 17. The hero PNG doubled as the Open Graph image — *resolved*

**What it was.** `og:image` pointed at `images/hero-ems-studio.png` and declared
it 1200×630. It was neither: the file was 1408×768, and despite the extension it
was a JPEG. (That file is gone — the hero is now `hero-ems-studio.webp`, a real
studio photo at 1200×1800.)

**Where it landed.** `images/og-cover.png` — a real 1200×630 card, generated by
`favicon/make-og-cover.py` from two assets the studio supplied: the round logo
and a screenshot of the mobile hero, composited onto the site's own hero
gradient. Nothing on it is invented; the headline and tagline are the hero's.

The generated file is committed, so the site build has no Pillow dependency.
Re-run the script if either source asset changes.

**Still imperfect.** The supplied `og-icon.png` is 389×507 — portrait, and well
under the 1200×630 platforms want. It is placed at native size rather than
upscaled, which is why the card is a logo beside a phone-shaped screenshot
instead of a full-bleed photograph. A photograph of the actual studio would be
better than either.

## 20. The generated `favicon.svg` is not shipped

**What.** RealFaviconGenerator produced `favicon/favicon.svg` alongside the PNG
and ICO set. It is not referenced anywhere and was not copied into `public/`.

**Why.** It is not a vector. It is a single 2816×1536 PNG base64-encoded inside
an `<svg>` wrapper — **6.9 MB**, and landscape rather than square. Browsers
prefer an `image/svg+xml` icon over PNG when both are offered, so declaring it
would mean every visitor downloads 6.9 MB for a tab icon and gets a wide,
mostly-empty image squeezed into a 16×16 box.

**Undo.** Author a genuine square vector logo and add it as
`{ url: '/favicon.svg', type: 'image/svg+xml' }` in `layout.tsx`'s `icons.icon`
array. Worth doing — an SVG icon is the only one that stays sharp on high-DPI
tabs.

**Related.** The PNG/ICO icons that *are* shipped have their own problem: the
artwork is the wide NeuroFit logo letterboxed into a square, so at 16×16 it is
roughly 16×9 pixels of detail and illegible. That is the studio's asset, not a
decision made here, but a square-cropped variant (the rabbit badge alone,
without the wordmark) would read far better in a tab. Same reason the manifest
declares `purpose: 'any'` and not `maskable`: the artwork spans the full width
of the canvas, so a maskable crop would slice the wordmark off both ends.

## 18. The original export is still in the repo

**What.** `index.html` and `images/` sit at the root, untouched.

**Why.** Reference while the port is reviewed. Nothing in `web/` imports from
them; the hero image was *copied* to `web/public/images/`.

**Undo.** Delete them once the port is signed off — they're preserved in git
history from the initial commit.

## 19. The map is a keyless Google Maps iframe

**What.** The Location section embeds
`https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s<CID>!3m1!1suk!5m1!1suk` —
the URL Google itself returns for `?cid=<CID>&output=embed`. No API key, no
billing account, no Maps JavaScript SDK.

**Why.** The alternative is the Maps Embed API, which needs a Google Cloud
project, a key restricted by HTTP referrer, and a billing account attached to
somebody at the studio. For one static pin that is a lot of operational surface.

**Trade-off.** Three things.

- It is the only third-party frame on the page. It loads Google's cookies and
  scripts for anyone who scrolls that far, which is why it is `loading="lazy"`
  — it costs nothing above the fold. If a cookie banner ever becomes a
  requirement, this iframe is the reason.
- The `pb` parameter is an undocumented, unversioned Google encoding. It is
  built from `site.google.place`'s CID rather than pasted, so it is
  reconstructible, but nothing stops Google changing the format.
- The frame is not styleable. Its controls stay in Google's design language
  regardless of the tokens around it.

**Undo.** Swap `site.google.embed` for a keyed
`https://www.google.com/maps/embed/v1/place?key=…&q=place_id:…` URL. Nothing
else in `features/location/` changes.

## 21. Analytics ship without a consent banner

**What.** Google Tag Manager (`GTM-PB7X3PL2`) loads on every page and fires GA4
(`G-DHQ8N6RZ39`) unconditionally. There is no cookie banner and no GTM Consent
Mode configuration, so `analytics_storage` is granted by default for everyone.

**Why it is listed here.** GA4 sets a first-party identifier and builds a
per-visitor profile. Under GDPR that needs prior consent for EU visitors, and
Ukraine's own data-protection law points the same way. The studio serves one
city, but the site is publicly reachable and the Google Maps iframe
(§19) already loads Google resources.

**This is the one item in this file that is a launch blocker rather than a
trade-off.** Everything else here degrades quality; this one carries legal
exposure.

**Undo / fix.** Two steps, both in the container rather than the code:

1. Add a consent-banner tag (GTM has CMP templates) and enable Consent Mode v2,
   defaulting `analytics_storage` to `denied`.
2. Mark the GA4 tags as requiring `analytics_storage`.

No application change is needed — which is the reason GTM is loaded instead of
`gtag.js` directly.

**Also unhandled.** Local development traffic is counted: the snippet renders in
every environment. The usual fix is a GA4 internal-traffic filter on the
developer's IP, or gating the `<Script>` on `NODE_ENV === 'production'`.

## 22. Engagement tracking is markup attributes, not React handlers

**What.** CTA clicks and section visibility are tracked from
`data-analytics` / `data-analytics-section` attributes in the rendered HTML.
GTM listens; the app has no click handlers for them.

**Why.** Six of the eight sections are server components that ship no
JavaScript. Attaching `onClick` for analytics would have meant `'use client'`
on Hero, Services, Media, Footer and Location — converting the whole page to a
client bundle to count clicks. The attribute approach keeps that property
intact and costs nothing at runtime.

**Trade-off.** The contract lives in two places — the attribute in the markup
and the trigger in the container — and a rename in one silently stops the
other. The values are therefore stable identifiers, never CSS class names:
CSS Modules hashes class names per build, so a container keyed on
`.Footer-module__x7Kd2__cta` would break on the next deploy with nothing
looking wrong.

The booking funnel is the exception: `BookingWidget` is already a client
component, so it pushes `booking_step` / `booking_submitted` to the dataLayer
directly, typed as a union in `lib/analytics/gtm.ts`.
