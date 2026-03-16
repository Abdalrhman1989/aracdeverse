import { useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

export function useScoreSubmission() {
  const { user } = useAuthStore()

  const submitScore = useCallback(async (gameId: string, score: number) => {
    if (!user || score <= 0) return
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, score }),
      })
    } catch { /* Silently fail — never break gameplay */ }
  }, [user])

  return { submitScore, isSignedIn: !!user }
}
