import type { NextConfig } from 'next';

/*
 * No `images.remotePatterns`: every photo on the site is now a local WebP under
 * `public/images/`. The Unsplash placeholders the service cards used to load
 * were the only remote source, so allowing that host again would only widen
 * what the optimizer will fetch.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
