'use client';

import { useCallback, useEffect, useState } from 'react';
import { getService, type ServiceId } from '@/content/services';
import type { TrainerSelection } from '@/content/trainers';
import { pushEvent } from '@/lib/analytics/gtm';
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
import { TrainerPicker } from './TrainerPicker';
import { Calendar } from './Calendar';
import { TimePicker } from './TimePicker';
import { BookingForm, type SubmitStatus } from './BookingForm';
import styles from './BookingWidget.module.css';

export type BookingWidgetProps = {
  serviceId: ServiceId;
  trainer: TrainerSelection;
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
 * already the answer for the initial (service, trainer, month, date) tuple, so
 * there is nothing to re-fetch until one of them moves.
 */
export function BookingWidget({
  serviceId: initialServiceId,
  trainer: initialTrainer,
  month: initialMonth,
  monthAvailability: initialMonthAvailability,
  selectedDate: initialDate,
  dayAvailability: initialDayAvailability,
  minMonth,
}: BookingWidgetProps) {
  const [serviceId, setServiceId] = useState<ServiceId>(initialServiceId);
  const [trainer, setTrainer] = useState<TrainerSelection>(initialTrainer);
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
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const monthKey = `month:${serviceId}:${trainer}:${month}`;
  const dayKey = `day:${serviceId}:${trainer}:${selectedDate ?? ''}`;

  const monthIsStale =
    monthAvailability === null ||
    monthAvailability.month !== month ||
    monthAvailability.serviceId !== serviceId ||
    monthAvailability.trainer !== trainer;

  const dayIsStale =
    selectedDate !== null &&
    (dayAvailability === null ||
      dayAvailability.date !== selectedDate ||
      dayAvailability.serviceId !== serviceId ||
      dayAvailability.trainer !== trainer);

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

    fetchMonthAvailability(serviceId, trainer, month, controller.signal)
      .then((data) => {
        setMonthAvailability(data);
        // If the currently-selected date isn't bookable for this service,
        // trainer or month any more, drop it rather than leaving a stale summary.
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
  }, [serviceId, trainer, month, monthIsStale, monthKey, failedKeys, markFailed]);

  /* ---- Day availability ------------------------------------------------ */
  useEffect(() => {
    if (!dayIsStale || selectedDate === null || failedKeys.has(dayKey)) return;

    const controller = new AbortController();

    fetchDayAvailability(serviceId, trainer, selectedDate, controller.signal)
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
  }, [serviceId, trainer, selectedDate, dayIsStale, dayKey, failedKeys, markFailed]);

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

  /*
   * Funnel steps. Fired on the user's own selections only — not on the
   * server-preselected service from `?service=`, which would inflate the top
   * of the funnel with choices nobody made.
   */
  const trackStep = useCallback(
    (step: 'service' | 'date' | 'time', service: ServiceId) => {
      pushEvent({
        event: 'booking_step',
        booking_step: step,
        service_id: service,
        service_name: getService(service)?.name ?? service,
      });
    },
    [],
  );

  const handleServiceChange = useCallback(
    (next: ServiceId) => {
      setServiceId(next);
      clearTime();
      clearErrors();
      trackStep('service', next);
    },
    [clearTime, clearErrors, trackStep],
  );

  const handleTrainerChange = useCallback(
    (next: TrainerSelection) => {
      setTrainer(next);
      // The picked date may not be free for the new trainer; the month refetch
      // that changing `trainer` triggers will drop it if so. Reset the time here.
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
      trackStep('date', serviceId);
    },
    [clearTime, clearErrors, trackStep, serviceId],
  );

  const handleSelectTime = useCallback(
    (time: Time) => {
      setSelectedTime(time);
      trackStep('time', serviceId);
    },
    [trackStep, serviceId],
  );

  const handleSelectHour = useCallback((hour: number) => {
    setSelectedHour(hour);
    setSelectedTime(null);
  }, []);

  const handleFieldChange = useCallback(
    (field: 'name' | 'phone' | 'email' | 'comment', value: string) => {
      if (field === 'name') setName(value);
      if (field === 'phone') setPhone(value);
      if (field === 'email') setEmail(value);
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
    setEmail('');
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
        trainer,
        date: selectedDate,
        time: selectedTime,
        name,
        phone,
        ...(email ? { email } : {}),
        ...(comment ? { comment } : {}),
      });
      setStatus('success');

      /*
       * The site's one real conversion. Pushed only after the API accepted the
       * booking, so a 409 or a validation failure never counts as a lead.
       *
       * Note what is absent: name, phone, email and comment. Those go to the
       * booking API and nowhere else — the dataLayer is readable by every tag in
       * the container, and sending personal data to Analytics breaks Google's
       * terms as well as being the wrong thing to do.
       */
      pushEvent({
        event: 'booking_submitted',
        service_id: serviceId,
        service_name: getService(serviceId)?.name ?? serviceId,
        booking_date: selectedDate,
        booking_time: selectedTime,
      });

      // Re-read availability so the just-booked slot shows as taken.
      const [day, monthData] = await Promise.all([
        fetchDayAvailability(serviceId, trainer, selectedDate),
        fetchMonthAvailability(serviceId, trainer, month),
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
          void fetchDayAvailability(serviceId, trainer, selectedDate).then(
            setDayAvailability,
          );
        }
      } else {
        setErrorMessage('Не вдалося надіслати заявку. Спробуйте ще раз.');
      }
    }
  }, [serviceId, trainer, selectedDate, selectedTime, name, phone, email, comment, month]);

  /* ---- Render ---------------------------------------------------------- */

  return (
    <div className={styles.widget}>
      {/*
       * The two column wrappers are `display: contents` below 1024px, so on
       * phones the steps stay direct children of the flex column and read
       * 1-2-3-4-form. From 1024px they become real columns, each flowing
       * independently — which is what keeps the form tucked under the trainer
       * picker instead of being stranded below the taller calendar column.
       */}
      <div className={styles.colChoice}>
        <div className={styles.step}>
          <h3 className={styles.stepLabel}>1 · Послуга</h3>
          <ServicePicker value={serviceId} onChange={handleServiceChange} />
        </div>

        <div className={styles.step}>
          <h3 className={styles.stepLabel}>2 · Тренер</h3>
          <TrainerPicker value={trainer} onChange={handleTrainerChange} />
        </div>

        <div className={styles.formSlot}>
          <BookingForm
            serviceId={serviceId}
            trainer={trainer}
            date={selectedDate}
            time={selectedTime}
            name={name}
            phone={phone}
            email={email}
            comment={comment}
            status={status}
            errorMessage={errorMessage}
            fieldErrors={fieldErrors}
            onFieldChange={handleFieldChange}
            onSubmit={() => void handleSubmit()}
            onReset={handleReset}
          />
        </div>
      </div>

      <div className={styles.colSchedule}>
        <div className={styles.step}>
          <h3 className={styles.stepLabel}>3 · Дата</h3>
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
          <h3 className={styles.stepLabel}>4 · Час</h3>
          {selectedDate ? (
            <TimePicker
              availability={dayAvailability}
              selectedHour={selectedHour}
              selectedTime={selectedTime}
              loading={dayLoading}
              onSelectHour={handleSelectHour}
              onSelectTime={handleSelectTime}
            />
          ) : (
            <p className={styles.hint}>Спочатку оберіть дату у календарі.</p>
          )}
        </div>
      </div>
    </div>
  );
}
