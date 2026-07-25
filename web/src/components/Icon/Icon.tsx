import { ICON_VIEW_BOX, iconPaths, type IconName } from './iconPaths';

export type { IconName };

type IconProps = {
  name: IconName;
  /** Rendered size in px (the glyphs are square). */
  size?: number;
  className?: string;
  /**
   * Icons are decorative by default and hidden from assistive tech. Pass a
   * label only when the icon is the sole carrier of meaning.
   */
  label?: string;
};

export function Icon({ name, size = 16, className, label }: IconProps) {
  return (
    <svg
      viewBox={ICON_VIEW_BOX}
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
