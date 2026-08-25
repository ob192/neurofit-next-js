/**
 * What we can learn about a click without asking the browser to run anything.
 *
 * The redirect endpoint lives on our own domain, which is the whole trick: GA4's
 * cookies are first-party, so the identifiers that tie this click to a GA4
 * session are readable on the server, and a same-origin request sends the full
 * landing URL in `Referer` — campaign parameters included.
 *
 * That is why the CTAs point at `/go/tg` and not straight at `t.me`. The
 * alternative was a client-side handler reading `document.cookie`, which would
 * have turned six server-rendered sections into client components to collect
 * data we can already see.
 */

import type { ServiceId } from '@/content/services';

/** Everything worth keeping about one click through to the bot. */
export type ClickAttribution = {
  serviceId: ServiceId | null;
  /** GA4's own visitor id, from the `_ga` cookie. Null when GA4 never loaded. */
  gaClientId: string | null;
  /** GA4's current session, from the `_ga_<stream>` cookie. */
  gaSessionId: string | null;
  gclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** The page the CTA was clicked on, query string and all. */
  landingUrl: string | null;
  userAgent: string | null;
};

/**
 * `_ga` is `GA1.<depth>.<id-part-1>.<id-part-2>`; the client id is the last
 * two segments joined, e.g. `1234567890.1234567890`. The depth digit varies by
 * how many labels the domain has, so it is skipped rather than matched.
 */
export function parseGaClientId(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length < 4) return null;
  const id = parts.slice(2).join('.');
  return /^\d+\.\d+$/.test(id) ? id : null;
}

/**
 * `_ga_<stream>` is `GS1.1.s1712345678$o5$g1$t1712345680$…`, where the session
 * id is the `s`-prefixed number in the third segment. The `GS1`/`GS2` prefix
 * and the trailing counters have changed shape more than once, so only the one
 * field we need is read.
 */
export function parseGaSessionId(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const segment = cookie.split('.')[2] ?? '';
  const first = segment.split('$')[0] ?? '';
  const id = first.startsWith('s') ? first.slice(1) : first;
  return /^\d+$/.test(id) ? id : null;
}

/** The cookie GA4 keeps the session in, named after the measurement id. */
export function gaSessionCookieName(measurementId: string | undefined): string | null {
  const stream = measurementId?.trim().replace(/^G-/, '');
  return stream ? `_ga_${stream}` : null;
}

/** Trims a value to something a text column and a log line can both hold. */
function trim(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.length > max ? clean.slice(0, max) : clean;
}

type Sources = {
  serviceId: ServiceId | null;
  cookie: (name: string) => string | undefined;
  referer: string | null;
  userAgent: string | null;
  measurementId: string | undefined;
};

/**
 * Reads the campaign parameters off the page the visitor clicked from.
 *
 * Google's click id and the UTM tags arrive on the landing URL and stay there —
 * this is a one-page site, so a visitor who lands from an ad and scrolls to a
 * CTA still has them in the address bar. A visitor who arrived some other way
 * simply has none, which is a real answer, not a gap to fill in.
 */
export function readAttribution({
  serviceId,
  cookie,
  referer,
  userAgent,
  measurementId,
}: Sources): ClickAttribution {
  let params: URLSearchParams | null = null;
  if (referer) {
    try {
      params = new URL(referer).searchParams;
    } catch {
      params = null; // A malformed Referer is not worth a failed redirect.
    }
  }

  const param = (name: string) => trim(params?.get(name), 200);
  const sessionCookie = gaSessionCookieName(measurementId);

  return {
    serviceId,
    gaClientId: parseGaClientId(cookie('_ga')),
    gaSessionId: sessionCookie ? parseGaSessionId(cookie(sessionCookie)) : null,
    gclid: param('gclid') ?? param('wbraid') ?? param('gbraid'),
    utmSource: param('utm_source'),
    utmMedium: param('utm_medium'),
    utmCampaign: param('utm_campaign'),
    utmContent: param('utm_content'),
    utmTerm: param('utm_term'),
    landingUrl: trim(referer, 500),
    userAgent: trim(userAgent, 300),
  };
}

/**
 * A stand-in `client_id` for a visitor GA4 never saw — an ad blocker, or a
 * click before the tag loaded.
 *
 * The event still gets counted, and still carries whatever campaign parameters
 * the URL had; what it loses is the join to that person's earlier pageviews.
 * Shaped like a real one because GA4 rejects anything else.
 */
export function fallbackClientId(): string {
  const random = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  return `${random}.${Math.floor(Date.now() / 1000)}`;
}
