import type { IsoDate, MonthKey, Time } from '@/features/booking/types';

/**
 * Date helpers that stay on plain `YYYY-MM-DD` strings.
 *
 * The studio is a single physical location, so "today" and "18:30" always mean
 * local wall-clock time there. Passing these through `Date` and back is how you
 * get off-by-one-day bugs across timezones, so all calendar arithmetic here is
 * done on the string parts and only converted to `Date` for weekday lookup
 * (which uses a UTC-noon anchor to stay DST-proof).
 */

export const UA_MONTHS_NOMINATIVE = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
] as const;

/** Genitive case — used when a day number precedes the month ("24 липня"). */
export const UA_MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
] as const;

/** Monday-first, matching the calendar in the design. */
export const UA_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] as const;

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toIsoDate(year: number, month1: number, day: number): IsoDate {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

export function parseIsoDate(date: IsoDate): { year: number; month1: number; day: number } {
  const [year, month1, day] = date.split('-').map(Number);
  return { year: year ?? 0, month1: month1 ?? 0, day: day ?? 0 };
}

export function isValidIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month1, day } = parseIsoDate(value);
  if (month1 < 1 || month1 > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month1);
}

export function isValidTime(value: string): value is Time {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidMonthKey(value: string): value is MonthKey {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

export function monthKeyOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function daysInMonth(year: number, month1: number): number {
  // Day 0 of the *next* month is the last day of this one.
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: IsoDate): number {
  const { year, month1, day } = parseIsoDate(date);
  // Anchor at UTC noon so no timezone or DST shift can roll the date over.
  const jsDay = new Date(Date.UTC(year, month1 - 1, day, 12)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const year = Number(month.slice(0, 4));
  const month0 = Number(month.slice(5)) - 1 + delta;
  const nextYear = year + Math.floor(month0 / 12);
  const nextMonth0 = ((month0 % 12) + 12) % 12;
  return `${nextYear}-${pad2(nextMonth0 + 1)}`;
}

export function formatMonthTitle(month: MonthKey): string {
  const year = month.slice(0, 4);
  const month0 = Number(month.slice(5)) - 1;
  return `${UA_MONTHS_NOMINATIVE[month0] ?? month} ${year}`;
}

/** "24 липня" — the form used in the booking summary. */
export function formatDayMonth(date: IsoDate): string {
  const { month1, day } = parseIsoDate(date);
  return `${day} ${UA_MONTHS_GENITIVE[month1 - 1] ?? ''}`.trim();
}

/** Today in the studio's timezone, as `YYYY-MM-DD`. */
export function studioToday(now: Date = new Date()): IsoDate {
  // `en-CA` yields ISO-shaped output; the timeZone pins it to Kyiv regardless
  // of where the server process happens to run.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function timeToMinutes(time: Time): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function minutesToTime(total: number): Time {
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}
