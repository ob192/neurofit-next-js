'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/Icon/Icon';
import type { GalleryTile } from '@/content/gallery';
import styles from './GalleryGrid.module.css';

type GalleryGridProps = {
  tiles: readonly GalleryTile[];
};


/**
 * The Instagram grid, with a lightbox for viewing a photo full size.
 *
 * Built on `<dialog>` + `showModal()` rather than a hand-rolled overlay: that
 * is what buys the focus trap, the inert background, Escape-to-close and the
 * top-layer stacking for free. The only thing this component adds is the
 * arrow-key navigation and restoring focus to the tile that opened it —
 * `<dialog>` returns focus to the invoker on its own, but only if the invoker
 * is still the same element, which it is here.
 *
 * This is the one client component outside `features/booking/`. A lightbox
 * needs state and key handlers; there is no server-rendered equivalent.
 */
export function GalleryGrid({ tiles }: GalleryGridProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const open = useCallback((index: number) => {
    setOpenIndex(index);
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        // Wraps, so holding an arrow key never dead-ends on the last photo.
        return (current + delta + tiles.length) % tiles.length;
      });
    },
    [tiles.length],
  );

  // Escape and the backdrop close the dialog without going through `close()`,
  // so the open index has to follow the element's own state rather than the
  // other way round.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => setOpenIndex(null);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  };

  const current = openIndex === null ? null : tiles[openIndex];

  return (
    <>
      <ul className={styles.gallery}>
        {tiles.map((tile, index) => (
          <li key={tile.src} className={styles.tile}>
            <button
              type="button"
              className={styles.tileButton}
              onClick={() => open(index)}
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes="(min-width: 1024px) 180px, (min-width: 768px) 160px, 33vw"
                className={styles.tileInner}
              />
              <span className="srOnly">Відкрити фото: {tile.alt}</span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-label="Перегляд фото студії"
        onKeyDown={handleKeyDown}
        /*
         * Click-outside-to-close. The frame fills the dialog, so testing for
         * the dialog element alone would never match; the surfaces that count
         * as "outside the photo" opt in with `data-dismiss` instead, and the
         * photo and the controls sit below them and so never match.
         */
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target === dialogRef.current || target.dataset.dismiss !== undefined) {
            close();
          }
        }}
      >
        {current ? (
          <div className={styles.frame} data-dismiss>
            <div className={styles.stage} data-dismiss>
              <Image
                key={current.src}
                src={current.src}
                alt={current.alt}
                fill
                sizes="(min-width: 768px) 60vh, 100vw"
                className={styles.stageInner}
              />
            </div>

            <p className={styles.caption}>
              <span>{current.alt}</span>
              <span className={styles.counter}>
                {(openIndex ?? 0) + 1} / {tiles.length}
              </span>
            </p>

            <button
              type="button"
              className={`${styles.nav} ${styles.navPrev}`}
              onClick={() => step(-1)}
              aria-label="Попереднє фото"
            >
              <Icon name="chevron-left" size={20} />
            </button>

            <button
              type="button"
              className={`${styles.nav} ${styles.navNext}`}
              onClick={() => step(1)}
              aria-label="Наступне фото"
            >
              <Icon name="chevron-right" size={20} />
            </button>

            {/* `iconPaths.ts` is generated from the export and has no close
                glyph, so the multiplication sign stands in for one. */}
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Закрити перегляд"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
