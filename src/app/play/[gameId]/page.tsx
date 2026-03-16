import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GAMES, getGame, getRelatedGames } from '@/lib/games'
import { GamePlayerClient } from '@/components/game-player/GamePlayerClient'
import { GameGrid } from '@/components/ui/GameGrid'
import Link from 'next/link'

interface Props { params: Promise<{ gameId: string }> }

export async function generateStaticParams() {
  return GAMES.map(g => ({ gameId: g.id }))
}

const BASE = 'https://aracdeverse-next.vercel.app'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params
  const game = getGame(gameId)
  if (!game) return {}
  const title = `Play ${game.title} Free Online — No Download`
  const desc  = `${game.description} Play ${game.title} instantly in your browser for free. No download, no signup required. ${game.tags.join(', ')}.`
  const url   = `${BASE}/play/${game.id}`
  return {
    title,
    description: desc,
    keywords: [`play ${game.title.toLowerCase()} online free`, `${game.title.toLowerCase()} browser game`, `free ${game.category} games`, ...game.tags.map(t => `${t} games online`)],
    alternates: { canonical: url },
    openGraph: {
      title: `Play ${game.title} Free — ArcadeVerse`,
      description: desc,
      url,
      type: 'website',
      images: [{ url: `/og-image.png`, width: 1200, height: 630, alt: `Play ${game.title}` }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: ['/og-image.png'] },
    other: {
      'script:application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: game.title,
        description: game.description,
        url,
        genre: game.category,
        applicationCategory: 'Game',
        operatingSystem: 'Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
        aggregateRating: { '@type': 'AggregateRating', ratingValue: game.rating, bestRating: 5, ratingCount: Math.floor(game.playCount / 10) },
        numberOfPlayers: game.is2P ? { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2 } : { '@type': 'QuantitativeValue', minValue: 1, maxValue: 1 },
      })
    },
  }
}

export default async function PlayPage({ params }: Props) {
  const { gameId } = await params
  const game = getGame(gameId)
  if (!game) notFound()
  const related = getRelatedGames(game)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <GamePlayerClient game={game} />

      {/* Related Games */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="sec-title text-base">🎮 You Might Also Like</h2>
          <Link href="/games" className="text-neon-purple text-sm font-rajdhani font-semibold hover:underline">All Games →</Link>
        </div>
        <GameGrid games={related} />
      </div>
    </div>
  )
}
