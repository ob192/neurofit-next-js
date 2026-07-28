import { Hero } from '@/features/hero/Hero';
import { Services } from '@/features/services/Services';
import { WhyEms } from '@/features/why-ems/WhyEms';
import { Pricing } from '@/features/pricing/Pricing';
import { BookingSection } from '@/features/booking/BookingSection';
import { Media } from '@/features/media/Media';
import { Faq } from '@/features/faq/Faq';
import { Location } from '@/features/location/Location';
import { Footer } from '@/features/footer/Footer';
import { JsonLd } from '@/lib/seo/JsonLd';
import { buildJsonLd } from '@/lib/seo/jsonLd';
import styles from './page.module.css';

type PageProps = {
  searchParams: Promise<{ service?: string }>;
};

/**
 * The landing page is rendered per request rather than statically: the booking
 * section server-renders live availability from the mock store, so a cached
 * HTML shell would show slots that are no longer free.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: PageProps) {
  const { service } = await searchParams;

  return (
    <>
      <JsonLd data={buildJsonLd()} />
      <Hero />
      <main className={styles.main}>
        <Services />
        <WhyEms />
        <Pricing />
        <BookingSection preselectedService={service} />
        <Media />
        <Faq />
        <Location />
      </main>
      <Footer />
    </>
  );
}
