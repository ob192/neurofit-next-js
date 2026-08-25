# Analytics

How a click on an ad becomes a number in GA4, given that the thing being
measured — someone booking a training session — happens in a Telegram chat that
no browser ever sees.

## The problem this solves

Booking left the website for the bot (`docs/TELEGRAM_BOOKING.md`). That move
took the conversion with it. The container still had a `generate_lead` tag
wired to `booking_submitted`, but the only code that pushed that event lives in
the retired on-page calendar, so **the studio's key event recorded nothing from
the day booking moved until this was built**.

Meanwhile the two halves each knew half of what was needed:

- the **browser** knew the campaign — the `gclid`, the UTM tags, the GA4 visitor
  and session ids — and never saw the booking
- the **bot** saw the booking, and had no idea where the person came from

## The shape

```
  visitor clicks "Записатися"
        │
        ▼
  GET /go/tg?s=ems                    web/src/app/go/tg/route.ts
        │  reads _ga + _ga_<stream> cookies      (first-party: our own domain)
        │  reads gclid / utm_* from Referer      (same-origin: full URL is sent)
        │  writes one row  ─────────────────────────────►  clicks   (Postgres)
        │  sends generate_lead ─────────────────────────►  GA4
        ▼
  302 → t.me/<bot>?start=<click id>
        │
        ▼
  /start <click id>                   bot/app/handlers/client.py
        │  claims the row, reads the campaign off it
        │  posts "📣 Реклама: …" into the studio topic
        │  client picks a format → working_lead ────────►  GA4
        ▼
  manager types /qualified            bot/app/handlers/commands.py
        │                              → qualify_lead ──►  GA4
  manager types /booked
                                       → close_convert_lead ► GA4
```

## Why the redirect exists

The CTAs used to point straight at `t.me`. They now point at `/go/tg` on our own
domain, and the whole reason is that being first-party is what makes the click
readable **without any JavaScript**:

| Wanted | Where it comes from | Why it needs same-origin |
| --- | --- | --- |
| GA4 visitor id | `_ga` cookie | First-party cookie; a cross-site request never sees it |
| GA4 session id | `_ga_DHQ8N6RZ39` cookie | Same |
| `gclid`, `utm_*` | `Referer` header | Browsers send the *full* URL only to the same origin |

The alternative was a click handler reading `document.cookie`, which would have
turned six server-rendered sections into client components to collect data the
server can already see. The landing page is still statically rendered — `next
build` marks only `/go/tg` as dynamic.

**This is why those links carry `rel="noopener"` and not `rel="noreferrer"`.**
`noreferrer` strips the `Referer` header and takes the campaign with it. There
is no window-opener risk being traded away: the first hop is our own page.

### Not a question: should the redirect be delayed so the event can send?

No. The links open in a new tab, so the page is never unloaded; GA4's own
transport is `sendBeacon`, which survives unload anyway; and the event that
matters is sent from the server, after the response, by `after()`. Nothing is
waiting on anything.

## The four events

GA4's own recommended lead-generation names, one per stage, because each is a
key event and one name fired four times would count one client as four
conversions.

| Event | Fired by | When |
| --- | --- | --- |
| `generate_lead` | website, `/go/tg` | Clicked through to the bot |
| `working_lead` | bot, `_record_request()` | Asked for a format — a manager now has something to do |
| `qualify_lead` | bot, `/qualified` | A manager judged them a real prospect |
| `close_convert_lead` | bot, `/booked` | A manager confirmed the appointment |

The last two exist only because a human knows them. The bot can see that
somebody pressed a button; it cannot see that they meant it, and it certainly
cannot see that they turned up.

`/qualified` and `/booked` are typed into the client's topic, take no arguments,
and are answered in the thread — never to the client. Each reports **once**:
the timestamp is stored on the client row, and a manager typing the command
twice is told the mark is already there rather than selling the studio a second
booking.

## Two rules that decide whether the numbers mean anything

**`client_id` must be the browser's own.** It is read from the `_ga` cookie at
the moment of the click and stored on the click row. Mint one in the bot instead
and every booking files as a brand-new user from "direct / none" — the count is
right and every other column is wrong.

**`session_id` only goes on an event that happened during that visit.** The
click did. A manager typing `/qualified` on Thursday about a click from Tuesday
did not, and replaying the id tells GA4 a two-day session is still open, which
corrupts session counts and engagement time for that campaign. `Relay._live_session()`
drops it past GA4's 30-minute timeout, and GA4 then attributes the conversion to
that visitor's earlier campaign touchpoint through its own model — which is the
question being asked.

Also true, and easy to trip over:

- `timestamp_micros` is always *now*. GA4 discards anything older than 72 hours,
  so an event never carries the timestamp of the click it descends from.
- **The live endpoint answers `204` to malformed payloads exactly as it does to
  good ones.** `GA4_DEBUG=1` switches both sides to `/debug/mp/collect`, which
  answers with what is actually wrong. Nothing is recorded while it is on.
- **No personal data reaches GA4.** No name, no username, no Telegram id, no
  message text. Google's terms forbid it, and the studio's record of who this
  person is already lives in Telegram.

## Misconfiguration fails at boot, not at request time

Two different failures produce the same symptom — a CTA redirecting to plain
`t.me/…?start=ems` — and they deserve opposite treatment.

**A database that is down** is handled in the request: the visitor still reaches
the bot on the plain deep link, and a warning is logged. That is deliberate. A
Neon hiccup should cost a row in a report, never a booking.

**A deploy that was never configured** is not a runtime condition, it is a
mistake, and it never heals. It also presents as everything working: every
button goes to the right chat, the site looks perfect, and the reports stay
empty until somebody thinks to read a `Location` header by hand. That is how the
first deploy of this went out.

So `src/instrumentation.ts` runs `assertAnalyticsConfig()` once at startup and a
**production server refuses to boot** if it cannot possibly measure anything. It
names every variable that is wrong and why. Development only warns — the site
has to stay runnable on a laptop with no database, the same reason the bot has a
JSON store — and `ANALYTICS_DISABLED=1` is the deliberate opt-out for a preview
deploy that genuinely should not report.

The check rejects the specific shapes that look valid and are not:

| Rejected | Why it would otherwise pass |
| --- | --- |
| `postgres://user:...@host/db` | A password of three dots is a perfectly valid URL. This is a DSN copied out of documentation without substituting the real value — and it is how this rule came to exist |
| a DSN with no password, no host, or no database | `pg` would accept the string and fail later, per request |
| `mysql://…` | Wrong protocol, right shape |
| `GA4_MEASUREMENT_ID=UA-12345` | The old Universal Analytics format. Silently names a cookie that does not exist, so no click ever records a session |
| an API secret under 10 characters, or containing a placeholder | Ingestion answers `204` to a bad secret exactly as it does to a good one |

**Consequence worth knowing before the next deploy:** the site will not start
until `DATABASE_URL`, `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` are set on its
host. That is the point, but it turns a silent measurement gap into a loud
deploy failure, which is a trade to make on purpose rather than discover.

## The `clicks` table

Owned by the bot (`bot/app/storage.py`), which creates it at startup along with
its own — there is one migration mechanism in this project and the website does
not have it. **Written by the website, read by the bot.**

The practical consequence is a deploy order: **bot first, then the site.** A site
pointed at a database without the table logs nothing and falls back to plain
`t.me/…?start=ems` deep links, which is what the CTAs did before any of this
existed. The visitor gets the same chat either way.

A click is claimed by the first Telegram account to present its id, and refused
to any other. A forwarded link is not a second ad click.

Nothing personal goes in the table: it holds a service id, GA4's identifiers, the
campaign parameters, the landing URL and a user agent. That is why it can be
kept for months.

## Verified

Against a real Postgres and a running dev server, with the payloads checked by
Google's own validation endpoint.

| Check | Result |
| --- | --- |
| `/go/tg?s=ems` → 302 to `t.me/<bot>?start=<22-char id>` | Pass |
| `_ga` / `_ga_<stream>` cookies parsed into client and session ids | Pass |
| `gclid` and `utm_*` read off a same-origin `Referer` | Pass |
| Unknown `?s=` value stored as null, never reaches the payload | Pass |
| Row written with every column populated | Pass |
| `generate_lead` payload accepted by `/debug/mp/collect` (empty `validationMessages`) | Pass |
| `close_convert_lead` without `session_id` accepted the same way | Pass |
| Database unreachable → 302 to the plain `?start=ems` link, no delay | Pass |
| Database restarted under a running server → next click recorded, no restart | Pass |
| Old `clients` table migrated in place by the new `SCHEMA`, rows intact | Pass |
| Bot claims the click the site wrote and reads the format off it | Pass |
| Second chat presenting the same click id is refused | Pass |
| Click aged two days → event sent with `client_id`, without `session_id` | Pass |
| Client with no click → no event sent at all | Pass |
| A bare `put()` cannot clear `click_id`, `qualified_at` or `booked_at` | Pass |
| `next build`: landing page still static, only `/go/tg` dynamic | Pass |
| Production boot refused for: nothing set, a `...` placeholder DSN, no password, no database named, `mysql://`, `UA-` measurement id, missing API secret | Pass |
| Production boot allowed for: a complete configuration, and for `ANALYTICS_DISABLED=1` | Pass |

**Not verified:** ingestion. Every payload above was checked for shape by
Google's validator, which does not check the API secret — no event has been
accepted into the property, because that needs a real `GA4_API_SECRET`. Run with
`GA4_DEBUG=1` first, then watch GA4's Realtime report with it off.

## Still open

- **The container still maps `booking_submitted` → `generate_lead`.** That tag
  now double-counts nothing because nothing pushes the dataLayer event any more,
  but the site sends `generate_lead` itself. Retire the tag, or the day the
  calendar comes back it counts twice.
- **`contact` is not a distinct event.** Phone, Telegram and Instagram clicks
  are all `cta_click` with different `cta_id`s. One GTM tag keyed on that
  attribute would separate them; it is container work, not a deploy.
- **Consent.** `CONCESSIONS.md` §21 already lists the missing banner as a launch
  blocker. This makes it bigger: the Measurement Protocol is server-to-server and
  **cannot be denied by a consent banner**, and the click log is durable. Land
  the banner.
- **No `value` on any event.** A dropped-in number would optimise bidding
  against a figure nobody agreed to. The prices are known; what a lead is worth
  is not.
- **Google Ads offline conversion import.** `gclid` is stored, so a confirmed
  `/booked` could be uploaded straight to Ads, which optimises bidding far
  better than importing a GA4 key event. Not built.
