import { Section } from '@/components/Section/Section';
import { SectionHeader } from '@/components/SectionHeader/SectionHeader';
import { services } from '@/content/services';
import { ServiceCard } from './ServiceCard';
import styles from './Services.module.css';

export function Services() {
  return (
    <Section id="services" tone="light" gap={24} aria-labelledby="services-heading">
      <SectionHeader
        eyebrow="НАШІ ПОСЛУГИ"
        heading="Наші напрямки"
        headingId="services-heading"
      />
      <ul className={styles.cards}>
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </ul>
    </Section>
  );
}
