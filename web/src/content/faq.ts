export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  /**
   * True when the answer was drafted during the Next.js migration rather than
   * taken from the original design.
   *
   * The source index.html only spelled out the first answer — the other five
   * accordion rows were rendered collapsed and had no answer text at all. A
   * schema.org FAQPage entry is invalid without an acceptedAnswer, and shipping
   * marked-up answers that contradict what the studio actually tells clients is
   * worse than shipping none. Everything flagged here needs a factual review by
   * the studio before launch; see `faqNeedsReview` below.
   */
  drafted?: boolean;
};

export const faqItems: readonly FaqItem[] = [
  {
    id: 'what-is-ems',
    question: 'Що таке EMS-тренування?',
    // Verbatim from the original export.
    answer:
      'EMS — це тренування з електростимуляцією м’язів. Спеціальний костюм подає мікроімпульси, що змушують м’язи скорочуватися глибше, ніж під час звичайного заняття.',
  },
  {
    id: 'is-ems-safe',
    question: 'Чи безпечні EMS-тренування?',
    answer:
      'Так, за умови роботи з підготовленим тренером. Кожне заняття проходить індивідуально, інтенсивність імпульсів підбирається під ваш рівень. Є перелік протипоказань (зокрема вагітність, кардіостимулятор, епілепсія, гострі запальні процеси) — тренер обов’язково уточнює їх перед першим заняттям.',
    drafted: true,
  },
  {
    id: 'session-length',
    question: 'Скільки триває одне заняття?',
    answer:
      'Саме EMS-тренування триває 30 хвилин. Разом із підготовкою, вдяганням костюма та розтяжкою варто закласти близько години.',
    drafted: true,
  },
  {
    id: 'beginners',
    question: 'Чи підходить це новачкам?',
    answer:
      'Так. EMS не потребує попереднього досвіду чи спортивної підготовки — навантаження задає обладнання, а не вага снарядів. Тренер веде вас 1:1 від першого заняття й коригує техніку на кожному русі.',
    drafted: true,
  },
  {
    id: 'what-to-bring',
    question: 'Що взяти з собою на перше тренування?',
    answer:
      'Достатньо змінного одягу для тренувань, кросівок і рушника. Спеціальну білизну під EMS-костюм та воду ми надаємо у студії.',
    drafted: true,
  },
  {
    id: 'how-to-book',
    question: 'Як записатися?',
    answer:
      'Оберіть послугу, дату та час у формі онлайн-запису на цій сторінці — і ми підтвердимо бронювання. Також можна просто зателефонувати за номером 063 377 08 88.',
    drafted: true,
  },
];

/** Questions whose answers still need sign-off from the studio. */
export const faqNeedsReview = faqItems.filter((item) => item.drafted);
