/**
 * Altegio (alteg.io) client configuration.
 *
 * SERVER-ONLY. The partner token authenticates against the *public* booking
 * API (`Bearer {partner_token}`): it can read the catalogue and availability
 * and create bookings, but it cannot cancel them or read existing appointments
 * — those need a business-user token on the B2B API, which we deliberately do
 * not wire here (see the `altegio-booking` skill and docs/CONCESSIONS.md).
 *
 * None of these variables carry a `NEXT_PUBLIC_` prefix, so Next never ships
 * the token to the browser. Import this module only from server code (route
 * handlers, server components, server actions).
 */

export const ALTEGIO_BASE_URL = 'https://api.alteg.io/api/v1';

export type AltegioConfig = {
  partnerToken: string;
  locationId: number;
  /** Optional business-user token, for the B2B management API (unused today). */
  userToken?: string;
};

export class AltegioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AltegioConfigError';
  }
}

/**
 * True when both required variables are present. The booking provider uses this
 * to decide between the live Altegio backend and the in-memory mock, so local
 * dev and CI keep working without any credentials.
 */
export function isAltegioConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ALTEGIO_PARTNER_TOKEN?.trim() && env.ALTEGIO_LOCATION_ID?.trim());
}

/** Reads and validates the config, throwing `AltegioConfigError` if malformed. */
export function readAltegioConfig(env: NodeJS.ProcessEnv = process.env): AltegioConfig {
  const partnerToken = env.ALTEGIO_PARTNER_TOKEN?.trim();
  const locationIdRaw = env.ALTEGIO_LOCATION_ID?.trim();
  const userToken = env.ALTEGIO_USER_TOKEN?.trim();

  if (!partnerToken) {
    throw new AltegioConfigError('ALTEGIO_PARTNER_TOKEN is not set.');
  }

  const locationId = Number(locationIdRaw);
  if (!locationIdRaw || !Number.isInteger(locationId) || locationId <= 0) {
    throw new AltegioConfigError('ALTEGIO_LOCATION_ID must be a positive integer.');
  }

  return { partnerToken, locationId, ...(userToken ? { userToken } : {}) };
}
