import { create } from 'zustand'
import type { GamePhase } from '@/types/game'

interface GameState {
  currentScore:  number
  phase:         GamePhase
  isPlaying:     boolean
  isPaused:      boolean
  gameOver:      boolean
  setScore:      (score: number) => void
  setPhase:      (phase: GamePhase) => void
  resetGame:     () => void
}

export const useGameStore = create<GameState>(set => ({
  currentScore:  0,
  phase:         'start',
  isPlaying:     false,
  isPaused:      false,
  gameOver:      false,
  setScore:  currentScore  => set({ currentScore }),
  setPhase:  phase         => set({
    phase,
    isPlaying: phase === 'playing',
    isPaused:  phase === 'paused',
    gameOver:  phase === 'gameover',
  }),
  resetGame: () => set({ currentScore: 0, phase: 'start', isPlaying: false, isPaused: false, gameOver: false }),
}))
