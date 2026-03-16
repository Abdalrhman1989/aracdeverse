'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import Link from 'next/link'
import type { GameMeta } from '@/types/game'
import type { CategoryInfo } from '@/lib/games'
import { GameGrid } from '@/components/ui/GameGrid'
import { cn } from '@/lib/utils'

type Sort = 'popular' | 'newest' | 'alphabetical'

interface Props { games: GameMeta[]; categories: CategoryInfo[] }

export function GamesFilterClient({ games, categories }: Props) {
  const params = useSearchParams()
  const [q,        setQ]   = useState(params.get('q') ?? '')
  const [category, setCat] = useState('all')
  const [sort,     setSort] = useState<Sort>('popular')
  const [multiOnly, setMulti] = useState(false)
  const [newOnly,  setNew]  = useState(false)

  const filtered = useMemo(() => {
    let r = games
    if (category !== 'all') {
      if (category === '2player')     r = r.filter(g => g.is2P || g.hasOnline)
      else if (category === 'multiplayer') r = r.filter(g => g.category === 'multiplayer' || g.supportsMultiplayer)
      else r = r.filter(g => g.category === category)
    }
    if (q.trim()) {
      const lq = q.toLowerCase()
      r = r.filter(g => g.title.toLowerCase().includes(lq) || g.tags.some(t => t.includes(lq)))
    }
    if (multiOnly) r = r.filter(g => g.supportsMultiplayer || g.hasOnline)
    if (newOnly)   r = r.filter(g => g.isNew || g.badge === 'new')
    if (sort === 'popular')     r = [...r].sort((a,b) => b.playCount - a.playCount)
    if (sort === 'alphabetical') r = [...r].sort((a,b) => a.title.localeCompare(b.title))
    if (sort === 'newest')      r = [...r].sort((a,b) => (b.isNew?1:0)-(a.isNew?1:0))
    return r
  }, [games, category, q, sort, multiOnly, newOnly])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-space-dim" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search games..."
            className="input-space pl-9" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as Sort)}
          className="input-space sm:w-48">
          <option value="popular">Most Popular</option>
          <option value="newest">Newest First</option>
          <option value="alphabetical">A-Z</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={cn('px-4 py-2 rounded-full text-sm font-rajdhani font-semibold transition-all',
              category === c.id ? 'text-black' : 'text-space-muted hover:text-white card-space')}
            style={category === c.id ? { background: '#8b5cf6' } : {}}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setMulti(!multiOnly)} className={cn('px-3 py-1.5 rounded-lg text-xs font-orbitron transition-all', multiOnly ? 'bg-neon-purple text-white' : 'card-space text-space-muted hover:text-white')}>Multiplayer Only</button>
        <button onClick={() => setNew(!newOnly)}     className={cn('px-3 py-1.5 rounded-lg text-xs font-orbitron transition-all', newOnly   ? 'bg-neon-green text-black' : 'card-space text-space-muted hover:text-white')}>New Games</button>
      </div>

      <p className="text-space-dim text-sm font-rajdhani">{filtered.length} game{filtered.length !== 1 ? 's' : ''} found</p>

      {filtered.length > 0
        ? <GameGrid games={filtered} />
        : <div className="text-center py-20"><p className="font-orbitron text-xl text-space-muted mb-2">No games found</p><p className="text-space-dim text-sm">Try adjusting your filters</p></div>
      }
    </div>
  )
}
