'use client'
import Link from 'next/link'
import type { GameMeta } from '@/types/game'
import { formatPlayCount, cn } from '@/lib/utils'
import { Heart } from 'lucide-react'

interface Props {
  game:             GameMeta
  isFavorite?:      boolean
  onToggleFavorite?: (id: string) => void
  variant?:         'default' | 'compact'
}

const BADGE_LABELS: Record<string, string> = {
  hot: '🔥 Hot', new: '✨ New', top: '🏆 Top', '2p': '👥 2P', online: '🌍 Online'
}

export function GameCard({ game, isFavorite, onToggleFavorite, variant = 'default' }: Props) {
  if (variant === 'compact') {
    return (
      <Link href={`/play/${game.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: `linear-gradient(135deg,${game.bgGradient[0]},${game.bgGradient[1]})` }}>{game.icon}</div>
        <div className="min-w-0">
          <div className="font-orbitron font-bold text-sm text-white truncate">{game.title}</div>
          <div className="text-space-dim text-xs">{formatPlayCount(game.playCount)}</div>
        </div>
        <div className="ml-auto text-neon-yellow text-xs font-bold shrink-0">⭐ {game.rating}</div>
      </Link>
    )
  }

  return (
    <div className="game-card group">
      <Link href={`/play/${game.id}`}>
        <div className="relative aspect-[4/3] flex items-center justify-center text-5xl overflow-hidden"
          style={{ background: `linear-gradient(135deg,${game.bgGradient[0]},${game.bgGradient[1]})` }}>
          {game.icon}
          {game.badge && <span className={`badge badge-${game.badge}`}>{BADGE_LABELS[game.badge] ?? ''}</span>}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all"
              style={{ background: '#8b5cf6' }}>▶</div>
          </div>
        </div>
        <div className="p-3">
          <div className="font-orbitron font-bold text-sm text-white truncate mb-1">{game.title}</div>
          <div className="flex items-center justify-between">
            <span className="text-space-dim text-xs uppercase tracking-wide">{game.is2P ? '👥 ' : ''}{game.category}</span>
            <span className="text-neon-yellow text-xs font-bold">⭐ {game.rating}</span>
          </div>
          <div className="text-space-dim text-xs mt-1">{formatPlayCount(game.playCount)}</div>
        </div>
      </Link>
      {onToggleFavorite && (
        <button
          onClick={e => { e.preventDefault(); onToggleFavorite(game.id) }}
          className={cn('absolute top-2 right-2 p-1.5 rounded-full transition-colors', isFavorite ? 'text-neon-pink bg-neon-pink/20' : 'text-white/50 hover:text-neon-pink bg-black/30')}
          aria-label="Toggle favorite"
        >
          <Heart className={cn('w-3.5 h-3.5', isFavorite && 'fill-current')} />
        </button>
      )}
    </div>
  )
}
