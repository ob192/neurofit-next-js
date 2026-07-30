/**
 * Response shapes for the Altegio public booking API.
 *
 * These describe only the fields we actually consume. Altegio returns a good
 * deal more on each object; leaving the rest untyped keeps this honest about
 * what the code relies on. Every successful response is wrapped in an envelope.
 */

export type AltegioEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: { message?: string };
};

/** Whether a service can be paid online — public checkout only works when not "required". */
export type AltegioPrepaid = 'forbidden' | 'allowed' | 'required';

export type AltegioService = {
  id: number;
  title: string;
  category_id: number;
  price_min: number;
  price_max: number;
  prepaid: AltegioPrepaid;
  /** Session length in seconds; `null` means "use the staff/default length". */
  seance_length: number | null;
  active: number;
};

export type AltegioCategory = {
  id: number;
  title: string;
};

export type AltegioServicesResponse = {
  events: unknown[];
  services: AltegioService[];
  category: AltegioCategory[];
};

export type AltegioStaff = {
  id: number;
  name: string;
  /** False when this member can't currently take online bookings. */
  bookable: boolean;
  /** Last date the member has a published schedule, `YYYY-MM-DD` or null. */
  schedule_till: string | null;
};

export type AltegioDates = {
  /** Dates the staff is on shift, `YYYY-MM-DD`. */
  working_dates: string[];
  /** Subset of `working_dates` that still has at least one open slot. */
  booking_dates: string[];
};

export type AltegioTime = {
  /** Wall-clock start, e.g. `"8:00"` — note NO leading zero. */
  time: string;
  seance_length: number;
  sum_length: number;
  /** Full ISO start with the studio's UTC offset, e.g. `"2026-07-31T08:00:00+03:00"`. */
  datetime: string;
};

/** One line item in a booking request. */
export type AltegioAppointment = {
  /** Client-assigned id, unique within the request. */
  id: number;
  services: number[];
  staff_id: number;
  /** Must be a `datetime` taken verbatim from `book_times`. */
  datetime: string;
};

export type AltegioBookInput = {
  appointments: AltegioAppointment[];
  fullname: string;
  phone: string;
  email?: string;
  comment?: string;
  /** SMS confirmation code, when the location requires phone confirmation. */
  code?: string;
};

export type AltegioBookResult = {
  id: number;
  record_id: number;
  record_hash: string;
};
