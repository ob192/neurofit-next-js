import type {
  ApiError,
  BookingRequest,
  DayAvailabilityDetail,
  IsoDate,
  MonthAvailability,
  MonthKey,
} from './types';
import type { ServiceId } from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';

/**
 * Browser-side client for the mock booking API.
 *
 * Kept separate from the components so swapping the mock for a real backend is
 * a change to this file plus the route handlers, and nothing else.
 */

export class BookingApiError extends Error {
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly status: number;

  constructor(status: number, payload: Partial<ApiError>) {
    super(payload.error ?? 'Не вдалося виконати запит. Спробуйте ще раз.');
    this.name = 'BookingApiError';
    this.status = status;
    this.code = payload.code ?? 'unknown';
    this.fields = payload.fields ?? {};
  }
}

async function parseError(response: Response): Promise<never> {
  let payload: Partial<ApiError> = {};
  try {
    payload = (await response.json()) as Partial<ApiError>;
  } catch {
    // Non-JSON error body (proxy timeout, HTML error page) — fall back to the
    // generic message in BookingApiError.
  }
  throw new BookingApiError(response.status, payload);
}

export async function fetchMonthAvailability(
  serviceId: ServiceId,
  trainer: TrainerSelection,
  month: MonthKey,
  signal?: AbortSignal,
): Promise<MonthAvailability> {
  const response = await fetch(
    `/api/availability?service=${serviceId}&trainer=${trainer}&month=${month}`,
    { signal },
  );
  if (!response.ok) return parseError(response);
  return (await response.json()) as MonthAvailability;
}

export async function fetchDayAvailability(
  serviceId: ServiceId,
  trainer: TrainerSelection,
  date: IsoDate,
  signal?: AbortSignal,
): Promise<DayAvailabilityDetail> {
  const response = await fetch(
    `/api/availability?service=${serviceId}&trainer=${trainer}&date=${date}`,
    { signal },
  );
  if (!response.ok) return parseError(response);
  return (await response.json()) as DayAvailabilityDetail;
}

export async function submitBooking(request: BookingRequest): Promise<void> {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) return parseError(response);
}
