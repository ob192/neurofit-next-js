'use client';

import { useId } from 'react';
import { Icon } from '@/components/Icon/Icon';
import { site, telHref } from '@/content/site';
import { getService } from '@/content/services';
import type { ServiceId } from '@/content/services';
import type { IsoDate, Time } from '../types';
import { formatDayMonth } from '@/lib/date';
import styles from './BookingForm.module.css';

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

type BookingFormProps = {
  serviceId: ServiceId;
  date: IsoDate | null;
  time: Time | null;
  name: string;
  phone: string;
  comment: string;
  status: SubmitStatus;
  errorMessage: string | null;
  fieldErrors: Record<string, string>;
  onFieldChange: (field: 'name' | 'phone' | 'comment', value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
};

/**
 * The purple summary card from the design, plus the contact fields.
 *
 * The original mock had no inputs at all — it showed a summary and a
 * "Підтвердити запис" button with nothing to submit. A booking request needs a
 * name and a callback number, so those two fields are added here in the same
 * visual language; the comment is optional.
 */
export function BookingForm({
  serviceId,
  date,
  time,
  name,
  phone,
  comment,
  status,
  errorMessage,
  fieldErrors,
  onFieldChange,
  onSubmit,
  onReset,
}: BookingFormProps) {
  const fieldId = useId();
  const service = getService(serviceId);
  const complete = Boolean(date && time);

  const summary = complete
    ? `${service?.shortName ?? ''} · ${formatDayMonth(date as IsoDate)} · ${time}`
    : date
      ? // A date is already picked (the server preselects the soonest one), so
        // prompt for the step that's actually outstanding.
        `${service?.shortName ?? ''} · ${formatDayMonth(date)} · оберіть час`
      : 'Оберіть дату та час';

  if (status === 'success') {
    return (
      <div className={styles.card} role="status">
        <div className={styles.successHead}>
          <Icon name="badge-check" size={26} />
          <span className={styles.successTitle}>Заявку надіслано</span>
        </div>
        <p className={styles.successText}>
          Ми зателефонуємо на {phone || site.phone.display}, щоб підтвердити запис
          {complete ? `: ${summary}` : ''}.
        </p>
        <button type="button" className={styles.confirm} onClick={onReset}>
          <span>Записатися ще раз</span>
          <Icon name="arrow-right" size={18} />
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div className={styles.summaryRow}>
        <span className={styles.summaryText}>
          <span className={styles.summaryCaption}>ВАШ ЗАПИС</span>
          <span className={styles.summaryValue}>{summary}</span>
        </span>
        <span className={complete ? styles.badgeActive : styles.badge}>
          <Icon name="badge-check" size={26} />
        </span>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className="srOnly" htmlFor={`${fieldId}-name`}>
            Ваше ім’я
          </label>
          <input
            id={`${fieldId}-name`}
            className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
            type="text"
            name="name"
            autoComplete="given-name"
            placeholder="Ваше ім’я"
            value={name}
            onChange={(event) => onFieldChange('name', event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? `${fieldId}-name-error` : undefined}
          />
          {fieldErrors.name ? (
            <span id={`${fieldId}-name-error`} className={styles.fieldError}>
              {fieldErrors.name}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className="srOnly" htmlFor={`${fieldId}-phone`}>
            Номер телефону
          </label>
          <input
            id={`${fieldId}-phone`}
            className={`${styles.input} ${fieldErrors.phone ? styles.inputError : ''}`}
            type="tel"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="095 123 45 67"
            value={phone}
            onChange={(event) => onFieldChange('phone', event.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? `${fieldId}-phone-error` : undefined}
          />
          {fieldErrors.phone ? (
            <span id={`${fieldId}-phone-error`} className={styles.fieldError}>
              {fieldErrors.phone}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className="srOnly" htmlFor={`${fieldId}-comment`}>
            Коментар (необов’язково)
          </label>
          <input
            id={`${fieldId}-comment`}
            className={styles.input}
            type="text"
            name="comment"
            placeholder="Коментар (необов’язково)"
            value={comment}
            onChange={(event) => onFieldChange('comment', event.target.value)}
          />
        </div>
      </div>

      {/* Slot-level failures (e.g. the time was taken while filling the form). */}
      {errorMessage ? (
        <p className={styles.formError} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        className={styles.confirm}
        disabled={!complete || status === 'submitting'}
      >
        <span>{status === 'submitting' ? 'Надсилаємо…' : 'Підтвердити запис'}</span>
        <Icon name="arrow-right" size={18} />
      </button>

      <p className={styles.note}>
        Або зателефонуйте:{' '}
        <a className={styles.noteLink} href={telHref}>
          {site.phone.display}
        </a>
      </p>
    </form>
  );
}
