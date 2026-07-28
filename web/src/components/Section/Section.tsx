import type { CSSProperties, ReactNode } from 'react';
import { trackSection } from '@/lib/analytics/gtm';
import styles from './Section.module.css';

type Tone = 'light' | 'lilac' | 'deep';

type SectionProps = {
  id?: string;
  tone?: Tone;
  /**
   * Vertical rhythm between direct children, at phone width. Matches the
   * export's `gap-[Npx]`; the stylesheet scales it up at each breakpoint.
   */
  gap?: number;
  /**
   * Vertical padding at phone width, likewise scaled up per breakpoint.
   * Horizontal padding is not configurable — it is the gutter/--content-max
   * calculation in the stylesheet, which every section shares.
   */
  padY?: number;
  className?: string;
  'aria-labelledby'?: string;
  children: ReactNode;
};

/**
 * The shared vertical band every landing section sits in. The original export
 * repeated the same flex-column + padding + background triplet on each
 * `Section/*` div; this centralises it and leaves only the genuinely unique
 * styling to each feature's own module.
 */
export function Section({
  id,
  tone = 'light',
  gap,
  padY,
  className,
  children,
  ...rest
}: SectionProps) {
  const classes = [styles.section, styles[tone], className].filter(Boolean).join(' ');

  return (
    <section
      id={id}
      /*
       * Section-visibility marker for GTM, derived from the id a section
       * already has rather than added per feature. Nothing reads it in the app
       * — the container's element-visibility trigger does — so the sections
       * stay server-rendered and ship no JavaScript for it.
       */
      {...(id ? trackSection(id) : {})}
      className={classes}
      style={
        {
          ...(gap !== undefined ? { '--section-gap': `${gap}px` } : {}),
          ...(padY !== undefined ? { '--section-pad-y': `${padY}px` } : {}),
        } as CSSProperties
      }
      aria-labelledby={rest['aria-labelledby']}
    >
      {children}
    </section>
  );
}
