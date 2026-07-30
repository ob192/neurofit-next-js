'use client';

import { Icon } from '@/components/Icon/Icon';
import { trainers, type TrainerSelection } from '@/content/trainers';
import styles from './TrainerPicker.module.css';

type TrainerPickerProps = {
  value: TrainerSelection;
  onChange: (trainer: TrainerSelection) => void;
};

/**
 * Step 2 — choose a trainer, or leave it to the studio.
 *
 * A radiogroup like the service picker, so arrow keys move between options.
 * The first option, "Будь-який", is the default and books whichever trainer is
 * free for the chosen slot.
 */
const options: ReadonlyArray<{ value: TrainerSelection; label: string }> = [
  { value: 'any', label: 'Будь-який' },
  ...trainers.map((trainer) => ({ value: trainer.id, label: trainer.name })),
];

export function TrainerPicker({ value, onChange }: TrainerPickerProps) {
  return (
    <div className={styles.row} role="radiogroup" aria-label="Оберіть тренера">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.option} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(option.value)}
          >
            <Icon name="user-check" size={20} />
            <span className={styles.label}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
