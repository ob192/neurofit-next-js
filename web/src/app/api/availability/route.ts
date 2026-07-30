import { NextResponse, type NextRequest } from 'next/server';
import { isServiceId } from '@/content/services';
import { isTrainerSelection, type TrainerSelection } from '@/content/trainers';
import { getDayAvailability, getMonthAvailability } from '@/lib/booking';
import { isValidIsoDate, isValidMonthKey } from '@/lib/date';
import type { ApiError } from '@/features/booking/types';

export const dynamic = 'force-dynamic';

function badRequest(code: string, error: string) {
  return NextResponse.json<ApiError>({ error, code }, { status: 400 });
}

/**
 * GET /api/availability?service=ems&trainer=any&month=2026-07
 *   → per-day status for the whole month (drives the calendar grid)
 *
 * GET /api/availability?service=ems&trainer=victoria&date=2026-07-24
 *   → per-slot status for one day (drives the time grid)
 *
 * Reads through the booking provider — the live Altegio schedule when
 * configured, the in-memory mock otherwise. `trainer` defaults to `'any'`
 * (the union of every bookable trainer's free slots).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const service = params.get('service') ?? '';
  const trainerParam = params.get('trainer') ?? 'any';
  const month = params.get('month');
  const date = params.get('date');

  if (!isServiceId(service)) {
    return badRequest('invalid_service', 'Невідома послуга.');
  }

  if (!isTrainerSelection(trainerParam)) {
    return badRequest('invalid_trainer', 'Невідомий тренер.');
  }
  const trainer: TrainerSelection = trainerParam;

  if (date) {
    if (!isValidIsoDate(date)) {
      return badRequest('invalid_date', 'Дата має бути у форматі YYYY-MM-DD.');
    }
    return NextResponse.json(await getDayAvailability(service, date, trainer));
  }

  if (month) {
    if (!isValidMonthKey(month)) {
      return badRequest('invalid_month', 'Місяць має бути у форматі YYYY-MM.');
    }
    return NextResponse.json(await getMonthAvailability(service, month, trainer));
  }

  return badRequest('missing_range', 'Вкажіть параметр month або date.');
}
