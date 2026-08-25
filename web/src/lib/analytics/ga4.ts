/**
 * GA4 Measurement Protocol — the server-side half of the analytics.
 *
 * The site's conversion no longer happens on the site: a visitor clicks through
 * to Telegram and the request, the qualification and the booking all happen in
 * a chat the browser never sees. Those moments can only reach GA4 from a
 * server, and this is the client that sends them. The bot has its own copy in
 * `bot/app/analytics.py` — same protocol, same rules, different language.
 *
 * Two things make or break attribution here, and both are easy to get wrong:
 *
 * 1. **`client_id` must be the browser's own.** It comes from the first-party
 *    `_ga` cookie. Mint one instead and every lead lands as a brand-new user
 *    from "direct / none" — you learn how many leads you got and nothing about
 *    which campaign paid for them, which is most of the point.
 * 2. **`session_id` only belongs on an event that happens *during* that
 *    session.** The click-through does. A qualification a manager types two
 *    days later does not, and replaying the old session id there tells GA4 the
 *    session is still open. Sent without one, GA4 attributes it to the user's
 *    earlier campaign touchpoint through its own model, which is the answer
 *    that was wanted.
 *
 * Never send anything that identifies a person. Google's terms forbid PII in
 * GA4, and the join we care about — this click, that Telegram account — lives
 * in Postgres where it is nobody else's business.
 *
 * Server-only, enforced by where it is imported from rather than by the
 * `server-only` package: `GA4_API_SECRET` has no `NEXT_PUBLIC_` prefix, so a
 * client component that pulled this in would ship a module that can never send
 * anything. Keep the callers to route handlers.
 */

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';
/** Same payload, but it answers with validation errors instead of a silent 204. */
const DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';

/**
 * The lead funnel, in GA4's own recommended vocabulary.
 *
 * Distinct names rather than one event with a `stage` parameter: each is a key
 * event in GA4, and a single name fired four times over three days would count
 * one lead as four conversions.
 */
export type Ga4EventName =
  /** Clicked through to the bot. Fired by the redirect, inside the session. */
  | 'generate_lead'
  /** Asked for a format inside the bot — a manager now has something to do. */
  | 'working_lead'
  /** A manager marked the conversation as a real prospect. */
  | 'qualify_lead'
  /** A manager confirmed the appointment. */
  | 'close_convert_lead';

export type Ga4Event = {
  name: Ga4EventName;
  params: Record<string, string | number>;
};

type SendOptions = {
  clientId: string;
  /** Omit for anything that happens after the visit has ended — see above. */
  sessionId?: string | null;
  event: Ga4Event;
};

function credentials() {
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_API_SECRET?.trim();
  return measurementId && apiSecret ? { measurementId, apiSecret } : null;
}

/** Whether the Measurement Protocol is configured at all. */
export function isGa4Configured(): boolean {
  return credentials() !== null;
}

/**
 * Sends one event, and never throws.
 *
 * Analytics is not allowed to break a booking: every failure here is logged and
 * swallowed, and an unconfigured environment is a no-op rather than an error.
 * Callers should not await this on the critical path — the redirect hands it to
 * `after()` so the visitor is already on their way to Telegram.
 */
export async function sendGa4Event({
  clientId,
  sessionId,
  event,
}: SendOptions): Promise<void> {
  const config = credentials();
  if (!config) return;

  const body = {
    client_id: clientId,
    // GA4 rejects anything older than 72 hours, so this is always "now" — the
    // time the *event* happened, never the time of the click it descends from.
    timestamp_micros: Date.now() * 1000,
    events: [
      {
        name: event.name,
        params: {
          ...event.params,
          // Without a non-zero engagement time the event is collected but
          // missing from most standard reports.
          engagement_time_msec: 1,
          ...(sessionId ? { session_id: sessionId } : {}),
        },
      },
    ],
  };

  const url = `${
    process.env.GA4_DEBUG === '1' ? DEBUG_ENDPOINT : ENDPOINT
  }?measurement_id=${encodeURIComponent(
    config.measurementId,
  )}&api_secret=${encodeURIComponent(config.apiSecret)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      // The live endpoint answers 204 to valid and invalid payloads alike, so
      // a 2xx here is not evidence the event was accepted. GA4_DEBUG=1 is the
      // only way to find out; keep it on while wiring this up.
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn('[ga4] %s → %d', event.name, response.status);
    } else if (process.env.GA4_DEBUG === '1') {
      console.info('[ga4] %s → %s', event.name, await response.text());
    }
  } catch (error) {
    console.warn('[ga4] %s failed: %s', event.name, String(error));
  }
}
