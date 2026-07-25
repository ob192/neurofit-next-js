import { site, siteUrl } from '@/content/site';
import { services } from '@/content/services';
import { faqItems } from '@/content/faq';

/**
 * schema.org graph for the landing page.
 *
 * Built as one `@graph` with stable `@id`s so the nodes reference each other
 * instead of repeating the business details three times — that's what lets the
 * FAQPage and the HealthClub be understood as parts of the same entity.
 *
 * Deliberately NOT included: `aggregateRating` and `Review` nodes for the
 * testimonials in the Media section. They are placeholder copy from the design
 * mock with no verifiable author, and Google's structured-data policies treat
 * fabricated review markup as spam — the penalty lands on the whole page's rich
 * results, not just the reviews. Add them once real, attributable reviews
 * exist; see src/content/reviews.ts.
 */

const BUSINESS_ID = `${siteUrl}/#business`;
const WEBSITE_ID = `${siteUrl}/#website`;
const ORGANIZATION_ID = `${siteUrl}/#organization`;

type JsonLdNode = Record<string, unknown>;

function businessNode(): JsonLdNode {
  return {
    '@type': ['HealthAndBeautyBusiness', 'ExerciseGym'],
    '@id': BUSINESS_ID,
    name: site.name,
    description: site.description,
    url: siteUrl,
    telephone: site.phone.e164,
    image: `${siteUrl}/images/hero-ems-studio.png`,
    logo: `${siteUrl}/images/hero-ems-studio.png`,
    priceRange: '₴₴',
    currenciesAccepted: 'UAH',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    areaServed: {
      '@type': 'City',
      name: site.address.city,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: site.hours.opens,
        closes: site.hours.closes,
      },
    ],
    sameAs: [site.social.instagram, site.social.facebook, site.social.telegram],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Тренування',
      itemListElement: services.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.name,
          description: service.description,
          serviceType: service.name,
          provider: { '@id': BUSINESS_ID },
          areaServed: { '@type': 'City', name: site.address.city },
        },
      })),
    },
    potentialAction: {
      '@type': 'ReserveAction',
      name: 'Забронювати тренування',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/#booking`,
        inLanguage: site.lang,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: { '@type': 'Reservation', name: 'Запис на тренування' },
    },
  };
}

function organizationNode(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: site.legalName,
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/images/hero-ems-studio.png`,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: site.phone.e164,
      contactType: 'reservations',
      areaServed: 'UA',
      availableLanguage: ['uk', 'Ukrainian'],
    },
    sameAs: [site.social.instagram, site.social.facebook, site.social.telegram],
  };
}

function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: siteUrl,
    name: site.name,
    description: site.seoDescription,
    inLanguage: site.lang,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

function faqNode(): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    // Every question rendered on the page appears here and vice versa —
    // structured data must match the visible content exactly.
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(), websiteNode(), businessNode(), faqNode()],
  };
}
