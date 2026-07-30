import type {
  DayAvailability,
  DayAvailabilityDetail,
  IsoDate,
  MonthAvailability,
  MonthKey,
  Slot,
} from '@/features/booking/types';
import type { ServiceId } from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';
import { allSlotTimes, bookedTimesFor, BOOKING_HORIZON_DAYS } from './store';
import { daysInMonth, studioToday, toIsoDate } from '@/lib/date';

/**
 * Availability derived from the mock store.
 *
 * These functions are called directly by the server component that renders the
 * booking section (so the first paint is server-rendered with real data) and
 * indirectly by the route handlers when the client changes service or month.
 * Same code path either way — no duplicated logic between SSR and the API.
 */

function horizonEnd(today: IsoDate): IsoDate {
  const [year, month1, day] = today.split('-').map(Number);
  const end = new Date(
    Date.UTC(year ?? 0, (month1 ?? 1) - 1, (day ?? 1) + BOOKING_HORIZON_DAYS, 12),
  );
  return toIsoDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());
}

export function getMonthAvailability(
  serviceId: ServiceId,
  month: MonthKey,
  // The mock has no per-trainer schedule; it echoes the selection so the shape
  // matches the Altegio provider and the client's stale-data checks line up.
  trainer: TrainerSelection = 'any',
): MonthAvailability {
  const today = studioToday();
  const lastBookable = horizonEnd(today);
  const year = Number(month.slice(0, 4));
  const month1 = Number(month.slice(5));
  const total = daysInMonth(year, month1);
  const slotCount = allSlotTimes().length;

  const days: DayAvailability[] = [];

  for (let day = 1; day <= total; day += 1) {
    const date = toIsoDate(year, month1, day);

    if (date < today || date > lastBookable) {
      days.push({ date, status: 'past', freeSlots: 0 });
      continue;
    }

    const freeSlots = slotCount - bookedTimesFor(serviceId, date).size;
    days.push({
      date,
      status: freeSlots > 0 ? 'available' : 'full',
      freeSlots,
    });
  }

  return { month, serviceId, trainer, days };
}

export function getDayAvailability(
  serviceId: ServiceId,
  date: IsoDate,
  trainer: TrainerSelection = 'any',
): DayAvailabilityDetail {
  const today = studioToday();
  const taken = bookedTimesFor(serviceId, date);
  const isPast = date < today;

  const slots: Slot[] = allSlotTimes().map((time) => ({
    time,
    available: !isPast && !taken.has(time),
  }));

  return { date, serviceId, trainer, slots };
}

/** First date in the month that can actually be booked, if any. */
export function firstAvailableDate(
  serviceId: ServiceId,
  month: MonthKey,
): IsoDate | null {
  const { days } = getMonthAvailability(serviceId, month);
  return days.find((day) => day.status === 'available')?.date ?? null;
}
