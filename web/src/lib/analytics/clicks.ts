/**
 * The click log: one row per visitor who clicked through to the booking bot.
 *
 * This is the join that makes server-side conversions worth anything. The
 * browser knows the campaign but never sees the booking; the bot sees the
 * booking but has no idea where the person came from. A short id travels
 * between them as the bot's `/start` payload, and this table is what it points
 * at.
 *
 * **The schema is owned by the bot** (`bot/app/storage.py`), which creates it at
 * startup the same way it creates its own. There is exactly one migration
 * mechanism in this project and it is not here. The practical consequence is a
 * deploy order — bot first, then the site — and a site deployed against a
 * database that has not caught up degrades to plain `t.me/…?start=ems` links
 * rather than failing. See `docs/ANALYTICS.md`.
 *
 * This is the first and only thing the website stores. It is not a CRM and must
 * not grow into one: no names, no phone numbers, no message contents. Those
 * belong to the studio's Telegram, and the reason this table can be kept for
 * months is that it holds none of them.
 */

import { Pool } from 'pg';
import type { ClickAttribution } from './attribution';

/**
 * How long the redirect will wait for the insert.
 *
 * The visitor is standing still until this resolves, so it is deliberately
 * short — a click that reaches Telegram without attribution is a worse
 * measurement, but a click that hangs for five seconds is a worse studio. Neon
 * scales to zero and a cold start can outlast this; the bot holds a pool open,
 * so in production the database is awake.
 */
const INSERT_TIMEOUT_MS = 2500;

/**
 * `pg` rather than a Neon-branded driver, for two reasons.
 *
 * The provider SDK would be the fourth thing on this project's "do not add"
 * list, and it speaks Neon's HTTP protocol only — which means `/go/tg` could
 * not be run against a local Postgres, and the one endpoint that touches money
 * would be untestable anywhere but production. This takes the same
 * `DATABASE_URL` the bot already uses.
 */
let pool: Pool | null = null;

/** 16 random bytes, base64url. Well inside Telegram's 64-character payload. */
export function mintClickId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function connection(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  // One pool for the process, kept small: this writes a single row per click,
  // and the database is shared with a bot that holds its own connections.
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: INSERT_TIMEOUT_MS,
    });

    // Not optional. `pg` emits this when a *idle* connection dies — the
    // database restarting, a pooler recycling, a network blip — and an
    // unhandled 'error' on an EventEmitter takes the whole Node process down
    // with it. The site would go offline because analytics lost a socket.
    pool.on('error', (error) => {
      console.warn('[clicks] idle connection lost: %s', error.message);
    });
  }
  return pool;
}

/** Whether click logging is configured. Unset simply means plain deep links. */
export function isClickLoggingConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Writes one click and returns its id, or `null` if it could not be stored.
 *
 * A `null` is not an error worth showing anyone: the caller falls back to the
 * service id as the `/start` payload, which is what the links carried before
 * any of this existed. The visitor gets the same chat either way.
 */
export async function recordClick(
  attribution: ClickAttribution,
): Promise<string | null> {
  const sql = connection();
  if (!sql) return null;

  const id = mintClickId();

  try {
    await Promise.race([
      sql.query(
        `insert into clicks (
           id, service_id, ga_client_id, ga_session_id, gclid,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           landing_url, user_agent
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          attribution.serviceId,
          attribution.gaClientId,
          attribution.gaSessionId,
          attribution.gclid,
          attribution.utmSource,
          attribution.utmMedium,
          attribution.utmCampaign,
          attribution.utmContent,
          attribution.utmTerm,
          attribution.landingUrl,
          attribution.userAgent,
        ],
      ),
      // `pg`'s own connection timeout does not cover a query that has already
      // started, and this one is on a visitor's critical path.
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), INSERT_TIMEOUT_MS),
      ),
    ]);
    return id;
  } catch (error) {
    console.warn('[clicks] not recorded: %s', String(error));
    return null;
  }
}
