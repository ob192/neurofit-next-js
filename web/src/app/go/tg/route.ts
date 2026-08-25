import { after, NextResponse, type NextRequest } from 'next/server';
import { isServiceId, type ServiceId } from '@/content/services';
import { telegramBookingHref } from '@/content/site';
import { fallbackClientId, readAttribution } from '@/lib/analytics/attribution';
import { recordClick } from '@/lib/analytics/clicks';
import { sendGa4Event } from '@/lib/analytics/ga4';

export const dynamic = 'force-dynamic';

/**
 * GET /go/tg           → the bot, no format preselected
 * GET /go/tg?s=ems     → the bot, opening on that format
 *
 * Every "Записатися" CTA on the site points here instead of at `t.me`
 * directly, for two reasons that both come down to being on our own domain:
 * GA4's cookies are first-party, so this handler can read the visitor's GA4
 * client and session ids, and a same-origin click sends the landing URL in
 * `Referer`, campaign parameters included. Neither is reachable from a static
 * anchor, and collecting them client-side would have meant shipping JavaScript
 * to sections that currently ship none.
 *
 * The click is written to Postgres and its id becomes the bot's `/start`
 * payload, so the conversation that follows can be attributed to the ad that
 * paid for it. `generate_lead` is sent from here — inside the session, with the
 * session id — and the later stages are sent by the bot.
 *
 * Deliberately not an open redirect: the destination is always this studio's
 * bot, built by `telegramBookingHref()`. Nothing from the query string reaches
 * it except a service id checked against `content/services.ts`.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('s') ?? '';
  const serviceId: ServiceId | null = isServiceId(requested) ? requested : null;

  const attribution = readAttribution({
    serviceId,
    cookie: (name) => request.cookies.get(name)?.value,
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
    measurementId: process.env.GA4_MEASUREMENT_ID,
  });

  // Awaited, unlike the analytics below: the id has to exist in the database
  // before the visitor can press Start in Telegram, and that is seconds away.
  const clickId = await recordClick(attribution);

  // Falling back to the service id keeps the deep link doing what it did before
  // any of this existed — the bot still opens on the right format.
  const payload = clickId ?? serviceId ?? undefined;

  const response = NextResponse.redirect(telegramBookingHref(payload), {
    status: 302,
    headers: {
      // The URL carries the click id; Telegram has no use for it and no reason
      // to be told which of our pages the visitor came from.
      'Referrer-Policy': 'no-referrer',
      // A cached redirect would hand a second visitor the first one's click id.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });

  // Runs after the response is on its way, so measuring the click costs the
  // visitor nothing. This is the answer to "should we delay the redirect until
  // the event has been sent" — nothing has to be delayed.
  after(async () => {
    await sendGa4Event({
      clientId: attribution.gaClientId ?? fallbackClientId(),
      sessionId: attribution.gaSessionId,
      event: {
        name: 'generate_lead',
        params: {
          method: 'telegram',
          ...(serviceId ? { service_id: serviceId } : {}),
          ...(clickId ? { click_id: clickId } : {}),
          // True when GA4 never loaded — an ad blocker, or a click that beat
          // the tag. The event still counts; it just cannot be joined to the
          // visitor's other pageviews, and this is how you spot how often.
          unattributed: attribution.gaClientId ? 0 : 1,
        },
      },
    });
  });

  return response;
}
