import { site } from './site';

/**
 * Copy for the map section.
 *
 * Nothing here is a new factual claim about the studio: the address and hours
 * are read from `site.ts`, and the rest describes the controls on screen. Do
 * not add landmark or "how to get in" wording — that is the studio's Instagram
 * post (`site.social.directions`), which is linked from the footer.
 */
export const location = {
  eyebrow: 'ЯК ДО НАС ДІСТАТИСЯ',
  heading: 'Студія на карті',
  addressCaption: 'Адреса',
  hoursCaption: 'Графік роботи',
  directionsLabel: 'Прокласти маршрут',
  placeLabel: 'Відкрити в Google Картах',

  /**
   * Accessible name for the map iframe. An untitled frame is announced as
   * "frame" and nothing else, and this one is the only content in the section.
   */
  mapTitle: `Карта Google: ${site.name}, ${site.address.full}`,
} as const;
