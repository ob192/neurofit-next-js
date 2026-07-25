import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'white' | 'ink';

type CommonProps = {
  variant?: Variant;
  /** Stretch to the full column width — the default for this design. */
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

type LinkProps = CommonProps & { href: string };

function classes(variant: Variant, fullWidth: boolean, className?: string) {
  return [styles.button, styles[variant], fullWidth ? styles.fullWidth : null, className]
    .filter(Boolean)
    .join(' ');
}

/** The white pill CTA used in the hero, booking summary and footer. */
export function Button({
  variant = 'white',
  fullWidth = true,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type="button" className={classes(variant, fullWidth, className)} {...rest}>
      {children}
    </button>
  );
}

/** Same visual treatment, rendered as an anchor (tel:, external links). */
export function ButtonLink({
  variant = 'white',
  fullWidth = true,
  className,
  href,
  children,
}: LinkProps) {
  const isExternal = href.startsWith('http');

  return (
    <a
      href={href}
      className={classes(variant, fullWidth, className)}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
