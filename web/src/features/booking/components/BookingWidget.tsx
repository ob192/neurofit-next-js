'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ServiceId } from '@/content/services';
import type {
  DayAvailabilityDetail,
  IsoDate,
  MonthAvailability,
  MonthKey,
  Time,
} from '../types';
import {
  BookingApiError,
  fetchDayAvailability,
  fetchMonthAvailability,
  submitBooking,
} from '../api';
import { ServicePicker } from './ServicePicker';
import { Calendar } from './Calendar';
import { TimePicker } from './TimePicker';
import { BookingForm, type SubmitStatus } from './BookingForm';
import styles from './BookingWidget.module.css';

export type BookingWidgetProps = {
  serviceId: ServiceId;
  month: MonthKey;
  monthAvailability: MonthAvailability;
  selectedDate: IsoDate | null;
  dayAvailability: DayAvailabilityDetail | null;
  /** Current month in the studio's timezone — the earliest navigable month. */
  minMonth: MonthKey;
};

/**
 * Client half of the booking flow.
 *
 * Everything it needs for the first paint arrives as props from the server
 * component, already rendered into the HTML. It only talks to the API when the
 * user actually changes something — which is also why the fetch effects below
 * compare against the *data* rather than firing on mount: the initial props are
 * already the answer for the initial (service, month, date) triple, so there is
 * nothing to re-fetch until one of them moves.
 */
export function BookingWidget({
  serviceId: initialServiceId,
  month: initialMonth,
  monthAvailability: initialMonthAvailability,
  selectedDate: initialDate,
  dayAvailability: initialDayAvailability,
  minMonth,
}: BookingWidgetProps) {
  const [serviceId, setServiceId] = useState<ServiceId>(initialServiceId);
  const [month, setMonth] = useState<MonthKey>(initialMonth);
  const [monthAvailability, setMonthAvailability] = useState<MonthAvailability | null>(
    initialMonthAvailability,
  );
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(initialDate);
  const [dayAvailability, setDayAvailability] = useState<DayAvailabilityDetail | null>(
    initialDayAvailability,
  );

  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<Time | null>(null);

  /**
   * Keys whose fetch failed. Without this, a failed request would leave the
   * data permanently "stale" and the spinner would never stop — see how
   * `monthLoading` is derived below.
   */
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<string>>(new Set());

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const monthKey = `month:${serviceId}:${month}`;
  const dayKey = `day:${serviceId}:${selectedDate ?? ''}`;

  const monthIsStale =
    monthAvailability === null ||
    monthAvailability.month !== month ||
    monthAvailability.serviceId !== serviceId;

  const dayIsStale =
    selectedDate !== null &&
    (dayAvailability === null ||
      dayAvailability.date !== selectedDate ||
      dayAvailability.serviceId !== serviceId);

  /*
   * "Loading" is derived, not stored: data that doesn't match the current
   * selection *is* the loading state. Keeping a separate boolean would mean
   * calling setState synchronously inside the effects below, which triggers a
   * second render pass before the fetch has even started.
   */
  const monthLoading = monthIsStale && !failedKeys.has(monthKey);
  const dayLoading = dayIsStale && !failedKeys.has(dayKey);

  const markFailed = useCallback((key: string) => {
    setFailedKeys((current) => new Set(current).add(key));
  }, []);

  /* ---- Month availability --------------------------------------------- */
  useEffect(() => {
    if (!monthIsStale || failedKeys.has(monthKey)) return;

    const controller = new AbortController();

    fetchMonthAvailability(serviceId, month, controller.signal)
      .then((data) => {
        setMonthAvailability(data);
        // If the currently-selected date isn't bookable for this service or
        // month any more, drop it rather than leaving a stale summary.
        setSelectedDate((current) => {
          if (current === null) return null;
          const stillValid = data.days.some(
            (day) => day.date === current && day.status === 'available',
          );
          return stillValid ? current : null;
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        markFailed(monthKey);
        setErrorMessage(
          error instanceof BookingApiError
            ? error.message
            : 'Не вдалося завантажити календар.',
        );
      });

    return () => controller.abort();
  }, [serviceId, month, monthIsStale, monthKey, failedKeys, markFailed]);

  /* ---- Day availability ------------------------------------------------ */
  useEffect(() => {
    if (!dayIsStale || selectedDate === null || failedKeys.has(dayKey)) return;

    const controller = new AbortController();

    fetchDayAvailability(serviceId, selectedDate, controller.signal)
      .then(setDayAvailability)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        markFailed(dayKey);
        setErrorMessage(
          error instanceof BookingApiError
            ? error.message
            : 'Не вдалося завантажити вільний час.',
        );
      });

    return () => controller.abort();
  }, [serviceId, selectedDate, dayIsStale, dayKey, failedKeys, markFailed]);

  /* ---- Handlers -------------------------------------------------------- */

  const clearTime = useCallback(() => {
    setSelectedHour(null);
    setSelectedTime(null);
  }, []);

  /**
   * Any fresh interaction is treated as a retry: drop the record of past
   * failures so a previously-failed month or day will be fetched again if the
   * user navigates back to it.
   */
  const clearErrors = useCallback(() => {
    setErrorMessage(null);
    setFailedKeys((current) => (current.size === 0 ? current : new Set()));
  }, []);

  const handleServiceChange = useCallback(
    (next: ServiceId) => {
      setServiceId(next);
      clearTime();
      clearErrors();
    },
    [clearTime, clearErrors],
  );

  const handleMonthChange = useCallback(
    (next: MonthKey) => {
      setMonth(next);
      setSelectedDate(null);
      clearTime();
      clearErrors();
    },
    [clearTime, clearErrors],
  );

  const handleSelectDate = useCallback(
    (date: IsoDate) => {
      setSelectedDate(date);
      clearTime();
      clearErrors();
    },
    [clearTime, clearErrors],
  );

  const handleSelectHour = useCallback((hour: number) => {
    setSelectedHour(hour);
    setSelectedTime(null);
  }, []);

  const handleFieldChange = useCallback(
    (field: 'name' | 'phone' | 'comment', value: string) => {
      if (field === 'name') setName(value);
      if (field === 'phone') setPhone(value);
      if (field === 'comment') setComment(value);
      // Clear that field's error as soon as the user edits it.
      setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setStatus('idle');
    setName('');
    setPhone('');
    setComment('');
    setFieldErrors({});
    clearErrors();
    clearTime();
  }, [clearTime, clearErrors]);

  const handleSubmit = useCallback(async () => {
    if (!selectedDate || !selectedTime) return;

    setStatus('submitting');
    setErrorMessage(null);
    setFieldErrors({});

    try {
      await submitBooking({
        serviceId,
        date: selectedDate,
        time: selectedTime,
        name,
        phone,
        ...(comment ? { comment } : {}),
      });
      setStatus('success');

      // Re-read availability so the just-booked slot shows as taken.
      const [day, monthData] = await Promise.all([
        fetchDayAvailability(serviceId, selectedDate),
        fetchMonthAvailability(serviceId, month),
      ]);
      setDayAvailability(day);
      setMonthAvailability(monthData);
    } catch (error: unknown) {
      setStatus('error');
      if (error instanceof BookingApiError) {
        setErrorMessage(error.message);
        setFieldErrors(error.fields);
        // Someone took the slot first — refresh so the UI shows it as gone.
        if (error.code === 'slot_taken') {
          setSelectedTime(null);
          void fetchDayAvailability(serviceId, selectedDate).then(setDayAvailability);
        }
      } else {
        setErrorMessage('Не вдалося надіслати заявку. Спробуйте ще раз.');
      }
    }
  }, [serviceId, selectedDate, selectedTime, name, phone, comment, month]);

  /* ---- Render ---------------------------------------------------------- */

  return (
    <div className={styles.widget}>
      <div className={styles.step}>
        <h3 className={styles.stepLabel}>1 · Послуга</h3>
        <ServicePicker value={serviceId} onChange={handleServiceChange} />
      </div>

      <div className={styles.step}>
        <h3 className={styles.stepLabel}>2 · Дата</h3>
        <Calendar
          month={month}
          availability={monthAvailability}
          selectedDate={selectedDate}
          minMonth={minMonth}
          loading={monthLoading}
          onMonthChange={handleMonthChange}
          onSelectDate={handleSelectDate}
        />
      </div>

      <div className={styles.step}>
        <h3 className={styles.stepLabel}>3 · Час</h3>
        {selectedDate ? (
          <TimePicker
            availability={dayAvailability}
            selectedHour={selectedHour}
            selectedTime={selectedTime}
            loading={dayLoading}
            onSelectHour={handleSelectHour}
            onSelectTime={setSelectedTime}
          />
        ) : (
          <p className={styles.hint}>Спочатку оберіть дату у календарі.</p>
        )}
      </div>

      <BookingForm
        serviceId={serviceId}
        date={selectedDate}
        time={selectedTime}
        name={name}
        phone={phone}
        comment={comment}
        status={status}
        errorMessage={errorMessage}
        fieldErrors={fieldErrors}
        onFieldChange={handleFieldChange}
        onSubmit={() => void handleSubmit()}
        onReset={handleReset}
      />
    </div>
  );
}
