import { Section } from '@/components/Section/Section';
import { SectionHeader } from '@/components/SectionHeader/SectionHeader';
import { Icon } from '@/components/Icon/Icon';
import { faqItems } from '@/content/faq';
import styles from './Faq.module.css';

/**
 * Built on native <details>/<summary> rather than a stateful client component.
 *
 * Three reasons: the accordion needs no JavaScript at all (so it works before
 * hydration and with JS off), keyboard and screen-reader semantics come for
 * free, and every answer stays in the server-rendered DOM — which is what the
 * FAQPage structured data on this page claims. Hiding answers behind client
 * state while marking them up as visible content is a structured-data
 * mismatch.
 */
export function Faq() {
  return (
    <Section
      id="faq"
      tone="light"
      gap={24}
      padding="48px var(--gutter)"
      aria-labelledby="faq-heading"
    >
      <SectionHeader
        eyebrow="МАЄТЕ ПИТАННЯ?"
        heading="Часті запитання"
        headingId="faq-heading"
      />

      <ul className={styles.list}>
        {faqItems.map((item, index) => (
          <li key={item.id} className={styles.item}>
            {/* The design shows the first row expanded on load. */}
            <details className={styles.details} name="faq" open={index === 0}>
              <summary className={styles.summary}>
                <h3 className={styles.question}>{item.question}</h3>
                <span className={styles.chevron}>
                  <Icon name="chevron-down" size={22} />
                </span>
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}
