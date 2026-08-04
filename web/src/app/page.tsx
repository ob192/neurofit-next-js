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

/*
 * The page is fully static again. It used to be `force-dynamic` because the
 * booking section server-rendered live availability on every request; booking
 * now hands off to a Telegram bot, so there is nothing left on the page that
 * goes stale between builds.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildJsonLd()} />
      <Hero />
      <main className={styles.main}>
        <Services />
        <WhyEms />
        <Pricing />
        <BookingSection />
        <Media />
        <Faq />
        <Location />
      </main>
      <Footer />
    </>
  );
}
