/**
 * Every non-2xx or `success:false` response from Altegio surfaces as this.
 *
 * The public API wraps failures in `{ success:false, data:null, meta:{ message }}`
 * and leans on the HTTP status for the class of error. `book_record`/`book_check`
 * add a numeric business code (431–438) for the specific reason; when present it
 * is mapped to a `reason` here so callers don't string-match on messages.
 */

export type AltegioErrorReason =
  | 'network' // request never completed (DNS, timeout, offline)
  | 'unauthorized' // bad/expired token
  | 'rate_limited' // 429 — over 200/min or 5/sec
  | 'invalid_phone' // 431
  | 'bad_sms_code' // 432
  | 'slot_taken' // 433 — the exact slot is already booked
  | 'phone_blacklisted' // 434
  | 'missing_name' // 435
  | 'no_staff' // 436 — no bookable staff for the request (common with staff_id:0)
  | 'overlapping' // 437 — overlapping times inside one request
  | 'service_unavailable' // 438 — service no longer bookable
  | 'not_available' // the chosen date/time is no longer offered
  | 'unknown';

/** Altegio business codes (from book_record/book_check) → reason. */
const CODE_TO_REASON: Record<number, AltegioErrorReason> = {
  431: 'invalid_phone',
  432: 'bad_sms_code',
  433: 'slot_taken',
  434: 'phone_blacklisted',
  435: 'missing_name',
  436: 'no_staff',
  437: 'overlapping',
  438: 'service_unavailable',
};

type AltegioMeta = {
  message?: string;
  /** Some error bodies carry the business code here. */
  code?: number;
  errors?: unknown;
};

type ErrorEnvelope = {
  success?: boolean;
  meta?: AltegioMeta;
} | null;

export class AltegioError extends Error {
  /** HTTP status (0 when the request never completed). */
  readonly status: number;
  readonly reason: AltegioErrorReason;
  /** Raw Altegio business code when present (431–438). */
  readonly code: number | undefined;

  constructor(
    status: number,
    reason: AltegioErrorReason,
    message: string,
    code?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AltegioError';
    this.status = status;
    this.reason = reason;
    this.code = code;
  }

  /** Build from an HTTP status and the (best-effort parsed) error envelope. */
  static fromResponse(status: number, envelope: ErrorEnvelope): AltegioError {
    const meta = envelope?.meta;
    const message = meta?.message?.trim() || `Altegio request failed (HTTP ${status}).`;
    const code = typeof meta?.code === 'number' ? meta.code : undefined;

    let reason: AltegioErrorReason = 'unknown';
    if (code && CODE_TO_REASON[code]) {
      reason = CODE_TO_REASON[code];
    } else if (status === 429) {
      reason = 'rate_limited';
    } else if (status === 401) {
      reason = 'unauthorized';
    } else if (status === 403) {
      // 403/434 is the blacklist case; otherwise it's an auth/permission problem.
      reason = /blacklist|чорн|заблок/i.test(message) ? 'phone_blacklisted' : 'unauthorized';
    } else if (status === 422) {
      // No explicit code — an unlabelled 422 is almost always "this slot/date
      // isn't available any more".
      reason = 'not_available';
    }

    return new AltegioError(status, reason, message, code);
  }
}
