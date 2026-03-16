import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { GAMES, CATEGORIES, getGamesByCategory } from '@/lib/games'
import { GameGrid } from '@/components/ui/GameGrid'

interface Props { params: Promise<{ category: string }> }

export async function generateStaticParams() {
  return CATEGORIES.map(c => ({ category: c.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const cat = CATEGORIES.find(c => c.id === category)
  if (!cat) return {}
  const count = getGamesByCategory(category).length
  return {
    title: `${cat.label} Games — ArcadeVerse`,
    description: `Play ${count} free ${cat.label.toLowerCase()} games in your browser. No download required.`,
  }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const cat = CATEGORIES.find(c => c.id === category)
  if (!cat) notFound()
  const games = getGamesByCategory(category)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <nav className="flex items-center gap-2 text-xs text-space-dim mb-6">
        <Link href="/" className="hover:text-neon-purple">Home</Link> ›
        <Link href="/games" className="hover:text-neon-purple">Games</Link> ›
        <span className="text-space-text">{cat.label}</span>
      </nav>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-5xl">{cat.icon}</span>
        <div>
          <h1 className="font-orbitron font-black text-4xl text-white">{cat.label}</h1>
          <p className="text-space-muted font-rajdhani">{games.length} games available</p>
        </div>
      </div>
      <GameGrid games={games} />
    </div>
  )
}
