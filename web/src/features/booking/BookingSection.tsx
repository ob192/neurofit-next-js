import { Section } from '@/components/Section/Section';
import { Icon } from '@/components/Icon/Icon';
import { ButtonLink } from '@/components/Button/Button';
import { services } from '@/content/services';
import { bookingHref, site, telHref } from '@/content/site';
import { booking } from '@/content/booking';
import { cta } from '@/lib/analytics/gtm';
import styles from './BookingSection.module.css';

/**
 * The booking section.
 *
 * Booking itself happens in the studio's Telegram bot, so this section is a
 * hand-off rather than a form: it explains what the visitor is about to walk
 * into and then gets out of the way. Every format is listed — the bot takes
 * requests for all three, including EMS Boxing, which the retired online
 * calendar could not sell.
 *
 * Deliberately a server component with no state: it is three anchors and a list.
 * The old calendar's client bundle, its API round-trips and the `force-dynamic`
 * they forced on the whole page are all gone with it. The Altegio-backed
 * version is kept, dormant, in `AltegioBookingSection.tsx`.
 */
export function BookingSection() {
  return (
    <Section
      id="booking"
      tone="lilac"
      gap={20}
      padY={40}
      className={styles.section}
      aria-labelledby="booking-heading"
    >
      <header className={styles.head}>
        <p className={styles.kicker}>
          <Icon name="send" size={13} />
          <span>{booking.kicker}</span>
        </p>
        <h2 id="booking-heading" className={styles.title}>
          {booking.title}
        </h2>
        <p className={styles.desc}>{booking.desc(site.hours.opens, site.hours.closes)}</p>
        <p className={styles.note}>
          <Icon name="shield-check" size={14} />
          <span>{booking.note}</span>
        </p>
      </header>

      <div className={styles.card}>
        {/* Numbered by the list itself, not by hand — the markers are the `ol`'s
            own counter, so the steps stay correctly numbered if copy is added. */}
        <ol className={styles.steps}>
          {booking.steps.map((step) => (
            <li key={step} className={styles.step}>
              {step}
            </li>
          ))}
        </ol>

        <ButtonLink
          href={bookingHref()}
          target="_blank"
          rel="noopener"
          variant="ink"
          className={styles.cta}
          {...cta('booking-telegram')}
        >
          <Icon name="send" size={17} />
          <span>{booking.cta}</span>
        </ButtonLink>

        <div className={styles.formats}>
          <p className={styles.formatsLabel}>{booking.formatsLabel}</p>
          <ul className={styles.formatList}>
            {services.map((service) => (
              <li key={service.id}>
                {/*
                  Through `/go/tg`, which logs the click and redirects; the
                  service id travels on as the bot's `/start` payload, so the
                  chat opens on the format the visitor pressed. If the click
                  cannot be logged the redirect falls back to the plain deep
                  link, and if Telegram drops the payload the bot just asks —
                  the link still works either way.
                */}
                <a
                  className={styles.format}
                  href={bookingHref(service.id)}
                  target="_blank"
                  rel="noopener"
                  aria-label={booking.formatAriaLabel(service.name)}
                  {...cta(`booking-telegram-${service.id}`)}
                >
                  <Icon name={service.icon} size={14} />
                  <span>{service.shortName}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Not everyone in the studio's audience uses Telegram, and a chat-only
            funnel silently loses those people. The phone stays one tap away. */}
        <p className={styles.fallback}>
          <span>{booking.fallbackLead}</span>{' '}
          <a className={styles.fallbackLink} href={telHref} {...cta('booking-call')}>
            <Icon name="phone" size={13} />
            <span>
              {booking.fallbackCta} {site.phone.display}
            </span>
          </a>
        </p>
      </div>
    </Section>
  );
}
