import { Section } from '@/components/Section/Section';
import { SectionHeader } from '@/components/SectionHeader/SectionHeader';
import { Icon } from '@/components/Icon/Icon';
import { site } from '@/content/site';
import { location } from '@/content/location';
import { cta } from '@/lib/analytics/gtm';
import styles from './Location.module.css';

/**
 * The studio's Google Business Profile, embedded.
 *
 * The iframe is the keyless Maps Embed (`site.google.embed`) rather than the
 * Embed API with a key: it needs no credential, no billing account and no
 * client-side JavaScript of ours. It is the one third-party frame on the page,
 * so it is `loading="lazy"` — it sits below the FAQ and costs nothing until
 * the visitor scrolls that far.
 *
 * The address and hours beside it come from `content/site.ts`, the same source
 * as the footer and the JSON-LD. A map is a NAP signal; a map next to an
 * address that disagrees with the one in the footer is a negative one.
 */
export function Location() {
  return (
    <Section
      id="location"
      tone="lilac"
      gap={20}
      padY={48}
      aria-labelledby="location-heading"
    >
      <SectionHeader
        eyebrow={location.eyebrow}
        heading={location.heading}
        headingId="location-heading"
      />

      <div className={styles.layout}>
        <div className={styles.frame}>
          <iframe
            className={styles.map}
            src={site.google.embed}
            title={location.mapTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        <div className={styles.rail}>
          <ul className={styles.facts}>
            <li className={styles.fact}>
              <span className={styles.factIcon}>
                <Icon name="map-pin" size={17} />
              </span>
              <span className={styles.factText}>
                <span className={styles.factCaption}>{location.addressCaption}</span>
                <span className={styles.factValue}>{site.address.full}</span>
              </span>
            </li>
            <li className={styles.fact}>
              <span className={styles.factIcon}>
                <Icon name="clock-9" size={17} />
              </span>
              <span className={styles.factText}>
                <span className={styles.factCaption}>{location.hoursCaption}</span>
                <span className={styles.factValue}>{site.hours.display}</span>
              </span>
            </li>
          </ul>

          <div className={styles.actions}>
            <a
              className={`${styles.action} ${styles.primary}`}
              href={site.google.directions}
              {...cta('location-directions')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="map-pin" size={17} />
              <span>{location.directionsLabel}</span>
            </a>
            <a
              className={styles.action}
              href={site.google.place}
              {...cta('location-open-maps')}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* No icon: the label is the longest string in the section and
                  the rail is ~260px at tablet, where an icon tips it into a
                  second line and the pair stops matching height. */}
              <span>{location.placeLabel}</span>
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
