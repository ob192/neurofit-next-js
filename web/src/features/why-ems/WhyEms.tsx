import { Section } from '@/components/Section/Section';
import { SectionHeader } from '@/components/SectionHeader/SectionHeader';
import { Icon } from '@/components/Icon/Icon';
import { benefits, stats } from '@/content/whyEms';
import styles from './WhyEms.module.css';

export function WhyEms() {
  return (
    <Section
      id="why-ems"
      tone="deep"
      gap={28}
      padY={48}
      aria-labelledby="why-ems-heading"
    >
      <SectionHeader
        tone="deep"
        eyebrow="НАУКА + ТЕХНОЛОГІЇ"
        heading="Чому EMS працює"
        headingId="why-ems-heading"
        description="Електростимуляція м’язів — це ефективний і безпечний спосіб досягти результату швидше."
      />

      <ul className={styles.stats}>
        {stats.map((stat) => (
          <li key={stat.value} className={styles.stat}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </li>
        ))}
      </ul>

      <ul className={styles.benefits}>
        {benefits.map((benefit) => (
          <li key={benefit.text} className={styles.benefit}>
            <span className={styles.benefitIcon}>
              <Icon name={benefit.icon} size={20} />
            </span>
            <span className={styles.benefitText}>{benefit.text}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
