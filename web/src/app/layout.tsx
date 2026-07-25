import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { site, siteUrl } from '@/content/site';
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
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: siteUrl,
    siteName: site.name,
    title: `${site.name} — студія персональних тренувань у Чернігові`,
    description: site.seoDescription,
    images: [
      {
        url: '/images/hero-ems-studio.png',
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
    images: ['/images/hero-ems-studio.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4a1a73',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.lang} className={`${montserrat.variable} ${inter.variable}`}>
      <body>
        <div className={styles.shell}>{children}</div>
      </body>
    </html>
  );
}
