/**
 * Copy for the booking section.
 *
 * The section no longer contains a calendar — booking moved to the studio's
 * Telegram bot — so this copy has one job: make it obvious what happens after
 * the button is pressed. People are reluctant to leave a page for a chat they
 * can't preview, and "менеджер напише вам" is the reassurance that closes that
 * gap.
 *
 * `note` is practical information the studio wants every client to see before
 * they book — it answers "what do I need to bring?" without them having to ask.
 */
export const booking = {
  kicker: 'ЗАПИС У TELEGRAM',
  title: 'Забронюйте тренування',
  /**
   * Opening hours are passed in from `content/site.ts` rather than repeated
   * here — the footer, the JSON-LD and this sentence must not drift apart.
   */
  desc: (opens: string, closes: string) =>
    `Запис веде наш Telegram-бот: оберіть формат — і менеджер студії напише вам, щоб підтвердити зручний час. Працюємо щодня з ${opens} до ${closes}.`,
  note: 'Потрібне лише змінне взуття — форму видаємо.',

  /** The three-step explainer that stands in for the old calendar. */
  steps: [
    'Натисніть кнопку — відкриється чат із нашим ботом.',
    'Оберіть формат тренування.',
    'Менеджер відповість у тому ж чаті й підтвердить час.',
  ],

  formatsLabel: 'Або одразу оберіть формат:',
  formatAriaLabel: (format: string) => `Записатися на ${format} у Telegram`,

  cta: 'Записатися в Telegram',

  fallbackLead: 'Не користуєтесь Telegram?',
  fallbackCta: 'Зателефонуйте нам',
} as const;
