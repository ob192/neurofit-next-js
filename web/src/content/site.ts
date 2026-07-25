/**
 * Single source of truth for the studio's name, address and phone (NAP).
 *
 * These values are rendered in the footer *and* emitted as JSON-LD, so they
 * must agree exactly — inconsistent NAP data across a page is a well-known way
 * to lose local-search confidence.
 */

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

export const site = {
  name: 'NeuroFit',
  legalName: 'NeuroFit',
  locale: 'uk_UA',
  lang: 'uk',
  tagline: 'Студія персональних тренувань • Чернігів',
  description:
    'Студія персональних тренувань у Чернігові. EMS-тренування, стретчинг та бокс з персональним тренером.',
  seoDescription:
    'EMS-тренування, стретчинг і бокс у Чернігові. 30 хвилин EMS = 2 години у звичайному залі. Персональний тренер, онлайн-запис, щодня 7:00–22:00.',

  phone: {
    /** Display form, exactly as it appears in the design. */
    display: '063 377 08 88',
    /** E.164 — used for tel: links and JSON-LD. */
    e164: '+380633770888',
  },

  address: {
    street: 'Проспект Перемоги, 119а',
    city: 'Чернігів',
    region: 'Чернігівська область',
    postalCode: '14000',
    country: 'UA',
    /** Pre-composed single line, as printed in the footer. */
    full: 'Проспект Перемоги, 119а, Чернігів',
  },

  hours: {
    opens: '07:00',
    closes: '22:00',
    /** Human-readable, as printed in the footer. */
    display: 'Щоденно 7:00 – 22:00',
    short: '7:00 – 22:00',
  },

  social: {
    instagramHandle: '@neurofit.cn',
    instagram: 'https://www.instagram.com/neurofit.cn/',
    facebook: 'https://www.facebook.com/neurofit.cn/',
    telegram: 'https://t.me/neurofit_cn',
  },
} as const;

export const telHref = `tel:${site.phone.e164}`;
