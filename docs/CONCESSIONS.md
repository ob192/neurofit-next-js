# Concessions

Every place this project knowingly departs from the design, from the brief, or
from what you'd build with unlimited time — and what it would cost to undo.

Everything here is **deliberate**. Unintentional defects live in
[CURRENT_STATE.md](CURRENT_STATE.md#known-issues).

| # | Concession | Driver | Cost to undo |
| --- | --- | --- | --- |
| 1 | No CRM or database; booking is an in-memory mock | Brief | High |
| 2 | Fabricated "booked" slots | No real data | Low |
| 3 | Five FAQ answers written during migration | Design was incomplete | Low |
| 4 | No `Review` / `aggregateRating` markup | Search-spam risk | Low |
| 5 | Mobile-only 390px | Product decision | High |
| 6 | Contact fields invented | Design had none | — |
| 7 | Hour grid stops at 21:00, not 22:00 | Design was wrong | Low |
| 8 | Placeholder imagery | No studio assets | Low |
| 9 | Guessed social URLs | Not supplied | Trivial |
| 10 | Service CTA does a full page navigation | SSR correctness | Low |
| 11 | Whole page is `force-dynamic` | Booking needs live data | Medium |
| 12 | Filled icon paths, not real Lucide strokes | Export format | Medium |
| 13 | No tests | Time | Medium |
| 14 | No i18n framework | Brief | Medium |
| 15 | Dimming instead of skeletons | Scope | Low |
| 16 | Mock API is unauthenticated and unthrottled | Mock | Medium |
| 17 | Hero PNG doubles as the OG image | No social card | Trivial |
| 18 | Original export kept in the repo | Reference | Trivial |

---

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

## 5. Mobile-only, 390px

**What.** One fixed-width column, centred on a purple field on wider screens.
No desktop layout, no tablet breakpoint.

**Why.** Chosen deliberately when scoping the migration; the design only ever
existed at 390px.

**Detail.** The shell is `width: 100%; max-width: 390px`, so viewports narrower
than 390px still fill rather than overflow. Verified with no horizontal overflow
at 375px.

**Undo.** Substantial. Every section is written to a single column; a desktop
layout means real design work, not just breakpoints.

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

## 9. Guessed social URLs

**What.** `content/site.ts` contains Instagram, Facebook and Telegram URLs
inferred from the `@neurofit.cn` handle shown in the design.

**Why.** Only the handle was given; the footer had three social buttons needing
destinations.

**Risk.** These are emitted as `sameAs` in the JSON-LD, where a wrong URL
actively misinforms search engines about the business's identity. Verify before
launch.

## 10. The service CTA does a full page navigation

**What.** "Записатися" on a service card links to `/?service=boxing#booking` —
a real navigation, not client-side state.

**Why.** The server reads `?service=` and renders the booking form with that
service already selected, so the CTA works with JavaScript disabled and the
`#booking` fragment still scrolls correctly. My first attempt was
`#booking?service=boxing`, which is not a valid fragment — the browser looks for
an element with that literal id.

**Trade-off.** A full round-trip instead of an instant in-page update.

## 11. The whole page is `force-dynamic`

**What.** No static generation, no ISR. Every request re-renders everything.

**Why.** The booking section server-renders live availability; a cached shell
would advertise slots that are gone.

**Trade-off.** The six static sections pay for the one dynamic section. Fine at
this traffic level, wasteful at scale.

**Undo.** Make the booking section a streaming `<Suspense>` boundary and let the
rest go static.

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

**Undo.** Rate limiting and spam protection are mandatory before this endpoint
is real. A real `GET /api/bookings` must not serve the schedule anonymously.

## 17. The hero PNG doubles as the Open Graph image

**What.** `og:image` points at `images/hero-ems-studio.png` — an 828 KB PNG at
the wrong aspect ratio, declared as 1200×630 in the metadata.

**Why.** No social card was designed.

**Undo.** Trivial: produce a real 1200×630 card and update `layout.tsx`. The
declared dimensions are currently a lie, so this is worth doing.

## 18. The original export is still in the repo

**What.** `index.html` and `images/` sit at the root, untouched.

**Why.** Reference while the port is reviewed. Nothing in `web/` imports from
them; the hero image was *copied* to `web/public/images/`.

**Undo.** Delete them once the port is signed off — they're preserved in git
history from the initial commit.
