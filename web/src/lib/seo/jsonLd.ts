import { site, siteUrl } from '@/content/site';
import { services } from '@/content/services';
import { faqItems } from '@/content/faq';
import { priceGroups, perSessionRate, type PriceItem } from '@/content/pricing';

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
const WEBPAGE_ID = `${siteUrl}/#webpage`;
const ORGANIZATION_ID = `${siteUrl}/#organization`;
const LOGO_ID = `${siteUrl}/#logo`;
const PRIMARY_IMAGE_ID = `${siteUrl}/#primaryimage`;

type JsonLdNode = Record<string, unknown>;

const CURRENCY = 'UAH';

/**
 * The two images the graph refers to, as nodes rather than bare URLs so both
 * can be referenced by `@id` from wherever they're needed instead of being
 * repeated with different dimensions each time.
 *
 * `logo` and `image` are different claims and used to point at the same file:
 * `image` is what the business looks like — the hero shot, which is rendered
 * on the page — and `logo` is the brand mark search engines put beside the
 * name. Dimensions are the files' real ones. (`hero-ems-studio.png` is a JPEG
 * despite the extension; that is the file the studio supplied and Next sniffs
 * the content, so the name is cosmetic.)
 */
function imageNodes(): JsonLdNode[] {
  return [
    {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: `${siteUrl}/web-app-manifest-512x512.png`,
      contentUrl: `${siteUrl}/web-app-manifest-512x512.png`,
      width: 512,
      height: 512,
      caption: site.name,
      inLanguage: site.lang,
    },
    {
      '@type': 'ImageObject',
      '@id': PRIMARY_IMAGE_ID,
      url: `${siteUrl}/images/hero-ems-studio.png`,
      contentUrl: `${siteUrl}/images/hero-ems-studio.png`,
      width: 1408,
      height: 768,
      caption: site.description,
      inLanguage: site.lang,
    },
  ];
}

/**
 * Other profiles that are this same business.
 *
 * The Google listing is the canonical `?cid=` URL, not the `share.google`
 * link the studio sent: a redirector tells a crawler nothing about identity.
 * The three social URLs still need verifying before launch — see
 * docs/CONCESSIONS.md §9.
 */
const SAME_AS = [
  site.google.place,
  site.social.instagram,
  site.social.facebook,
  site.social.telegram,
];

/** Every price rendered by the Pricing section, cheapest first. */
const allPrices = priceGroups
  .flatMap((group) => [...group.singles, ...group.packages])
  .map((item) => item.price)
  .sort((a, b) => a - b);

/**
 * Concrete range rather than the "₴₴" placeholder. Both ends are prices that
 * appear verbatim on the page — `priceRange` is one of the few LocalBusiness
 * fields Google surfaces directly, so a real span is worth more than a symbol.
 */
function priceRange(): string {
  const low = allPrices[0];
  const high = allPrices[allPrices.length - 1];
  if (low === undefined || high === undefined) return '₴₴';
  return `${low}–${high} ₴`;
}

function offerNode(groupTitle: string, item: PriceItem): JsonLdNode {
  const rate = perSessionRate(item);

  return {
    '@type': 'Offer',
    name: `${groupTitle} — ${item.name}`,
    price: item.price,
    priceCurrency: CURRENCY,
    availability: 'https://schema.org/InStock',
    ...(item.sessions
      ? {
          eligibleQuantity: {
            '@type': 'QuantitativeValue',
            value: item.sessions,
            unitText: 'тренування',
          },
          // The unit price the card shows, so the markup and the visible
          // "N грн / тренування" line can't disagree.
          ...(rate
            ? {
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: rate.value,
                  priceCurrency: CURRENCY,
                  referenceQuantity: {
                    '@type': 'QuantitativeValue',
                    value: 1,
                    unitText: 'тренування',
                  },
                },
              }
            : {}),
        }
      : {}),
    itemOffered: {
      '@type': 'Service',
      name: `${groupTitle} — ${item.name}`,
      serviceType: groupTitle,
      provider: { '@id': BUSINESS_ID },
      areaServed: { '@type': 'City', name: site.address.city },
    },
  };
}

/**
 * Catalogue of everything the studio sells.
 *
 * Services with a published price list get a nested catalogue of priced
 * offers; boxing gets a bare Service node because the studio has not supplied
 * prices for it. Do not fill that gap by extrapolating from the other two —
 * marking up a price the studio doesn't charge is worse than marking up none.
 */
function offerCatalogNode(): JsonLdNode {
  const priced = new Set(priceGroups.map((group) => group.id));

  return {
    '@type': 'OfferCatalog',
    name: 'Тренування та абонементи',
    itemListElement: [
      ...priceGroups.map((group) => ({
        '@type': 'OfferCatalog',
        name: group.title,
        itemListElement: [...group.singles, ...group.packages].map((item) =>
          offerNode(group.title, item),
        ),
      })),
      ...services
        .filter((service) => !priced.has(service.id))
        .map((service) => ({
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
    ],
  };
}

function businessNode(): JsonLdNode {
  return {
    '@type': ['HealthAndBeautyBusiness', 'ExerciseGym'],
    '@id': BUSINESS_ID,
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    slogan: site.tagline,
    url: siteUrl,
    telephone: site.phone.e164,
    image: { '@id': PRIMARY_IMAGE_ID },
    logo: { '@id': LOGO_ID },
    priceRange: priceRange(),
    currenciesAccepted: CURRENCY,
    // The site has exactly one language and no locale routing, so this is a
    // statement of fact rather than a hedge — see docs/CONCESSIONS.md §14.
    knowsLanguage: [site.lang],
    parentOrganization: { '@id': ORGANIZATION_ID },
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: site.google.geo.latitude,
      longitude: site.google.geo.longitude,
    },
    // The listing this page belongs to. `hasMap` is the field Google reads for
    // "which Business Profile is this?"; the same URL is repeated in `sameAs`
    // because the two are answering different questions — where the map is,
    // and which other profiles are this same entity.
    hasMap: site.google.place,
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
    sameAs: SAME_AS,
    hasOfferCatalog: offerCatalogNode(),
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
    alternateName: site.name,
    description: site.description,
    url: siteUrl,
    telephone: site.phone.e164,
    logo: { '@id': LOGO_ID },
    image: { '@id': PRIMARY_IMAGE_ID },
    // The Organization and the studio are the same business seen two ways —
    // the brand, and the place you walk into. Linking them stops a crawler
    // reading the graph as two unrelated entities that share a name.
    location: { '@id': BUSINESS_ID },
    areaServed: { '@type': 'City', name: site.address.city },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: site.phone.e164,
      contactType: 'reservations',
      areaServed: 'UA',
      availableLanguage: ['uk', 'Ukrainian'],
    },
    sameAs: SAME_AS,
  };
}

/**
 * The page itself.
 *
 * `WebSite` is the property; `WebPage` is this one document on it. Without the
 * distinction there is nothing for `primaryImageOfPage` to hang off and no
 * node that says "this URL is about that business" — the graph described the
 * business and the site but never connected either to the page being served.
 */
function webPageNode(): JsonLdNode {
  return {
    '@type': 'WebPage',
    '@id': WEBPAGE_ID,
    url: siteUrl,
    name: `${site.name} — ${site.tagline}`,
    description: site.seoDescription,
    inLanguage: site.lang,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    primaryImageOfPage: { '@id': PRIMARY_IMAGE_ID },
    potentialAction: {
      '@type': 'ReadAction',
      target: [siteUrl],
    },
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
    // Hangs off the page node now, not the site: the questions are on this
    // document, and the WebPage is what `isPartOf` the WebSite.
    isPartOf: { '@id': WEBPAGE_ID },
    inLanguage: site.lang,
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
    '@graph': [
      organizationNode(),
      websiteNode(),
      webPageNode(),
      businessNode(),
      faqNode(),
      ...imageNodes(),
    ],
  };
}
