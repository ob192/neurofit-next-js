import { Section } from '@/components/Section/Section';
import { Icon } from '@/components/Icon/Icon';
import { isServiceId, type ServiceId } from '@/content/services';
import { getDayAvailability, getMonthAvailability } from '@/lib/mock/availability';
import { monthKeyOf, studioToday } from '@/lib/date';
import { site } from '@/content/site';
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
export function BookingSection({ preselectedService }: BookingSectionProps) {
  const serviceId: ServiceId =
    preselectedService && isServiceId(preselectedService) ? preselectedService : 'ems';

  const today = studioToday();
  const month = monthKeyOf(today);
  const monthAvailability = getMonthAvailability(serviceId, month);

  // Preselect the soonest bookable day so the calendar isn't an empty prompt.
  const selectedDate =
    monthAvailability.days.find((day) => day.status === 'available')?.date ?? null;
  const dayAvailability = selectedDate
    ? getDayAvailability(serviceId, selectedDate)
    : null;

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
      </header>

      <BookingWidget
        serviceId={serviceId}
        month={month}
        monthAvailability={monthAvailability}
        selectedDate={selectedDate}
        dayAvailability={dayAvailability}
        minMonth={month}
      />
    </Section>
  );
}
