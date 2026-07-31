import type { MetadataRoute } from 'next';
import { site } from '@/content/site';

/**
 * Web app manifest, served at /manifest.webmanifest.
 *
 * A route rather than a static `site.webmanifest` in `public/` so the name,
 * description and language come from the same `content/site.ts` everything
 * else reads. The generator's file had placeholder copy ("MyWebSite") and a
 * white theme colour, neither of which belongs to this studio.
 *
 * Both icons are `purpose: 'any'`. The supplied artwork is a wide logo
 * letterboxed into a square — a `maskable` declaration would let Android crop
 * to a circle inside the safe zone and slice the wordmark off both ends.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} — ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    lang: site.lang,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Matches the `themeColor` in layout.tsx and --color-primary-deep.
    theme_color: '#5a2189',
    background_color: '#5a2189',
    icons: [
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
