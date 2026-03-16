import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function useFavorites(userId: string | undefined) {
  const [favorites, setFavorites] = useState(new Set<string>())

  useEffect(() => {
    if (!userId) return
    getSupabaseBrowserClient()
      .from('favorites').select('game_id').eq('user_id', userId)
      .then(({ data }) => { if (data) setFavorites(new Set(data.map((f: { game_id: string }) => f.game_id))) })
  }, [userId])

  const toggle = useCallback(async (gameId: string) => {
    if (!userId) { toast.error('Sign in to save favorites'); return }
    const isFav = favorites.has(gameId)
    setFavorites(prev => { const n = new Set(prev); isFav ? n.delete(gameId) : n.add(gameId); return n })
    const sb = getSupabaseBrowserClient()
    if (isFav) {
      await sb.from('favorites').delete().eq('user_id', userId).eq('game_id', gameId)
    } else {
      await sb.from('favorites').insert({ user_id: userId, game_id: gameId })
      toast.success('Added to favorites!')
    }
  }, [userId, favorites])

  return { favorites, toggle }
}
