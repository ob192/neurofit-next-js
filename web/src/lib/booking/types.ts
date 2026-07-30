import type { IsoDate, Time } from '@/features/booking/types';
import type { ServiceId } from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';

/** Everything the booking provider needs to create an appointment. */
export type CreateBookingInput = {
  serviceId: ServiceId;
  trainer: TrainerSelection;
  date: IsoDate;
  time: Time;
  name: string;
  phone: string;
  email?: string;
  comment?: string;
};

/**
 * Provider result. `ok:false` carries an app-level `code` (the same vocabulary
 * the route handler already maps to HTTP status) rather than an Altegio reason,
 * so nothing downstream has to know which backend produced it.
 */
export type CreateBookingResult =
  | { ok: true; date: IsoDate; time: Time }
  | {
      ok: false;
      code: 'slot_taken' | 'no_staff' | 'invalid_phone' | 'provider_error';
      message: string;
      fields?: Record<string, string>;
    };
