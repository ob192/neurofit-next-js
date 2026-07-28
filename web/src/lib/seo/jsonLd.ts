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
const PRIMARY_IMAGE_ID = `${siteUrl}/#primaryimage`;

type JsonLdNode = Record<string, unknown>;

const CURRENCY = 'UAH';

/**
 * The two images the graph refers to.
 *
 * `logo` and `image` are different claims and used to point at the same file:
 * `image` is what the business looks like — the hero shot, which is rendered on
 * the page — and `logo` is the brand mark search engines put beside the name.
 * (`hero-ems-studio.png` is a JPEG despite the extension; that is the file the
 * studio supplied and Next sniffs the content, so the name is cosmetic.)
 *
 * Both are plain URL strings wherever they appear. schema.org accepts either a
 * URL or an ImageObject for these properties, and a URL sidesteps the two ways
 * an object goes wrong: a bare `{ "@id": … }` reference is invisible to
 * validators that flatten a node instead of walking the graph, and writing the
 * ImageObject out in full at each use site repeats ~300 bytes per copy. The one
 * place that genuinely needs the object form — `primaryImageOfPage`, where
 * dimensions matter — declares it inline, once.
 */
const LOGO_URL = `${siteUrl}/web-app-manifest-512x512.png`;
const IMAGE_URL = `${siteUrl}/images/hero-ems-studio.png`;

function primaryImage(): JsonLdNode {
  return {
    '@type': 'ImageObject',
    '@id': PRIMARY_IMAGE_ID,
    url: IMAGE_URL,
    contentUrl: IMAGE_URL,
    width: 1408,
    height: 768,
    caption: site.description,
    inLanguage: site.lang,
  };
}

/**
 * Other profiles that are this same business.
 *
 * The Google listing is the canonical `?cid=` URL, not the `share.google`
 * link the studio sent: a redirector tells a crawler nothing about identity.
 *
 * Only confirmed profiles belong here. `sameAs` is an identity assertion, so a
 * guessed URL is worse than a missing one — see docs/CONCESSIONS.md §9.
 */
const SAME_AS = [site.google.place, site.social.instagram];

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
    // No `name` here: it was the same string as `itemOffered.name` on every
    // offer. The Service is where the name belongs — an Offer is the price, and
    // what it is a price *for* is the thing it points at.
    '@type': 'Offer',
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
      // `provider` stays — it is a 40-byte @id reference, and it is what makes
      // a single Offer attributable when a parser lifts it out of the
      // catalogue. `areaServed` does not: it was the same city on all twelve,
      // and the business node it hangs off already declares it.
      provider: { '@id': BUSINESS_ID },
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
          },
        })),
    ],
  };
}

function businessNode(): JsonLdNode {
  return {
    /*
     * `LocalBusiness` is redundant in schema.org terms — both of the others
     * inherit from it — but it is listed first on purpose. Plenty of
     * third-party validators only recognise a fixed handful of types and
     * report anything else as "unsupported"; leading with the supertype makes
     * the node legible to them without weakening what it says.
     */
    '@type': ['LocalBusiness', 'HealthAndBeautyBusiness', 'ExerciseGym'],
    '@id': BUSINESS_ID,
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    slogan: site.tagline,
    url: siteUrl,
    telephone: site.phone.e164,
    image: IMAGE_URL,
    logo: LOGO_URL,
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
    logo: LOGO_URL,
    image: IMAGE_URL,
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
    primaryImageOfPage: primaryImage(),
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
    ],
  };
}
