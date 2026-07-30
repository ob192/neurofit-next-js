/**
 * The studio's trainers, and how they map onto Altegio staff.
 *
 * Every marketing service is booked against a single Altegio service
 * («Основне тренування», see `lib/booking/mapping.ts`); the real variation is
 * *who* runs the session. Лідія is intentionally absent — she is staff on the
 * Altegio side (id 2879290) but not a bookable trainer, so she must never
 * appear here or receive bookings.
 */

export type TrainerId = 'victoria' | 'alina';

/** What the client can pick in the widget — a specific trainer, or "no preference". */
export type TrainerSelection = TrainerId | 'any';

export type Trainer = {
  id: TrainerId;
  /** Display name, shown in the picker and the booking summary. */
  name: string;
  /** The Altegio `staff_id` this trainer corresponds to. */
  altegioStaffId: number;
};

export const trainers: readonly Trainer[] = [
  { id: 'victoria', name: 'Вікторія', altegioStaffId: 2879289 },
  { id: 'alina', name: 'Аліна', altegioStaffId: 2879287 },
];

export const trainerIds = trainers.map((trainer) => trainer.id);

export function getTrainer(id: string): Trainer | undefined {
  return trainers.find((trainer) => trainer.id === id);
}

export function isTrainerSelection(value: string): value is TrainerSelection {
  return value === 'any' || trainers.some((trainer) => trainer.id === value);
}

/** Display label for any selection, including the "any trainer" case. */
export function trainerLabel(selection: TrainerSelection): string {
  return selection === 'any' ? 'Будь-який тренер' : (getTrainer(selection)?.name ?? selection);
}
