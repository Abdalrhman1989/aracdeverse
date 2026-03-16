import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Starfield } from '@/components/layout/Starfield'
import { AuthProvider } from '@/components/layout/AuthProvider'

const SITE_URL = 'https://aracdeverse-next.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ArcadeVerse — Play 50+ Free Online Games Instantly',
    template: '%s | ArcadeVerse — Free Browser Games',
  },
  description: 'Play 50+ free online browser games instantly — no download, no login required! Snake, Tetris, Blackjack, Hearts, Pac-Man, 2-player local & online multiplayer. The best free arcade games site.',
  keywords: [
    'free online games', 'browser games', 'arcade games', 'no download games',
    '2 player games online', 'play games online free', 'html5 games',
    'blackjack online free', 'hearts card game online', 'snake game online',
    'tetris online free', 'pac man online', 'multiplayer browser games',
    'free card games online', 'best online games 2025', 'games to play with friends online',
    'private room games online', 'play with friends online free',
  ],
  authors: [{ name: 'ArcadeVerse' }],
  creator: 'ArcadeVerse',
  publisher: 'ArcadeVerse',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    siteName: 'ArcadeVerse',
    title: 'ArcadeVerse — Play 50+ Free Online Games',
    description: 'Play 50+ free browser games instantly. Snake, Tetris, Blackjack, Hearts, Pac-Man, 2-player online. No download!',
    url: SITE_URL,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ArcadeVerse — Free Online Games' }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArcadeVerse — Play 50+ Free Online Games',
    description: 'Play 50+ free browser games. No download, no login!',
    images: ['/og-image.png'],
    creator: '@arcadeverse',
  },
  alternates: { canonical: SITE_URL },
  verification: { google: 'your-google-verification-code' },
  category: 'games',
}

const JSON_LD_WEBSITE = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ArcadeVerse',
  alternateName: 'ArcadeVerse Free Online Games',
  url: SITE_URL,
  description: 'Play 50+ free online browser games instantly. No download needed.',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/games?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
})

const JSON_LD_ORGANIZATION = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ArcadeVerse',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  sameAs: [],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ArcadeVerse" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD_WEBSITE }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD_ORGANIZATION }} />
      </head>
      <body>
        <Starfield />
        <AuthProvider>
          <Navbar />
          <main className="relative z-10 min-h-screen">{children}</main>
          <Footer />
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#141438', color: '#e2e8f0', border: '1px solid rgba(139,92,246,0.3)', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
