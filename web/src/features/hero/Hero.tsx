import Image from 'next/image';
import { Brand } from '@/components/Brand/Brand';
import { Icon } from '@/components/Icon/Icon';
import { hero } from '@/content/hero';
import { site, telHref } from '@/content/site';
import { services } from '@/content/services';
import heroImage from '../../../public/images/hero-ems-studio.webp';
import { cta, trackSection } from '@/lib/analytics/gtm';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <header className={styles.hero} {...trackSection('hero')}>
      <div className={styles.topBar}>
        <Brand size="sm" />
        <a
          className={styles.phonePill}
          href={telHref}
          {...cta('hero-call')}
          aria-label={hero.callAriaLabel(site.phone.display)}
        >
          <Icon name="phone" size={14} />
          <span>{site.phone.display}</span>
        </a>
      </div>

      <div className={styles.body}>
        <p className={styles.badge}>
          <Icon name="map-pin" size={13} />
          <span>{site.tagline}</span>
        </p>

        <h1 className={styles.headline}>
          <span className={styles.headlineTop}>{hero.headline.top}</span>
          <span className={styles.headlineBottom}>{hero.headline.bottom}</span>
        </h1>

        <p className={styles.sub}>{hero.lead}</p>

        {/* The comparison is the page's strongest argument, so it gets read as
            two numerals rather than as a sentence. The cells are decorative to
            assistive tech — `srSummary` carries the actual claim. */}
        <p className={styles.proof}>
          <span className="srOnly">{hero.proof.srSummary}</span>

          <span className={styles.proofCell} aria-hidden="true">
            <span className={styles.proofValue}>
              {hero.proof.from.value}
              <span className={styles.proofUnit}>{hero.proof.from.unit}</span>
            </span>
            <span className={styles.proofLabel}>{hero.proof.from.label}</span>
          </span>

          <span className={styles.proofEquals} aria-hidden="true">
            =
          </span>

          <span className={styles.proofCell} aria-hidden="true">
            <span className={styles.proofValue}>
              {hero.proof.to.value}
              <span className={styles.proofUnit}>{hero.proof.to.unit}</span>
            </span>
            <span className={styles.proofLabel}>{hero.proof.to.label}</span>
          </span>
        </p>

        <a className={styles.cta} href="#booking" {...cta('hero-book')}>
          <span>{hero.ctaLabel}</span>
          <Icon name="arrow-right" size={18} />
        </a>

        <ul className={styles.pills}>
          {services.map((service) => (
            <li key={service.id} className={styles.pill}>
              <Icon name="zap" size={12} />
              <span>{service.id === 'stretching' ? 'Stretching' : service.shortName}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.image}>
        <Image
          src={heroImage}
          alt="Випад в EMS-костюмі під вивіскою студії NeuroFit"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          placeholder="blur"
          className={styles.imageInner}
        />
      </div>
    </header>
  );
}
