import styles from './Brand.module.css';

type BrandProps = {
  /** `sm` is the hero top bar, `lg` is the footer. */
  size?: 'sm' | 'lg';
};

/** The "N" tile plus the NeuroFit wordmark. */
export function Brand({ size = 'sm' }: BrandProps) {
  return (
    <div className={`${styles.brand} ${styles[size]}`}>
      <span className={styles.mark} aria-hidden="true">
        N
      </span>
      <span className={styles.wordmark}>NeuroFit</span>
    </div>
  );
}
