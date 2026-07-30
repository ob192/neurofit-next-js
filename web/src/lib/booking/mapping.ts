import { getService, type ServiceId } from '@/content/services';
import { getTrainer, trainers, type TrainerSelection } from '@/content/trainers';
import type { Time } from '@/features/booking/types';

/**
 * How the site's marketing model maps onto the studio's Altegio catalogue.
 *
 * The studio sells one bookable service — «Основне тренування» — run by a pool
 * of trainers. The landing page instead advertises three *formats* (EMS,
 * Стретчинг, EMS Boxing). So every booking is created against the one Altegio
 * service, and which format the client chose is written into the appointment
 * comment for the trainer to read.
 */

/** «Основне тренування» (id from `book_services`). Every booking uses this. */
export const ALTEGIO_MAIN_SERVICE_ID = 12935553;

/** Altegio `staff_id`s for the bookable trainers, in display order. */
export const ALTEGIO_TRAINER_IDS: readonly number[] = trainers.map(
  (trainer) => trainer.altegioStaffId,
);

/**
 * The Altegio staff ids a selection resolves to: one specific trainer, or the
 * whole bookable pool when the client expressed no preference.
 */
export function staffIdsFor(selection: TrainerSelection): readonly number[] {
  if (selection === 'any') return ALTEGIO_TRAINER_IDS;
  const trainer = getTrainer(selection);
  return trainer ? [trainer.altegioStaffId] : [];
}

/**
 * The comment written onto the Altegio appointment: the chosen format's label,
 * optionally followed by whatever the client typed. e.g. `"EMS Boxing — Хочу
 * ранкові заняття"`.
 */
export function buildBookingComment(serviceId: ServiceId, note?: string): string {
  const label = getService(serviceId)?.shortName ?? serviceId;
  const trimmed = note?.trim();
  return trimmed ? `${label} — ${trimmed}` : label;
}

/**
 * Altegio returns times without a leading zero (`"8:00"`); the app works in
 * strict `HH:mm`. Normalise so slot keys and validation line up.
 */
export function normalizeAltegioTime(altegioTime: string): Time {
  const [hours = '0', minutes = '00'] = altegioTime.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}
