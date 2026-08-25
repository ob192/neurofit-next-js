/**
 * Runs once when the server starts, before it serves anything.
 *
 * The only thing here is the analytics environment check. It belongs at boot
 * rather than in the request path because the failure it catches — a deploy
 * that cannot record a click — is invisible per-request: every CTA still works,
 * and the reports simply stay empty.
 */

import { assertAnalyticsConfig } from '@/lib/analytics/config';

export function register(): void {
  // `register` also runs in the edge runtime, where none of this applies.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  assertAnalyticsConfig();
}
