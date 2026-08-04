/**
 * **Dormant.** Nothing in the live app imports this: booking moved to the
 * Telegram bot in `bot/`. Kept intact and type-checked — see
 * `src/archive/README.md` for how to switch it back on.
 *
 * Public surface of the Altegio client. Server-only — see `./config`.
 */
export { AltegioClient, getAltegioClient } from './client';
export {
  ALTEGIO_BASE_URL,
  AltegioConfigError,
  isAltegioConfigured,
  readAltegioConfig,
  type AltegioConfig,
} from './config';
export { AltegioError, type AltegioErrorReason } from './errors';
export type * from './types';
