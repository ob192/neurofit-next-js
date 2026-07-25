import type { ServiceId } from '@/content/services';

/** A calendar date in `YYYY-MM-DD`, always interpreted in the studio's local time. */
export type IsoDate = string;

/** A wall-clock time in `HH:mm`. */
export type Time = string;

/** A month key in `YYYY-MM`. */
export type MonthKey = string;

export type DayStatus =
  /** At least one slot is free. */
  | 'available'
  /** The studio is open but every slot is taken. */
  | 'full'
  /** In the past — not bookable. */
  | 'past';

export type DayAvailability = {
  date: IsoDate;
  status: DayStatus;
  /** How many 10-minute starts remain free. Drives nothing visually, but handy. */
  freeSlots: number;
};

export type MonthAvailability = {
  month: MonthKey;
  serviceId: ServiceId;
  days: DayAvailability[];
};

export type Slot = {
  /** Start time, `HH:mm`. */
  time: Time;
  available: boolean;
};

export type DayAvailabilityDetail = {
  date: IsoDate;
  serviceId: ServiceId;
  slots: Slot[];
};

export type Booking = {
  id: string;
  serviceId: ServiceId;
  date: IsoDate;
  time: Time;
  name: string;
  phone: string;
  comment?: string;
  createdAt: string;
};

/** Payload accepted by POST /api/bookings. */
export type BookingRequest = {
  serviceId: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  comment?: string;
};

export type ApiError = {
  error: string;
  /** Machine-readable reason, e.g. `slot_taken`. */
  code: string;
  /** Present for validation failures, keyed by field name. */
  fields?: Record<string, string>;
};
