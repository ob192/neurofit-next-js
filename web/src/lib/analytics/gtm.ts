/**
 * Google Tag Manager wiring.
 *
 * GTM is the only third-party script on the site. It is loaded once from the
 * root layout; everything downstream — GA4, any future pixel — is configured in
 * the container, not here. That is the point of using a tag manager: the studio
 * can add or remove tags without a deploy.
 *
 * The container ID is a constant rather than an env var deliberately. It is not
 * a secret (it ships in the HTML), there is exactly one container, and an
 * unset env var would fail silently by collecting nothing — which is the worst
 * way for analytics to break.
 */

export const GTM_ID = 'GTM-PB7X3PL2';

/** GA4 measurement ID, for reference. The tag itself lives in the container. */
export const GA4_MEASUREMENT_ID = 'G-DHQ8N6RZ39';

/**
 * Events this app pushes. Named as a union so a typo is a type error rather
 * than an event that silently never fires.
 *
 * `booking_submitted` is mapped to GA4's recommended `generate_lead` event
 * inside the container — the dataLayer name describes what happened on the
 * site, the GA4 name is what reports understand.
 */
export type DataLayerEvent =
  | {
      event: 'booking_submitted';
      /** Which service was booked — matches the ids in content/services.ts. */
      service_id: string;
      service_name: string;
      /** YYYY-MM-DD and HH:MM, as the app stores them. */
      booking_date: string;
      booking_time: string;
    }
  | {
      /**
       * Funnel progress inside the booking widget. Four steps, so a drop-off
       * between "picked a date" and "picked a time" is visible rather than
       * inferred from a single submit count.
       */
      event: 'booking_step';
      booking_step: 'service' | 'date' | 'time';
      service_id: string;
      service_name: string;
    };

/**
 * Attribute contract for the parts of the page that are **not** client
 * components — which is six of the eight sections.
 *
 * Rather than converting them to `'use client'` just to attach an onClick,
 * they carry a `data-analytics` attribute and GTM does the listening. A click
 * trigger and an element-visibility trigger in the container read these, so
 * the whole engagement layer costs zero bytes of our JavaScript and the
 * sections keep shipping none.
 *
 * The values are stable identifiers, not CSS classes: CSS Modules hashes class
 * names per build, so a container keyed on `.Footer-module__x7Kd2__cta` would
 * break on the next deploy without anything looking wrong.
 */
export const ANALYTICS_ATTR = 'data-analytics';
export const ANALYTICS_SECTION_ATTR = 'data-analytics-section';

/** Marks a clickable element. Spread onto the element: `{...cta('hero-book')}`. */
export function cta(id: string): Record<string, string> {
  return { [ANALYTICS_ATTR]: id };
}

/** Marks a section for the visibility trigger. */
export function trackSection(id: string): Record<string, string> {
  return { [ANALYTICS_SECTION_ATTR]: id };
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Push an event to the dataLayer.
 *
 * Deliberately never sends the customer's name, phone or comment. Those go to
 * the booking API and nowhere else — pushing them here would hand personal
 * data to every tag in the container, which is both a privacy problem and a
 * violation of Google's own terms on sending PII to Analytics.
 */
export function pushEvent(payload: DataLayerEvent): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
}
