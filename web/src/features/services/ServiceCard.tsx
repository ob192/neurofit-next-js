import Image from 'next/image';
import { Icon } from '@/components/Icon/Icon';
import { Tag, TagList } from '@/components/Tag/Tag';
import type { Service } from '@/content/services';
import { bookingHref } from '@/content/site';
import { cta } from '@/lib/analytics/gtm';
import styles from './Services.module.css';

export function ServiceCard({ service }: { service: Service }) {
  return (
    <li className={styles.card}>
      <div className={styles.photo}>
        <Image
          src={service.image.src}
          alt={service.image.alt}
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 768px) 50vw, 100vw"
          className={styles.photoInner}
        />
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{service.name}</h3>
        <p className={styles.cardDesc}>{service.description}</p>

        <TagList>
          {service.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </TagList>

        {/*
          Through `/go/tg`, which logs the click and redirects. The service id
          survives the hop as the bot's `/start` payload, so the chat still
          opens with this format already chosen.

          `noopener` without `noreferrer`: the first hop is our own domain, and
          `noreferrer` would strip the header the redirect reads the campaign
          parameters from.
        */}
        <a
          className={styles.cardCta}
          href={bookingHref(service.id)}
          target="_blank"
          rel="noopener"
          {...cta(`service-book-${service.id}`)}
        >
          <span>Записатися</span>
          <Icon name="arrow-right" size={16} />
          <span className="srOnly">на {service.name}</span>
        </a>
      </div>
    </li>
  );
}
