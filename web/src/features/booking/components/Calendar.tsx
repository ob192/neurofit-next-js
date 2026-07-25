'use client';

import { Icon } from '@/components/Icon/Icon';
import type { IsoDate, MonthAvailability, MonthKey } from '../types';
import {
  addMonths,
  formatDayMonth,
  formatMonthTitle,
  parseIsoDate,
  UA_WEEKDAYS_SHORT,
  weekdayIndex,
} from '@/lib/date';
import styles from './Calendar.module.css';

type CalendarProps = {
  month: MonthKey;
  availability: MonthAvailability | null;
  selectedDate: IsoDate | null;
  /** Earliest month the user may navigate back to (the current month). */
  minMonth: MonthKey;
  loading: boolean;
  onMonthChange: (month: MonthKey) => void;
  onSelectDate: (date: IsoDate) => void;
};

export function Calendar({
  month,
  availability,
  selectedDate,
  minMonth,
  loading,
  onMonthChange,
  onSelectDate,
}: CalendarProps) {
  const days = availability?.days ?? [];
  // Blank cells so the 1st lands under the right weekday (Monday-first).
  const leadingBlanks = days[0] ? weekdayIndex(days[0].date) : 0;
  const canGoBack = month > minMonth;

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button
          type="button"
          className={`${styles.nav} ${styles.navMuted}`}
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={!canGoBack}
          aria-label="Попередній місяць"
        >
          <Icon name="chevron-left" size={16} />
        </button>

        <span className={styles.month} aria-live="polite">
          {formatMonthTitle(month)}
        </span>

        <button
          type="button"
          className={`${styles.nav} ${styles.navPrimary}`}
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Наступний місяць"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {UA_WEEKDAYS_SHORT.map((weekday) => (
          <span key={weekday} className={styles.weekday}>
            {weekday}
          </span>
        ))}
      </div>

      <div
        className={`${styles.grid} ${loading ? styles.gridLoading : ''}`}
        role="grid"
        aria-label="Оберіть дату"
      >
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} className={styles.blank} />
        ))}

        {days.map((day) => {
          const { day: dayNumber } = parseIsoDate(day.date);
          const selected = day.date === selectedDate;
          const disabled = day.status !== 'available';

          return (
            <button
              key={day.date}
              type="button"
              role="gridcell"
              className={[
                styles.day,
                selected ? styles.daySelected : '',
                disabled ? styles.dayDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={disabled}
              aria-selected={selected}
              aria-label={`${formatDayMonth(day.date)}${
                day.status === 'full' ? ' — немає вільних місць' : ''
              }`}
              onClick={() => onSelectDate(day.date)}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
