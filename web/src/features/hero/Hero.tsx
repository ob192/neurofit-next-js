import Image from 'next/image';
import { Brand } from '@/components/Brand/Brand';
import { Icon } from '@/components/Icon/Icon';
import { site, telHref } from '@/content/site';
import { services } from '@/content/services';
import heroImage from '../../../public/images/hero-ems-studio.png';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.topBar}>
        <Brand size="sm" />
        <a className={styles.phonePill} href={telHref}>
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
          <span className={styles.headlineTop}>EMS-тренування,</span>
          <span className={styles.headlineBottom}>Stretching, Бокс</span>
        </h1>

        <p className={styles.sub}>
          30 хвилин EMS дають навантаження, порівнянне з 2 годинами у звичайному залі.
          Швидкий результат із персональним тренером.
        </p>

        <a className={styles.cta} href="#booking">
          <span>Записатися на перше тренування</span>
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
          alt="Персональне EMS-тренування у студії NeuroFit"
          fill
          priority
          sizes="390px"
          placeholder="blur"
          className={styles.imageInner}
        />
      </div>
    </header>
  );
}
