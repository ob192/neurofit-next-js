import type { Booking, IsoDate, Time } from '@/features/booking/types';
import type { ServiceId } from '@/content/services';
import { serviceIds } from '@/content/services';
import { minutesToTime, studioToday, timeToMinutes, toIsoDate, parseIsoDate } from '@/lib/date';

/**
 * In-memory stand-in for a booking backend.
 *
 * There is intentionally no CRM here. Everything lives in a module-level Map
 * that resets on server restart, which is all the landing page needs to
 * demonstrate the flow end to end: a submitted booking really does disappear
 * from the availability grid.
 *
 * Two deliberate choices worth knowing about:
 *
 *  1. The store hangs off `globalThis` so Next's dev-mode module reloading
 *     doesn't silently hand you a fresh, empty store on every edit.
 *  2. The seed data comes from a deterministic PRNG rather than `Math.random`.
 *     Server-rendered markup and the client's first render must agree on which
 *     days look busy, otherwise React reports a hydration mismatch.
 *
 * Swapping this for a real provider means reimplementing `listBookings`,
 * `isSlotTaken` and `createBooking` against it — nothing else imports the Map.
 */

export const STUDIO_OPENS = '07:00';
export const STUDIO_CLOSES = '22:00';
/** Booking granularity inside a chosen hour, matching the design's "крок 10 хв". */
export const SLOT_STEP_MINUTES = 10;
/** How far ahead the calendar lets you book. */
export const BOOKING_HORIZON_DAYS = 90;

type BookingStore = {
  bookings: Map<string, Booking>;
  seededFor: string;
};

const STORE_KEY = Symbol.for('neurofit.mock.bookingStore');

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: BookingStore };

/**
 * Small deterministic PRNG (mulberry32). Same seed → same sequence, on both
 * the server and any later restart.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** All bookable start times for a day, `07:00` … `21:50`. */
export function allSlotTimes(): Time[] {
  const start = timeToMinutes(STUDIO_OPENS);
  const end = timeToMinutes(STUDIO_CLOSES);
  const times: Time[] = [];
  // The last session must finish by closing time, hence `< end`.
  for (let minutes = start; minutes < end; minutes += SLOT_STEP_MINUTES) {
    times.push(minutesToTime(minutes));
  }
  return times;
}

function slotKey(serviceId: ServiceId, date: IsoDate, time: Time): string {
  return `${serviceId}|${date}|${time}`;
}

/**
 * Fabricate a plausible-looking booked calendar so the UI has something to
 * show: roughly a third of slots taken, weighted towards evenings, plus a few
 * days that are completely full.
 */
function seed(store: BookingStore, today: IsoDate): void {
  store.bookings.clear();

  const { year, month1, day } = parseIsoDate(today);
  const random = createRandom(year * 10000 + month1 * 100 + day);
  const times = allSlotTimes();

  for (let offset = 0; offset < 45; offset += 1) {
    // Walk forward day by day using a UTC-noon anchor (DST-safe).
    const anchor = new Date(Date.UTC(year, month1 - 1, day + offset, 12));
    const date = toIsoDate(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() + 1,
      anchor.getUTCDate(),
    );

    for (const serviceId of serviceIds) {
      // ~8% of service-days are fully booked out.
      const fullyBooked = random() < 0.08;

      for (const time of times) {
        const hour = Number(time.slice(0, 2));
        // Evenings (17:00–21:00) are the busiest part of the day.
        const isPeak = hour >= 17 && hour < 21;
        const chance = fullyBooked ? 1 : isPeak ? 0.55 : 0.22;
        if (random() >= chance) continue;

        const id = slotKey(serviceId, date, time);
        store.bookings.set(id, {
          id,
          serviceId,
          date,
          time,
          name: 'Заброньовано',
          phone: '',
          createdAt: new Date(Date.UTC(year, month1 - 1, day)).toISOString(),
        });
      }
    }
  }

  store.seededFor = today;
}

function getStore(): BookingStore {
  const globalWithStore = globalThis as GlobalWithStore;
  let store = globalWithStore[STORE_KEY];

  if (!store) {
    store = { bookings: new Map(), seededFor: '' };
    globalWithStore[STORE_KEY] = store;
  }

  // Reseed when the calendar rolls over midnight so the demo never shows a
  // stale window of "today".
  const today = studioToday();
  if (store.seededFor !== today) {
    seed(store, today);
  }

  return store;
}

export function listBookings(filter?: {
  serviceId?: ServiceId;
  date?: IsoDate;
}): Booking[] {
  const { bookings } = getStore();
  return [...bookings.values()]
    .filter((booking) => !filter?.serviceId || booking.serviceId === filter.serviceId)
    .filter((booking) => !filter?.date || booking.date === filter.date)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function isSlotTaken(serviceId: ServiceId, date: IsoDate, time: Time): boolean {
  return getStore().bookings.has(slotKey(serviceId, date, time));
}

export function bookedTimesFor(serviceId: ServiceId, date: IsoDate): Set<Time> {
  const { bookings } = getStore();
  const taken = new Set<Time>();
  for (const booking of bookings.values()) {
    if (booking.serviceId === serviceId && booking.date === date) {
      taken.add(booking.time);
    }
  }
  return taken;
}

/** Returns the created booking, or null when the slot was taken first. */
export function createBooking(
  input: Omit<Booking, 'id' | 'createdAt'>,
): Booking | null {
  const store = getStore();
  const key = slotKey(input.serviceId, input.date, input.time);
  if (store.bookings.has(key)) return null;

  const booking: Booking = {
    ...input,
    id: key,
    createdAt: new Date().toISOString(),
  };
  store.bookings.set(key, booking);
  return booking;
}
