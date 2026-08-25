import { Section } from '@/components/Section/Section';
import { SectionHeader } from '@/components/SectionHeader/SectionHeader';
import { ButtonLink } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import {
  priceGroups,
  pricingCopy,
  perSessionRate,
  type PriceItem,
} from '@/content/pricing';
import { bookingHref } from '@/content/site';
import { cta } from '@/lib/analytics/gtm';
import styles from './Pricing.module.css';

function PriceRow({ item }: { item: PriceItem }) {
  const rate = perSessionRate(item);
  const meta = [
    item.note,
    rate ? pricingCopy.perSession(rate.value, rate.approx) : null,
    item.savingPercent ? pricingCopy.saving(item.savingPercent) : null,
  ].filter(Boolean);

  return (
    <li className={item.best ? `${styles.row} ${styles.rowBest}` : styles.row}>
      {item.best ? <span className={styles.badge}>{pricingCopy.bestBadge}</span> : null}

      <span className={styles.rowText}>
        <span className={styles.rowName}>{item.name}</span>
        {meta.length > 0 ? (
          <span className={styles.rowMeta}>{meta.join(' · ')}</span>
        ) : null}
      </span>

      <span className={styles.price}>
        <span className={styles.priceValue} aria-hidden="true">
          {item.price}
        </span>
        <span className={styles.priceCurrency} aria-hidden="true">
          {pricingCopy.currency}
        </span>
        <span className="srOnly">{pricingCopy.priceLabel(item.price)}</span>
      </span>
    </li>
  );
}

export function Pricing() {
  return (
    <Section
      id="pricing"
      tone="light"
      gap={28}
      aria-labelledby={pricingCopy.headingId}
    >
      <SectionHeader
        eyebrow={pricingCopy.eyebrow}
        heading={pricingCopy.heading}
        headingId={pricingCopy.headingId}
        description={pricingCopy.description}
      />

      <div className={styles.groups}>
        {priceGroups.map((group) => (
          <article key={group.id} className={styles.group}>
            <h3 className={styles.groupTitle}>
              <span className={styles.groupIcon}>
                <Icon name={group.icon} size={16} />
              </span>
              {group.title}
            </h3>

            {group.singles.length > 0 ? (
              <>
                <p className={styles.listLabel}>{pricingCopy.singlesLabel}</p>
                <ul className={styles.list}>
                  {group.singles.map((item) => (
                    <PriceRow key={item.name} item={item} />
                  ))}
                </ul>
              </>
            ) : null}

            {group.packages.length > 0 ? (
              <>
                <p className={styles.listLabel}>{pricingCopy.packagesLabel}</p>
                <ul className={styles.list}>
                  {group.packages.map((item) => (
                    <PriceRow key={item.name} item={item} />
                  ))}
                </ul>
              </>
            ) : null}

            {group.addons && group.addons.length > 0 ? (
              <ul className={styles.list}>
                {group.addons.map((item) => (
                  <PriceRow key={item.name} item={item} />
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <ButtonLink
        href={bookingHref()}
        target="_blank"
        rel="noopener"
        variant="ink"
        className={styles.cta}
        {...cta('pricing-book')}
      >
        <span>{pricingCopy.ctaLabel}</span>
        <Icon name="arrow-right" size={18} />
      </ButtonLink>
    </Section>
  );
}
