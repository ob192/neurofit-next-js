import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import Script from 'next/script';
import { site, siteUrl } from '@/content/site';
import { GTM_ID } from '@/lib/analytics/gtm';
import './globals.css';
import styles from './layout.module.css';

/*
 * The original page pulled Inter and Montserrat from the Google Fonts CDN with
 * a render-blocking <link>. next/font self-hosts both at build time, which
 * removes the third-party round-trip and the layout shift that came with it.
 */
const montserrat = Montserrat({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.name} — EMS-тренування, стретчинг і бокс у Чернігові`,
    template: `%s | ${site.name}`,
  },
  description: site.seoDescription,
  applicationName: site.name,
  keywords: [
    'EMS тренування Чернігів',
    'ЕМС студія',
    'стретчинг Чернігів',
    'бокс Чернігів',
    'персональний тренер Чернігів',
    'NeuroFit',
  ],
  alternates: {
    canonical: '/',
  },
  /*
   * Declared explicitly rather than relying on Next's `app/icon` file
   * convention, because the set is split across `public/`: the .ico has to
   * stay at /favicon.ico for the implicit request browsers make before they
   * have parsed any markup.
   *
   * No `image/svg+xml` entry. The generator produced one, but it is a 6.9 MB
   * 2816x1536 PNG wrapped in an <svg> — browsers prefer SVG over PNG when both
   * are offered, so shipping it would mean every visit downloads 6.9 MB for a
   * tab icon. See docs/CONCESSIONS.md §20.
   */
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48 32x32', type: 'image/x-icon' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: siteUrl,
    siteName: site.name,
    title: `${site.name} — студія персональних тренувань у Чернігові`,
    description: site.seoDescription,
    images: [
      {
        url: '/images/og-cover.png',
        width: 1200,
        height: 630,
        alt: 'Студія персональних тренувань NeuroFit у Чернігові',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — EMS-тренування у Чернігові`,
    description: site.seoDescription,
    images: ['/images/og-cover.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#5a2189',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.lang} className={`${montserrat.variable} ${inter.variable}`}>
      <head>
        {/*
         * Google Tag Manager — the snippet Google gives you, as a next/script
         * so React owns injection and it is not duplicated across navigations.
         *
         * `beforeInteractive` puts it in <head> ahead of hydration, which is
         * the "as high in the <head> as possible" the install instructions ask
         * for. It is the one place this project loads third-party JavaScript;
         * see docs/CONCESSIONS.md §21 for the consent obligation that comes
         * with it.
         */}
        <Script id="gtm-init" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      </head>
      <body>
        {/* GTM's no-JavaScript fallback, immediately after <body> as required. */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        <div className={styles.shell}>{children}</div>
      </body>
    </html>
  );
}
