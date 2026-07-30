export type GalleryTile = {
  src: string;
  alt: string;
};

/**
 * The 2x3 Instagram preview grid in the Media section.
 * Photos are studio originals, compressed to WebP in `public/images/gallery/`.
 * The full set lives there; swap any `src` below to re-curate the grid.
 */
export const galleryTiles: readonly GalleryTile[] = [
  {
    src: '/images/gallery/1-31.webp',
    alt: 'Групове тренування в залі студії NeuroFit',
  },
  {
    src: '/images/gallery/1-45.webp',
    alt: 'Чоловік на TRX-петлях у EMS-костюмі',
  },
  {
    src: '/images/gallery/1-61.webp',
    alt: 'Випади в EMS-костюмі під фірмовим освітленням студії',
  },
  {
    src: '/images/gallery/1-37.webp',
    alt: 'Присідання з гирею на персональному занятті',
  },
  {
    src: '/images/gallery/img-0629.webp',
    alt: 'Бокс на лапах із тренером у студії NeuroFit',
  },
  {
    src: '/images/gallery/1-4.webp',
    alt: 'Розтяжка на килимку після тренування',
  },
];
