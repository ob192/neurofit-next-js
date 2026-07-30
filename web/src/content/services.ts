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
      src: 'https://images.unsplash.com/photo-1705885054951-11e5454f4567?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODQ2MjcyNDF8&ixlib=rb-4.1.0&q=80&w=1080',
      alt: 'Тренування в EMS-костюмі під наглядом персонального тренера',
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
      src: 'https://images.unsplash.com/photo-1758520704946-74b96f67ded3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODQ2MjcyNDJ8&ixlib=rb-4.1.0&q=80&w=1080',
      alt: 'Заняття зі стретчингу — розтяжка під контролем тренера',
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
      src: 'https://images.unsplash.com/photo-1636581563815-9c40c35abe0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3ODQ2MjcyNDR8&ixlib=rb-4.1.0&q=80&w=1080',
      alt: 'Боксерське тренування з персональним тренером',
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
