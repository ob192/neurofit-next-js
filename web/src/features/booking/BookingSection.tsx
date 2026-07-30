import { Section } from '@/components/Section/Section';
import { Icon } from '@/components/Icon/Icon';
import {
  defaultBookableServiceId,
  isBookableServiceId,
  type ServiceId,
} from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';
import { getDayAvailability, getMonthAvailability } from '@/lib/booking';
import { monthKeyOf, studioToday } from '@/lib/date';
import { site } from '@/content/site';
import { booking } from '@/content/booking';
import type { DayAvailabilityDetail, MonthAvailability } from './types';
import { BookingWidget } from './components/BookingWidget';
import styles from './BookingSection.module.css';

type BookingSectionProps = {
  /** From `?service=` — set by the "Записатися" CTA on each service card. */
  preselectedService?: string;
};

/**
 * Server half of the booking flow.
 *
 * Availability is read straight from the mock store here — not via fetch to
 * our own route handler. Calling your own HTTP endpoint during SSR costs a
 * round-trip and can deadlock on a single-worker server; the route handlers and
 * this component both sit on top of the same `lib/mock/availability` functions
 * instead.
 *
 * The upshot is that the rendered HTML already contains a real calendar with
 * real busy days, so the section is meaningful before any JavaScript runs and
 * to crawlers that never execute it.
 */
export async function BookingSection({ preselectedService }: BookingSectionProps) {
  // A `?service=` pointing at a format that isn't bookable (EMS Boxing today)
  // falls back rather than opening the widget on a greyed-out chip.
  const serviceId: ServiceId =
    preselectedService && isBookableServiceId(preselectedService)
      ? preselectedService
      : defaultBookableServiceId;

  // No trainer preference by default — the calendar shows every trainer's free
  // slots until the visitor narrows it down in the widget.
  const trainer: TrainerSelection = 'any';
  const today = studioToday();
  const month = monthKeyOf(today);

  // Server-render live availability. If the backend is briefly unreachable, fall
  // back to an empty calendar rather than failing the whole page — the client
  // widget will retry on the first interaction.
  let monthAvailability: MonthAvailability = { month, serviceId, trainer, days: [] };
  let selectedDate: string | null = null;
  let dayAvailability: DayAvailabilityDetail | null = null;

  try {
    monthAvailability = await getMonthAvailability(serviceId, month, trainer);
    // Preselect the soonest bookable day so the calendar isn't an empty prompt.
    selectedDate =
      monthAvailability.days.find((day) => day.status === 'available')?.date ?? null;
    dayAvailability = selectedDate
      ? await getDayAvailability(serviceId, selectedDate, trainer)
      : null;
  } catch {
    // Leave the fallbacks in place; the widget recovers client-side.
  }

  return (
    <Section
      id="booking"
      tone="lilac"
      gap={20}
      padY={40}
      className={styles.section}
      aria-labelledby="booking-heading"
    >
      <header className={styles.head}>
        <p className={styles.kicker}>
          <Icon name="calendar-check" size={13} />
          <span>ОНЛАЙН-ЗАПИС</span>
        </p>
        <h2 id="booking-heading" className={styles.title}>
          Забронюйте тренування
        </h2>
        <p className={styles.desc}>
          Оберіть послугу, зручну дату та час. Працюємо щодня з {site.hours.opens} до{' '}
          {site.hours.closes}.
        </p>
        <p className={styles.note}>
          <Icon name="shield-check" size={14} />
          <span>{booking.note}</span>
        </p>
      </header>

      <BookingWidget
        serviceId={serviceId}
        trainer={trainer}
        month={month}
        monthAvailability={monthAvailability}
        selectedDate={selectedDate}
        dayAvailability={dayAvailability}
        minMonth={month}
      />
    </Section>
  );
}
