import type { IconName } from '@/components/Icon/Icon';

/**
 * Price list supplied by the studio (EMS from their published price card,
 * stretching quoted directly). Everything here is their figure — nothing is
 * derived except the per-session rate, which is computed from `price` and
 * `sessions` so a package total and its unit price can never drift apart.
 *
 * Boxing is deliberately absent: no prices were supplied for it. Do not
 * interpolate them from the EMS or stretching rates — see docs/CURRENT_STATE.md.
 */

export type PriceItem = {
  name: string;
  /** UAH. Integers only — the studio prices in whole hryvnia. */
  price: number;
  /** Sessions included, for packages. Drives the per-session line. */
  sessions?: number;
  /** Qualifier under the name, e.g. group size. */
  note?: string;
  /** Saving vs the single-session rate, as stated by the studio. */
  savingPercent?: number;
  /** Renders as the "best value" card. At most one per group. */
  best?: boolean;
};

export type PriceGroup = {
  id: string;
  title: string;
  icon: IconName;
  singles: readonly PriceItem[];
  packages: readonly PriceItem[];
};

export const priceGroups: readonly PriceGroup[] = [
  {
    id: 'ems',
    title: 'EMS-тренування',
    icon: 'zap',
    singles: [
      { name: 'Основне тренування', price: 600 },
      { name: 'Пробне тренування', price: 500 },
      { name: 'Лімфодренажний масаж', price: 400 },
    ],
    packages: [
      { name: '4 тренування', price: 2200, sessions: 4 },
      { name: '8 тренувань', price: 3800, sessions: 8 },
      { name: '12 тренувань', price: 5000, sessions: 12, savingPercent: 30, best: true },
    ],
  },
  {
    id: 'stretching',
    title: 'Стретчинг',
    icon: 'move',
    singles: [
      { name: 'Індивідуальне тренування', price: 500 },
      { name: 'Міні-група', price: 400, note: 'до 5 осіб · ціна за особу' },
    ],
    packages: [
      { name: '4 тренування', price: 1900, sessions: 4 },
      { name: '8 тренувань', price: 3600, sessions: 8 },
      { name: '10 тренувань', price: 4200, sessions: 10, savingPercent: 16, best: true },
    ],
  },
];

export const pricingCopy = {
  eyebrow: 'ЦІНИ',
  heading: 'Вартість тренувань',
  headingId: 'pricing-heading',
  description:
    'Разові заняття та абонементи. Чим більше тренувань в абонементі, тим нижча ціна за одне заняття.',
  singlesLabel: 'Разові заняття',
  packagesLabel: 'Абонементи',
  bestBadge: 'Найвигідніше',
  currency: 'грн',
  ctaLabel: 'Записатися на тренування',

  /** `approx` is set when the total doesn't divide evenly across sessions. */
  perSession: (value: number, approx: boolean) =>
    `${approx ? '≈ ' : ''}${value} грн / тренування`,
  saving: (percent: number) => `економія ${percent}%`,
  /** Screen-reader form — "600 грн" reads as a bare number otherwise. */
  priceLabel: (value: number) => `${value} гривень`,
} as const;

/** Unit price for a package, rounded, plus whether the rounding was lossy. */
export function perSessionRate(item: PriceItem): { value: number; approx: boolean } | null {
  if (!item.sessions) return null;
  return {
    value: Math.round(item.price / item.sessions),
    approx: item.price % item.sessions !== 0,
  };
}
