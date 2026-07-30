/**
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
