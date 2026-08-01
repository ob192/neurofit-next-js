import type { IconName } from '@/components/Icon/Icon';

export type ServiceId = 'ems' | 'stretching' | 'boxing';

export type Service = {
  id: ServiceId;
  /** Full name used in cards and JSON-LD. */
  name: string;
  /** Short name used in the booking service picker chips. */
  shortName: string;
  description: string;
  tags: readonly string[];
  icon: IconName;
  /** Session length in minutes — drives slot generation in the mock API. */
  durationMinutes: number;
  /**
   * Whether the format can be booked online right now. A non-bookable format is
   * still advertised — it just can't be selected in the booking widget, and the
   * API refuses it. Set to `false` for EMS Boxing until the studio opens it up.
   */
  bookable: boolean;
  image: {
    src: string;
    alt: string;
  };
};

export const services: readonly Service[] = [
  {
    id: 'ems',
    name: 'EMS-тренування',
    shortName: 'EMS',
    description:
      'Лише 30 хвилин заняття дають навантаження, порівнянне з 2 годинами у звичайному залі. Ідеально для схуднення та набору м’язової маси.',
    tags: ['Схуднення', 'М’язи', '30 хв'],
    icon: 'zap',
    durationMinutes: 30,
    bookable: true,
    image: {
      src: '/images/gallery/1-19.webp',
      alt: 'Клієнтка студії в застебнутому EMS-костюмі з електродами',
    },
  },
  {
    id: 'stretching',
    name: 'Стретчинг',
    shortName: 'Стретчинг',
    description:
      'Покращуйте гнучкість, поставу та відновлення тіла у комфортному темпі.',
    tags: ['Гнучкість', 'Постава', 'Релакс'],
    icon: 'move',
    durationMinutes: 30,
    bookable: true,
    image: {
      src: '/images/gallery/1-37.webp',
      alt: 'Нахил убік на занятті зі стретчингу під контролем тренерки',
    },
  },
  {
    id: 'boxing',
    name: 'EMS Boxing',
    shortName: 'EMS Boxing',
    description:
      'Розвивайте силу, витривалість і впевненість у собі під контролем тренера.',
    tags: ['Сила', 'Витривалість', 'Техніка'],
    icon: 'hand',
    durationMinutes: 30,
    // Not yet offered for online booking — shown, but greyed out in the widget.
    bookable: false,
    image: {
      src: '/images/gallery/img-0631.webp',
      alt: 'Удар по боксерському мішку в EMS-костюмі та рукавичках',
    },
  },
];

export const serviceIds = services.map((service) => service.id);

export function getService(id: string): Service | undefined {
  return services.find((service) => service.id === id);
}

export function isServiceId(value: string): value is ServiceId {
  return services.some((service) => service.id === value);
}

/** Narrower than `isServiceId`: the format must also be bookable right now. */
export function isBookableServiceId(value: string): value is ServiceId {
  return services.some((service) => service.id === value && service.bookable);
}

/** What the booking widget starts on when nothing valid was preselected. */
export const defaultBookableServiceId: ServiceId =
  services.find((service) => service.bookable)?.id ?? 'ems';
