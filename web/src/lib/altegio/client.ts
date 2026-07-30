import { ALTEGIO_BASE_URL, readAltegioConfig, type AltegioConfig } from './config';
import { AltegioError } from './errors';
import type {
  AltegioBookInput,
  AltegioBookResult,
  AltegioDates,
  AltegioEnvelope,
  AltegioServicesResponse,
  AltegioStaff,
  AltegioTime,
} from './types';

/**
 * Thin, typed wrapper over the Altegio public booking API (v1).
 *
 * One method per endpoint we use, each returning the unwrapped `data`. Failures
 * — HTTP errors, `success:false` envelopes, or a dead connection — all throw
 * `AltegioError`, so callers never have to inspect `success` themselves.
 *
 * Rate limits are 200 req/min and 5 req/sec per IP. Read calls therefore pass a
 * short `revalidate` so Next's fetch cache absorbs repeated availability lookups
 * during a browsing session; write calls always bypass the cache.
 */

type QueryValue = string | number | Array<string | number> | undefined;
type Query = Record<string, QueryValue>;

type RequestOptions = {
  method?: 'GET' | 'POST';
  query?: Query;
  body?: unknown;
  /** Seconds to cache the response in Next's data cache. Omit to never cache. */
  revalidate?: number;
  /** Auth mode. `partnerUser` needs a configured user token (management API). */
  auth?: 'partner' | 'partnerUser';
};

function buildQuery(query?: Query): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    // Altegio expects array params as repeated `key[]=v` (e.g. `service_ids[]`).
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export class AltegioClient {
  constructor(private readonly config: AltegioConfig) {}

  private authHeader(mode: 'partner' | 'partnerUser'): string {
    if (mode === 'partnerUser') {
      if (!this.config.userToken) {
        throw new AltegioError(
          0,
          'unauthorized',
          'This call needs a business-user token (ALTEGIO_USER_TOKEN), which is not configured.',
        );
      }
      return `Bearer ${this.config.partnerToken}, User ${this.config.userToken}`;
    }
    return `Bearer ${this.config.partnerToken}`;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body, revalidate, auth = 'partner' } = options;

    const url = `${ALTEGIO_BASE_URL}${path}${buildQuery(query)}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader(auth),
      Accept: 'application/vnd.api.v2+json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const init: RequestInit & { next?: { revalidate: number } } = {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' }),
    };

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw new AltegioError(0, 'network', 'Не вдалося звʼязатися з Altegio.', undefined, {
        cause,
      });
    }

    const envelope = (await response
      .json()
      .catch(() => null)) as AltegioEnvelope<T> | null;

    if (!response.ok || !envelope || envelope.success === false) {
      throw AltegioError.fromResponse(response.status, envelope);
    }

    return envelope.data;
  }

  private get loc(): number {
    return this.config.locationId;
  }

  /** Full bookable catalogue for the location (services + categories). */
  listServices(): Promise<AltegioServicesResponse> {
    return this.request<AltegioServicesResponse>(`/book_services/${this.loc}`, {
      revalidate: 300,
    });
  }

  /** Staff that can perform the given service(s). Empty `serviceIds` → all staff. */
  listStaff(serviceIds: number[] = []): Promise<AltegioStaff[]> {
    return this.request<AltegioStaff[]>(`/book_staff/${this.loc}`, {
      query: serviceIds.length > 0 ? { service_ids: serviceIds } : {},
      revalidate: 300,
    });
  }

  /** Working and bookable dates for a staff member (`staffId: 0` = any). */
  getDates(params: { staffId?: number; serviceIds: number[] }): Promise<AltegioDates> {
    return this.request<AltegioDates>(`/book_dates/${this.loc}`, {
      query: { staff_id: params.staffId ?? 0, service_ids: params.serviceIds },
      revalidate: 60,
    });
  }

  /** Remaining open slots for a staff member on a date (already excludes booked). */
  getTimes(params: {
    staffId?: number;
    serviceId: number;
    date: string;
    /** Pass `revalidate: 0` to force a fresh read (used right before booking). */
    revalidate?: number;
  }): Promise<AltegioTime[]> {
    const staffId = params.staffId ?? 0;
    return this.request<AltegioTime[]>(
      `/book_times/${this.loc}/${staffId}/${params.date}`,
      { query: { service_ids: [params.serviceId] }, revalidate: params.revalidate ?? 60 },
    );
  }

  /**
   * Validate a booking without creating it. Resolves on success (empty 201),
   * throws `AltegioError` otherwise. Prefer this while iterating.
   */
  async checkBooking(appointments: AltegioBookInput['appointments']): Promise<void> {
    await this.request<null>(`/book_check/${this.loc}`, {
      method: 'POST',
      body: { appointments },
    });
  }

  /**
   * Create a REAL, live appointment. It appears in the studio's calendar
   * immediately and cannot be cancelled through the public API — treat it as
   * irreversible. See the `altegio-booking` skill before calling.
   */
  createBooking(input: AltegioBookInput): Promise<AltegioBookResult[]> {
    return this.request<AltegioBookResult[]>(`/book_record/${this.loc}`, {
      method: 'POST',
      body: input,
    });
  }
}

/**
 * Process-wide singleton, hung off `globalThis` so Next's dev-mode module
 * reloading doesn't build a fresh client (and re-read env) on every edit.
 */
const CLIENT_KEY = Symbol.for('neurofit.altegio.client');
type GlobalWithClient = typeof globalThis & { [CLIENT_KEY]?: AltegioClient };

export function getAltegioClient(): AltegioClient {
  const globalWithClient = globalThis as GlobalWithClient;
  if (!globalWithClient[CLIENT_KEY]) {
    globalWithClient[CLIENT_KEY] = new AltegioClient(readAltegioConfig());
  }
  return globalWithClient[CLIENT_KEY];
}
