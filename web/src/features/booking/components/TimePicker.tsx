'use client';

import { useMemo } from 'react';
import { Icon } from '@/components/Icon/Icon';
import { site } from '@/content/site';
import type { DayAvailabilityDetail, Time } from '../types';
import { pad2 } from '@/lib/date';
import styles from './TimePicker.module.css';

type TimePickerProps = {
  availability: DayAvailabilityDetail | null;
  selectedHour: number | null;
  selectedTime: Time | null;
  loading: boolean;
  onSelectHour: (hour: number) => void;
  onSelectTime: (time: Time) => void;
};

/**
 * Step 3 — pick an hour, then a 10-minute start inside it.
 *
 * The two-level shape comes straight from the design and is genuinely useful
 * here: a flat list of every 10-minute start between 07:00 and 22:00 would be
 * 90 chips.
 */
export function TimePicker({
  availability,
  selectedHour,
  selectedTime,
  loading,
  onSelectHour,
  onSelectTime,
}: TimePickerProps) {
  const slots = useMemo(() => availability?.slots ?? [], [availability]);

  /** Hours that contain at least one slot, with whether any of them are free. */
  const hours = useMemo(() => {
    const byHour = new Map<number, boolean>();
    for (const slot of slots) {
      const hour = Number(slot.time.slice(0, 2));
      byHour.set(hour, (byHour.get(hour) ?? false) || slot.available);
    }
    return [...byHour.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, hasFree]) => ({ hour, hasFree }));
  }, [slots]);

  const minuteSlots = useMemo(
    () =>
      selectedHour === null
        ? []
        : slots.filter((slot) => Number(slot.time.slice(0, 2)) === selectedHour),
    [slots, selectedHour],
  );

  return (
    <div className={`${styles.card} ${loading ? styles.loading : ''}`}>
      <div className={styles.hours}>
        <div className={styles.hoursHead}>
          <span className={styles.hoursLabel}>Оберіть годину</span>
          <span className={styles.openHours}>{site.hours.short}</span>
        </div>

        <div className={styles.hourGrid} role="group" aria-label="Оберіть годину">
          {hours.map(({ hour, hasFree }) => {
            const selected = hour === selectedHour;
            return (
              <button
                key={hour}
                type="button"
                className={[
                  styles.hour,
                  selected ? styles.hourSelected : '',
                  !hasFree ? styles.hourDisabled : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!hasFree}
                aria-pressed={selected}
                aria-label={`${pad2(hour)}:00${hasFree ? '' : ' — немає вільного часу'}`}
                onClick={() => onSelectHour(hour)}
              >
                {pad2(hour)}:00
              </button>
            );
          })}
        </div>
      </div>

      {selectedHour !== null ? (
        <>
          <hr className={styles.divider} />

          <div className={styles.micro}>
            <div className={styles.microHead}>
              <Icon name="timer" size={14} />
              <span>{pad2(selectedHour)}:00 — оберіть час, крок 10 хв</span>
            </div>

            <div className={styles.microGrid} role="group" aria-label="Оберіть час">
              {minuteSlots.map((slot) => {
                const selected = slot.time === selectedTime;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    className={[
                      styles.minute,
                      selected ? styles.minuteSelected : '',
                      !slot.available ? styles.minuteDisabled : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={!slot.available}
                    aria-pressed={selected}
                    aria-label={`${slot.time}${slot.available ? '' : ' — зайнято'}`}
                    onClick={() => onSelectTime(slot.time)}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
