/**
 * Hero copy.
 *
 * Nothing here is a new claim: the 30-minutes-vs-2-hours comparison already
 * shipped as prose in `site.seoDescription` and the EMS service description.
 * It is split into labelled parts only so the hero can render it as a scannable
 * proof strip instead of a sentence buried in the sub-heading.
 */

export const hero = {
  headline: {
    top: 'EMS-тренування,',
    bottom: 'Stretching, Бокс',
  },

  /** Sub-heading. The comparison it used to carry now lives in `proof`. */
  lead: 'Швидкий результат із персональним тренером.',

  proof: {
    from: { value: '30', unit: 'хв', label: 'EMS-тренування' },
    to: { value: '2', unit: 'год', label: 'у звичайному залі' },
    /**
     * Read aloud in place of the split cells — "30 хв = 2 год" announced
     * fragment by fragment is meaningless without the surrounding sentence.
     */
    srSummary:
      '30 хвилин EMS дають навантаження, порівнянне з 2 годинами у звичайному залі.',
  },

  ctaLabel: 'Записатися на перше тренування',

  /**
   * An aria-label replaces the link's text outright, so the number has to be
   * repeated here — labelling it "Зателефонувати до студії" alone would hide
   * the phone number from screen readers.
   */
  callAriaLabel: (phone: string) => `Зателефонувати до студії: ${phone}`,
} as const;
