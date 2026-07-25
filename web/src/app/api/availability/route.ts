import { NextResponse, type NextRequest } from 'next/server';
import { isServiceId } from '@/content/services';
import { getDayAvailability, getMonthAvailability } from '@/lib/mock/availability';
import { isValidIsoDate, isValidMonthKey } from '@/lib/date';
import type { ApiError } from '@/features/booking/types';

export const dynamic = 'force-dynamic';

function badRequest(code: string, error: string) {
  return NextResponse.json<ApiError>({ error, code }, { status: 400 });
}

/**
 * GET /api/availability?service=ems&month=2026-07
 *   → per-day status for the whole month (drives the calendar grid)
 *
 * GET /api/availability?service=ems&date=2026-07-24
 *   → per-slot status for one day (drives the hour + 10-minute grids)
 *
 * Reads through to the same in-memory store the booking POST writes to, so a
 * confirmed booking immediately stops showing up as free here.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const service = params.get('service') ?? '';
  const month = params.get('month');
  const date = params.get('date');

  if (!isServiceId(service)) {
    return badRequest('invalid_service', 'Невідома послуга.');
  }

  if (date) {
    if (!isValidIsoDate(date)) {
      return badRequest('invalid_date', 'Дата має бути у форматі YYYY-MM-DD.');
    }
    return NextResponse.json(getDayAvailability(service, date));
  }

  if (month) {
    if (!isValidMonthKey(month)) {
      return badRequest('invalid_month', 'Місяць має бути у форматі YYYY-MM.');
    }
    return NextResponse.json(getMonthAvailability(service, month));
  }

  return badRequest('missing_range', 'Вкажіть параметр month або date.');
}
