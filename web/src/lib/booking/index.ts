import { isAltegioConfigured } from '@/lib/altegio/config';
import * as mockAvailability from '@/lib/mock/availability';
import { createBooking as mockCreateBooking } from '@/lib/mock/store';
import type {
  DayAvailabilityDetail,
  IsoDate,
  MonthAvailability,
  MonthKey,
} from '@/features/booking/types';
import type { ServiceId } from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';
import * as altegio from './altegio';
import type { CreateBookingInput, CreateBookingResult } from './types';

/**
 * The one place the app asks "is a slot free?" and "book this slot".
 *
 * When Altegio credentials are present it talks to the live studio calendar;
 * otherwise it falls back to the in-memory mock, so `npm run dev` and CI keep
 * working with zero configuration. Route handlers and the server-rendered
 * `BookingSection` both go through here — nothing else touches a backend.
 */

export type { CreateBookingInput, CreateBookingResult } from './types';

const SLOT_TAKEN_MESSAGE = 'Цей час щойно зайняли. Оберіть, будь ласка, інший.';

export function getMonthAvailability(
  serviceId: ServiceId,
  month: MonthKey,
  trainer: TrainerSelection,
): Promise<MonthAvailability> {
  return isAltegioConfigured()
    ? altegio.getMonthAvailability(serviceId, month, trainer)
    : Promise.resolve(mockAvailability.getMonthAvailability(serviceId, month, trainer));
}

export function getDayAvailability(
  serviceId: ServiceId,
  date: IsoDate,
  trainer: TrainerSelection,
): Promise<DayAvailabilityDetail> {
  return isAltegioConfigured()
    ? altegio.getDayAvailability(serviceId, date, trainer)
    : Promise.resolve(mockAvailability.getDayAvailability(serviceId, date, trainer));
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  if (isAltegioConfigured()) return altegio.createBooking(input);

  // Mock path: no trainer/email concept — record name, phone and comment only.
  const booking = mockCreateBooking({
    serviceId: input.serviceId,
    date: input.date,
    time: input.time,
    name: input.name,
    phone: input.phone,
    ...(input.comment ? { comment: input.comment } : {}),
  });

  return booking
    ? { ok: true, date: booking.date, time: booking.time }
    : { ok: false, code: 'slot_taken', message: SLOT_TAKEN_MESSAGE };
}

/** Whether the live Altegio backend is active (vs. the in-memory mock). */
export function isLiveBookingBackend(): boolean {
  return isAltegioConfigured();
}
