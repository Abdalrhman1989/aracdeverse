import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GAMES, CATEGORIES } from '@/lib/games'
import { GamesFilterClient } from '@/components/home/GamesFilterClient'

export const metadata: Metadata = {
  title: 'All Games — ArcadeVerse',
  description: `Browse all ${GAMES.length}+ free online games. Filter by arcade, puzzle, multiplayer, racing, and more.`,
}

export default function GamesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="font-orbitron font-black text-4xl neon-text mb-2">All Games</h1>
        <p className="text-space-muted font-rajdhani">{GAMES.length} games available</p>
      </div>
      <Suspense fallback={<div className="text-space-muted">Loading...</div>}>
        <GamesFilterClient games={GAMES} categories={CATEGORIES} />
      </Suspense>
    </div>
  )
}
