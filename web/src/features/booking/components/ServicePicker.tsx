'use client';

import { Icon } from '@/components/Icon/Icon';
import { services, type ServiceId } from '@/content/services';
import styles from './ServicePicker.module.css';

type ServicePickerProps = {
  value: ServiceId;
  onChange: (serviceId: ServiceId) => void;
};

/**
 * Step 1 — a radiogroup rather than three buttons, so arrow keys move between
 * options and screen readers announce "1 of 3" the way a real choice should.
 */
export function ServicePicker({ value, onChange }: ServicePickerProps) {
  return (
    <div className={styles.row} role="radiogroup" aria-label="Оберіть послугу">
      {services.map((service) => {
        const selected = service.id === value;
        // Formats the studio hasn't opened for online booking stay visible but
        // inert, so the offer is still advertised without promising a slot.
        const disabled = !service.bookable;
        return (
          <button
            key={service.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            aria-label={
              disabled
                ? `${service.shortName} — запис онлайн тимчасово недоступний`
                : undefined
            }
            className={[
              styles.option,
              selected ? styles.selected : '',
              disabled ? styles.disabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(service.id)}
          >
            <Icon name={service.icon} size={20} />
            <span className={styles.label}>{service.shortName}</span>
          </button>
        );
      })}
    </div>
  );
}
