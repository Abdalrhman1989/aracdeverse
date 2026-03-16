'use client'
import { useAuthStore } from '@/store/auth'
import { useFavorites } from '@/hooks/useFavorites'
import { GameCard } from './GameCard'
import type { GameMeta } from '@/types/game'

interface Props {
  games:   GameMeta[]
  variant?: 'default' | 'compact'
}

export function GameGrid({ games, variant = 'default' }: Props) {
  const { user } = useAuthStore()
  const { favorites, toggle } = useFavorites(user?.id)

  return (
    <div className={variant === 'compact'
      ? 'flex flex-col'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4'
    }>
      {games.map(game => (
        <GameCard
          key={game.id}
          game={game}
          variant={variant}
          isFavorite={favorites.has(game.id)}
          onToggleFavorite={user ? toggle : undefined}
        />
      ))}
    </div>
  )
}
