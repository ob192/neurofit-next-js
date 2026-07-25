import type { MetadataRoute } from 'next';
import { siteUrl } from '@/content/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The mock API has nothing worth indexing and shouldn't burn crawl budget.
      disallow: '/api/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
