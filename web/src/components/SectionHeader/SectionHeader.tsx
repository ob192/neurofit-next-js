import type { ReactNode } from 'react';
import styles from './SectionHeader.module.css';

type SectionHeaderProps = {
  /** Small tracked-out label above the heading ("НАШІ ПОСЛУГИ"). */
  eyebrow?: string;
  heading: ReactNode;
  headingId?: string;
  description?: string;
  /** `deep` inverts the palette for sections sitting on purple. */
  tone?: 'light' | 'deep';
  /** Heading level — the page has one h1 in the hero, so sections use h2. */
  as?: 'h2' | 'h3';
};

export function SectionHeader({
  eyebrow,
  heading,
  headingId,
  description,
  tone = 'light',
  as: Heading = 'h2',
}: SectionHeaderProps) {
  return (
    <header className={`${styles.header} ${styles[tone]}`}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <Heading id={headingId} className={styles.heading}>
        {heading}
      </Heading>
      {description ? <p className={styles.description}>{description}</p> : null}
    </header>
  );
}
