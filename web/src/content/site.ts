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

/**
 * Google's own id for the studio's Business Profile, read off the resolved
 * Maps URL the studio supplied: `…!1s0x46d549c9b3eaae49:0x2eb0ede036eebc8c…`.
 * The CID is the second half of that pair in decimal.
 *
 * Every Google URL below is built from it rather than pasted, so the map
 * embed, the "open in Maps" link and the JSON-LD cannot end up pointing at
 * three different listings.
 */
const googleCid = '3364450468895833228';

/** The Maps pin, from the same URL (`@51.4983543,31.3047183,17z`). */
const geo = { latitude: 51.4983543, longitude: 31.3047183 } as const;

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

  /**
   * The studio's Google Business Profile — its identity on Maps and in the
   * local pack.
   *
   * `share` is the link the studio sent; it is a redirector to a Google Search
   * result, so `place` (the canonical `?cid=` form it resolves to) is what
   * goes into the markup. A redirector in `sameAs` is a weaker identity signal
   * than the URL it redirects to.
   *
   * `embed` is the keyless Maps Embed variant Google itself returns for
   * `?cid=…&output=embed`, pinned to Ukrainian. It only renders inside an
   * iframe — opening it directly returns an error page.
   */
  google: {
    share: 'https://share.google/ZBlPyOcr1s85uNQwL',
    place: `https://www.google.com/maps?cid=${googleCid}`,
    embed: `https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s${googleCid}!3m1!1suk!5m1!1suk`,
    /** Maps URLs API — opens turn-by-turn directions in the user's Maps app. */
    directions: `https://www.google.com/maps/dir/?api=1&destination=${geo.latitude},${geo.longitude}`,
    /** Emitted as `geo` in the JSON-LD; same figures as the Maps pin. */
    geo,
  },

  social: {
    instagramHandle: '@neuro_fit_ems_studio',
    instagram: 'https://www.instagram.com/neuro_fit_ems_studio/',
    /** Instagram post the studio uses to show how to find the entrance. */
    directions: 'https://www.instagram.com/p/DOGOCjzClqw/',
    /* NOTE: these two still point at the old `neurofit.cn` handle. Unconfirmed
       — the studio only supplied the new Instagram. */
    facebook: 'https://www.facebook.com/neurofit.cn/',
    telegram: 'https://t.me/neurofit_cn',
  },
} as const;

export const telHref = `tel:${site.phone.e164}`;
