/**
 * Startup validation for the analytics environment.
 *
 * The redirect degrades rather than fails — a visitor whose click cannot be
 * logged still reaches the bot, on the plain `?start=ems` deep link. That is
 * the right behaviour at *request* time: a database hiccup should cost a row in
 * a report, never a booking.
 *
 * It is the wrong behaviour for a **misconfiguration**, because the two look
 * identical from outside and the second one never heals. A site deployed with
 * no `DATABASE_URL` serves every CTA perfectly and measures nothing, for as
 * long as it takes somebody to notice — and the way it was noticed the first
 * time was by reading a `Location` header by hand.
 *
 * So the check runs once, at boot, from `instrumentation.ts`, and refuses to
 * start a production server that cannot possibly work. Same idea as the bot's
 * `config.py` and `verify_group()`: the failures worth being loud about are the
 * ones that otherwise present as everything being fine.
 */

/** Anything that looks like an unsubstituted placeholder rather than a value. */
const PLACEHOLDER = /\.\.\.|<[^>]+>|\bYOUR[_-]|\bxxx+\b|\bchangeme\b/i;

export type ConfigProblem = { variable: string; problem: string };

function checkDatabaseUrl(raw: string | undefined): ConfigProblem[] {
  const variable = 'DATABASE_URL';
  const value = raw?.trim();

  if (!value) {
    return [{ variable, problem: 'not set — no click is recorded and every CTA falls back to a plain deep link' }];
  }

  // Checked before parsing: `postgresql://user:...@host/db` is a *valid* URL
  // whose password is literally three dots, so nothing downstream would object.
  // It is also exactly the shape of a connection string copied out of
  // documentation, which is how this rule came to exist.
  if (PLACEHOLDER.test(value)) {
    return [{ variable, problem: 'contains a placeholder — the value was copied without substituting the real one' }];
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return [{ variable, problem: 'is not a valid URL' }];
  }

  const problems: ConfigProblem[] = [];
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    problems.push({ variable, problem: `has protocol "${url.protocol}" — expected postgres: or postgresql:` });
  }
  if (!url.hostname) problems.push({ variable, problem: 'has no host' });
  if (!url.username) problems.push({ variable, problem: 'has no user' });
  if (!url.password) problems.push({ variable, problem: 'has no password' });
  if (url.pathname.replace('/', '') === '') {
    problems.push({ variable, problem: 'names no database' });
  }
  return problems;
}

function checkGa4(): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_API_SECRET?.trim();

  if (!measurementId) {
    problems.push({
      variable: 'GA4_MEASUREMENT_ID',
      // Worth spelling out: this one is quietly load-bearing twice over.
      problem: 'not set — no generate_lead is sent, and the GA4 session cookie cannot be found, so no click records a session',
    });
  } else if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
    problems.push({ variable: 'GA4_MEASUREMENT_ID', problem: `is "${measurementId}" — expected the G- id of the web stream` });
  }

  if (!apiSecret) {
    problems.push({ variable: 'GA4_API_SECRET', problem: 'not set — no generate_lead is sent' });
  } else if (PLACEHOLDER.test(apiSecret) || apiSecret.length < 10) {
    problems.push({ variable: 'GA4_API_SECRET', problem: 'does not look like a Measurement Protocol secret' });
  }

  return problems;
}

/** Every problem with the analytics environment, in the order to fix them. */
export function analyticsConfigProblems(): ConfigProblem[] {
  return [...checkDatabaseUrl(process.env.DATABASE_URL), ...checkGa4()];
}

/**
 * Refuses to boot a production server that cannot measure anything.
 *
 * Development only warns: the site has to stay runnable on a laptop with no
 * database, which is the same reason the bot has a JSON store. `ANALYTICS_DISABLED=1`
 * is the deliberate opt-out — a preview deploy that genuinely should not report.
 * The one state ruled out is the accidental one: half-configured, in production,
 * looking healthy.
 */
export function assertAnalyticsConfig(): void {
  if (process.env.ANALYTICS_DISABLED === '1') {
    console.warn('[analytics] disabled by ANALYTICS_DISABLED=1 — no clicks logged, no events sent');
    return;
  }

  const problems = analyticsConfigProblems();
  if (problems.length === 0) return;

  const detail = problems.map((p) => `  ${p.variable} ${p.problem}`).join('\n');

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[analytics] not configured — the redirect will fall back to plain deep links:\n${detail}`);
    return;
  }

  throw new Error(
    `Analytics is not configured, so this deploy would record nothing while ` +
      `appearing to work:\n${detail}\n\n` +
      `Set these on the host (server-only — no NEXT_PUBLIC_ prefix). The database ` +
      `is the same one the bot uses; its DSN is in the bot's environment. ` +
      `To run without analytics on purpose, set ANALYTICS_DISABLED=1.`,
  );
}
