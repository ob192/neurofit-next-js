import type { ReactNode } from 'react';
import styles from './Tag.module.css';

/** The small lilac keyword chips under each service card ("Схуднення", "30 хв"). */
export function Tag({ children }: { children: ReactNode }) {
  return <li className={styles.tag}>{children}</li>;
}

export function TagList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}
