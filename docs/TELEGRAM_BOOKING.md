# Booking moved to Telegram

Date: 2026-08-04 · branch `feat/telegram-booking`

The studio asked for the on-page booking calendar to be replaced by a hand-off
to a Telegram bot. Every "Записатися" CTA now opens
[@neurofit_booking_bot](https://t.me/neurofit_booking_bot); a manager confirms
the time in chat.

The Altegio integration is **kept, not deleted** — dormant, compiling, and
documented. See [Restoring Altegio](#restoring-altegio).

## What the visitor sees

| Where | Before | Now |
| --- | --- | --- |
| Hero CTA | scrolls to `#booking` | opens the bot |
| Service card CTA | `/?service=<id>#booking` | opens the bot with `?start=<id>` |
| Pricing CTA | scrolls to `#booking` | opens the bot |
| `#booking` section | calendar, time grid, contact form | three-step explainer, one button, per-format shortcuts, phone fallback |
| JSON-LD `ReserveAction` | `siteUrl/#booking` | the bot's `t.me` URL |

The `#booking` section stays — it is the anchor, it carries the "what to bring"
note, and it is where someone who scrolled instead of pressing the hero CTA
finds the same link.

## What the bot does

Full description in [`bot/README.md`](../bot/README.md). In one paragraph: on
`/start` it greets, installs a single persistent keyboard button «Записатися!»
and offers **EMS**, **EMS Бокс**, **Стретчинг**. Choosing one answers
«Зачекайте, наш менеджер з вами зв'яжеться» and posts a 🆕 request into that
client's own **topic** in the studio's group chat. From then on the topic is the
conversation: anything the client writes is copied into it, anything a manager
writes in it is copied back to the client.

### Three deliberate choices

**Format ids are shared with the website.** `ems`, `boxing`, `stretching` are
the ids in `web/src/content/services.ts`, and the site passes them as the bot's
`/start` payload. Renaming one without the other quietly downgrades the
per-service CTAs to a generic prompt.

**EMS Boxing is bookable again.** The old widget greyed it out (`bookable:
false` in `content/services.ts`) because the Altegio catalogue had no service
for it. A human manager has no such limit, so all three formats are offered.
The flag is left as it is — nothing live reads it, and flipping it would change
the archived widget's behaviour if it is ever restored.

**The bot answers nothing.** No prices, no availability, no advice on
contraindications. Everything a client writes goes to a person. The FAQ risk
recorded in [CONCESSIONS.md](CONCESSIONS.md#3-five-faq-answers-were-written-during-the-migration)
is exactly why: a bot improvising about EMS and pacemakers is a liability.

## Configuration

**Website** — `NEXT_PUBLIC_TELEGRAM_BOT`, the handle without `@`. Optional; the
code falls back to `neurofit_booking_bot`. Set it in the hosting platform's
environment, not in a committed file.

**Bot** — `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_CHAT_ID` in `bot/.env`.
`bot/README.md` walks through obtaining both.

The two halves agree on exactly one thing: the bot handle in the site's links
must be the bot the token belongs to. Nothing checks this automatically.

## What the site lost, and gained

**Lost.** A visitor can no longer see free slots, and no booking is recorded
anywhere machine-readable — a request that a manager misses is simply missed.
The Altegio calendar had neither problem. This is the studio's call; the
trade is a human in the loop for every booking.

**Gained.** The booking section ships no JavaScript, makes no API calls, and the
whole page went back to being **static** — `export const dynamic =
'force-dynamic'` existed only for live availability, so it is gone, and with it
[CONCESSIONS.md §11](CONCESSIONS.md#11-the-whole-page-is-force-dynamic). Contact
details are no longer collected by the site at all, which removes the
lawful-basis question that the missing consent banner
([§21](CONCESSIONS.md)) raised for the booking form.

## Restoring Altegio

Nothing was deleted. The full procedure is in
[`web/src/archive/README.md`](../web/src/archive/README.md); the short version:

| Kept where | What |
| --- | --- |
| `web/src/archive/api/` | the three route handlers, moved out of `app/` so Next stops serving them |
| `web/src/lib/altegio/` | the Altegio API client, in place, unimported |
| `web/src/lib/booking/` | the provider that picks Altegio or the mock |
| `web/src/lib/mock/` | the in-memory store and seeded availability |
| `web/src/features/booking/AltegioBookingSection.tsx` | the old section, renamed |
| `web/src/features/booking/components/` | the calendar widget, untouched |

All of it still type-checks and lints on every run, so it cannot rot silently.

**Before restoring, decide whether the two flows may coexist.** They share no
state: a slot a manager fills from a Telegram request is not written to Altegio,
so running both at once will double-book the studio.
