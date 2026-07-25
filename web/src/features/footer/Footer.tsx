import { Brand } from '@/components/Brand/Brand';
import { Icon, type IconName } from '@/components/Icon/Icon';
import { site, telHref } from '@/content/site';
import styles from './Footer.module.css';

const contacts: { icon: IconName; caption: string; value: string; href?: string }[] = [
  { icon: 'map-pin', caption: 'Адреса', value: site.address.full },
  {
    icon: 'phone',
    caption: 'Запис за телефоном',
    value: site.phone.display,
    href: telHref,
  },
  { icon: 'clock-9', caption: 'Графік роботи', value: site.hours.display },
];

const socials: { icon: IconName; label: string; href: string }[] = [
  { icon: 'instagram', label: 'Instagram', href: site.social.instagram },
  { icon: 'facebook', label: 'Facebook', href: site.social.facebook },
  { icon: 'send', label: 'Telegram', href: site.social.telegram },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Brand size="lg" />

      <p className={styles.tagline}>{site.description}</p>

      <ul className={styles.contacts}>
        {contacts.map((contact) => {
          const value = contact.href ? (
            <a className={styles.contactLink} href={contact.href}>
              {contact.value}
            </a>
          ) : (
            contact.value
          );

          return (
            <li key={contact.caption} className={styles.contact}>
              <span className={styles.contactIcon}>
                <Icon name={contact.icon} size={17} />
              </span>
              <span className={styles.contactText}>
                <span className={styles.contactCaption}>{contact.caption}</span>
                <span className={styles.contactValue}>{value}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <a className={styles.cta} href={telHref}>
        <Icon name="phone-call" size={17} />
        <span>Зателефонувати зараз</span>
      </a>

      <ul className={styles.social}>
        {socials.map((social) => (
          <li key={social.label}>
            <a
              className={styles.socialLink}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name={social.icon} size={19} label={social.label} />
            </a>
          </li>
        ))}
      </ul>

      <hr className={styles.divider} />

      <p className={styles.copyright}>
        © {new Date().getFullYear()} {site.name} · Усі права захищені
      </p>
    </footer>
  );
}
