export type GalleryTile = {
  src: string;
  alt: string;
};

/**
 * The Instagram preview grid in the Media section, opened as a lightbox on
 * click. Photos are studio originals, compressed to WebP in
 * `public/images/gallery/`. The full set lives there; swap any `src` below to
 * re-curate the grid.
 *
 * Order is the order they are browsed in, so the formats are interleaved
 * rather than grouped — a visitor arrowing through gets EMS, boxing and
 * stretching rather than four near-identical kettlebell shots in a row.
 *
 * `1-68`, `1-4` and `img-0631` are deliberately absent: they are the three
 * service-card photos in `content/services.ts`, and showing them again here
 * would make the page look shorter on photos than it is. `1-69` was held back
 * for the hero, which no longer carries a photo, so it is free to curate in.
 */
export const galleryTiles: readonly GalleryTile[] = [
  {
    src: '/images/gallery/1-102-2.webp',
    alt: 'Чоловік в EMS-костюмі на кардіотренажері',
  },
  {
    src: '/images/gallery/1-14-2.webp',
    alt: 'Вертикальний шпагат на килимку в залі студії',
  },
  {
    src: '/images/gallery/img-0629.webp',
    alt: 'Відпрацювання ударів на лапах у парі з тренером',
  },
  {
    src: '/images/gallery/1-76.webp',
    alt: 'Тяга з гирею на одній нозі в EMS-костюмі',
  },
  {
    src: '/images/gallery/1-46.webp',
    alt: 'Тяга на TRX-петлях в EMS-костюмі',
  },
  {
    src: '/images/gallery/1-37.webp',
    alt: 'Нахил убік на занятті зі стретчингу під контролем тренерки',
  },
  {
    src: '/images/gallery/1-89.webp',
    alt: 'Тяга на блоковому тренажері в EMS-костюмі',
  },
  {
    src: '/images/gallery/img-0632.webp',
    alt: 'Удари по боксерському мішку в EMS-костюмі',
  },
  {
    src: '/images/gallery/1-61.webp',
    alt: 'Гиря в руках спортсменки — крупний план',
  },
  {
    src: '/images/gallery/1-45.webp',
    alt: 'Присід із розкриттям стегон на килимку',
  },
  {
    src: '/images/gallery/1-17.webp',
    alt: 'Нахил уперед із вагою в EMS-костюмі біля дзеркала',
  },
  {
    src: '/images/gallery/1-33.webp',
    alt: 'Зал студії NeuroFit із неоновою вивіскою',
  },
];
