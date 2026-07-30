import { getAltegioClient, AltegioError } from '@/lib/altegio';
import { daysInMonth, studioToday, toIsoDate } from '@/lib/date';
import type {
  DayAvailability,
  DayAvailabilityDetail,
  IsoDate,
  MonthAvailability,
  MonthKey,
  Slot,
  Time,
} from '@/features/booking/types';
import type { ServiceId } from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';
import type { CreateBookingInput, CreateBookingResult } from './types';
import {
  ALTEGIO_MAIN_SERVICE_ID,
  buildBookingComment,
  normalizeAltegioTime,
  staffIdsFor,
} from './mapping';

/**
 * Altegio-backed implementation of the booking provider.
 *
 * The site's availability calendar is driven entirely by the studio's real
 * schedule here: `book_dates` for which days are open, `book_times` for the
 * open slots on a chosen day. Because every format maps to one Altegio service,
 * `serviceId` doesn't affect availability — the trainer does — but it is echoed
 * back in the payload so the client's stale-data checks keep working.
 */

/** Union the given staff's dates into working/bookable sets. */
async function collectDates(
  staffIds: readonly number[],
): Promise<{ working: Set<string>; bookable: Set<string> }> {
  const client = getAltegioClient();
  const working = new Set<string>();
  const bookable = new Set<string>();

  await Promise.all(
    staffIds.map(async (staffId) => {
      const dates = await client.getDates({
        staffId,
        serviceIds: [ALTEGIO_MAIN_SERVICE_ID],
      });
      for (const date of dates.working_dates ?? []) working.add(date);
      for (const date of dates.booking_dates ?? []) bookable.add(date);
    }),
  );

  return { working, bookable };
}

export async function getMonthAvailability(
  serviceId: ServiceId,
  month: MonthKey,
  trainer: TrainerSelection,
): Promise<MonthAvailability> {
  const today = studioToday();
  const { working, bookable } = await collectDates(staffIdsFor(trainer));

  const year = Number(month.slice(0, 4));
  const month1 = Number(month.slice(5));
  const total = daysInMonth(year, month1);

  const days: DayAvailability[] = [];
  for (let day = 1; day <= total; day += 1) {
    const date = toIsoDate(year, month1, day);

    if (date < today) {
      days.push({ date, status: 'past', freeSlots: 0 });
    } else if (bookable.has(date)) {
      // We don't know the exact free count without another call; 1 is enough to
      // mark the day open (freeSlots "drives nothing visually" per the type).
      days.push({ date, status: 'available', freeSlots: 1 });
    } else if (working.has(date)) {
      days.push({ date, status: 'full', freeSlots: 0 });
    } else {
      // Closed, or beyond the studio's published schedule — not bookable. The
      // calendar renders any non-'available' day as disabled, so 'past' reads
      // correctly to the user even for future closed days.
      days.push({ date, status: 'past', freeSlots: 0 });
    }
  }

  return { month, serviceId, trainer, days };
}

/** Union of the given staff's open start times on a date, normalised to HH:mm. */
async function collectTimes(
  staffIds: readonly number[],
  date: IsoDate,
  revalidate?: number,
): Promise<Set<Time>> {
  const client = getAltegioClient();
  const free = new Set<Time>();

  await Promise.all(
    staffIds.map(async (staffId) => {
      const times = await client.getTimes({
        staffId,
        serviceId: ALTEGIO_MAIN_SERVICE_ID,
        date,
        ...(revalidate !== undefined ? { revalidate } : {}),
      });
      for (const slot of times) free.add(normalizeAltegioTime(slot.time));
    }),
  );

  return free;
}

export async function getDayAvailability(
  serviceId: ServiceId,
  date: IsoDate,
  trainer: TrainerSelection,
): Promise<DayAvailabilityDetail> {
  const today = studioToday();
  if (date < today) return { date, serviceId, trainer, slots: [] };

  const free = await collectTimes(staffIdsFor(trainer), date);
  // Altegio only reports *open* slots, so every slot we return is available.
  const slots: Slot[] = [...free]
    .sort((a, b) => a.localeCompare(b))
    .map((time) => ({ time, available: true }));

  return { date, serviceId, trainer, slots };
}

/**
 * Create a real booking against Altegio.
 *
 * Resolves a concrete trainer for the slot (required — `staff_id:0` on
 * `book_record` routinely fails with "no staff"), re-reading `book_times`
 * fresh so we (a) get the exact `datetime` to submit verbatim and (b) catch a
 * slot that was taken since the calendar was rendered.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const client = getAltegioClient();
  const candidates = staffIdsFor(input.trainer);

  if (candidates.length === 0) {
    return { ok: false, code: 'no_staff', message: 'Оберіть, будь ласка, тренера.' };
  }

  const comment = buildBookingComment(input.serviceId, input.comment);

  for (const staffId of candidates) {
    // Force a fresh read (revalidate:0) — we're about to write against it.
    const times = await client.getTimes({
      staffId,
      serviceId: ALTEGIO_MAIN_SERVICE_ID,
      date: input.date,
      revalidate: 0,
    });
    const slot = times.find((t) => normalizeAltegioTime(t.time) === input.time);
    if (!slot) continue; // this trainer isn't free then — try the next one

    try {
      await client.createBooking({
        appointments: [
          {
            id: 1,
            services: [ALTEGIO_MAIN_SERVICE_ID],
            staff_id: staffId,
            datetime: slot.datetime,
          },
        ],
        fullname: input.name,
        phone: input.phone,
        ...(input.email ? { email: input.email } : {}),
        comment,
      });
      return { ok: true, date: input.date, time: input.time };
    } catch (error) {
      if (error instanceof AltegioError) {
        // Someone booked it in the gap between our read and write — for 'any',
        // give the next trainer a chance; for a specific pick, it's taken.
        if (error.reason === 'slot_taken' || error.reason === 'not_available') {
          if (input.trainer === 'any') continue;
          return {
            ok: false,
            code: 'slot_taken',
            message: 'Цей час щойно зайняли. Оберіть, будь ласка, інший.',
          };
        }
        if (error.reason === 'invalid_phone') {
          return {
            ok: false,
            code: 'invalid_phone',
            message: 'Перевірте заповнені поля.',
            fields: { phone: 'Вкажіть коректний номер телефону.' },
          };
        }
        return {
          ok: false,
          code: 'provider_error',
          message: 'Не вдалося створити запис. Спробуйте ще раз або зателефонуйте нам.',
        };
      }
      throw error;
    }
  }

  // No candidate trainer had the slot free.
  return {
    ok: false,
    code: 'slot_taken',
    message: 'Цей час щойно зайняли. Оберіть, будь ласка, інший.',
  };
}
