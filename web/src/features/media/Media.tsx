import { Section } from '@/components/Section/Section';
import { Icon } from '@/components/Icon/Icon';
import { site } from '@/content/site';
import { galleryTiles } from '@/content/gallery';
import { reviews } from '@/content/reviews';
import { cta } from '@/lib/analytics/gtm';
import { GalleryGrid } from './GalleryGrid';
import styles from './Media.module.css';

export function Media() {
  return (
    <Section
      id="media"
      tone="lilac"
      gap={24}
      padY={48}
      aria-labelledby="media-heading"
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>СЛІДКУЙТЕ ЗА НАМИ</p>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>
            <Icon name="instagram" size={28} />
          </span>
          <h2 id="media-heading" className={styles.heading}>
            Ми в Instagram
          </h2>
        </div>
        <p className={styles.handle}>{site.social.instagramHandle}</p>
      </header>

      <GalleryGrid tiles={galleryTiles} />

      <a
        className={styles.subscribe}
        {...cta('media-instagram')}
        href={site.social.instagram}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="instagram" size={20} />
        <span>Підписатися</span>
      </a>

      <h3 className={styles.reviewsHeading}>Про нас пишуть</h3>

      <ul className={styles.quotes}>
        {reviews.map((review) => (
          <li key={review.id}>
            <figure className={styles.quote}>
              <p className={styles.stars} aria-label={`Оцінка ${review.rating} з 5`}>
                <span aria-hidden="true">{'★'.repeat(review.rating)}</span>
              </p>
              <blockquote className={styles.quoteText}>{review.quote}</blockquote>
              <figcaption className={styles.quoteAuthor}>{review.author}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
