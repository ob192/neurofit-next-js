export type Review = {
  id: string;
  rating: number;
  quote: string;
  author: string;
};

/**
 * Placeholder testimonials carried over from the design mock.
 *
 * These are rendered visually but deliberately NOT emitted as schema.org
 * Review / aggregateRating markup — see src/lib/seo/jsonLd.ts. Marking up
 * unverified testimonials as review data is exactly the pattern Google's
 * structured-data spam policy targets, and it can cost the whole page its rich
 * results. Swap in real, attributable reviews before adding that markup.
 */
export const reviews: readonly Review[] = [
  {
    id: 'olena',
    rating: 5,
    quote:
      '«За два місяці EMS я побачила результат, якого не могла досягти роками у залі.»',
    author: 'Олена, 34',
  },
  {
    id: 'andrii',
    rating: 5,
    quote: '«Зручно, швидко й ефективно. Тренер завжди поруч і контролює кожен рух.»',
    author: 'Андрій, 29',
  },
  {
    id: 'mariia',
    rating: 5,
    quote:
      '«Найкраща студія Чернігова. Стретчинг після роботи — це просто відновлення для тіла.»',
    author: 'Марія, 41',
  },
];
