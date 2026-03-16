export type GameCategory =
  | 'arcade' | 'puzzle' | 'action' | 'racing' | 'sports'
  | 'shooting' | 'strategy' | 'multiplayer' | 'retro' | 'sandbox'

export type GameBadge = 'hot' | 'new' | 'top' | '2p' | 'online' | ''
export type GameType  = 'canvas' | 'iframe'
export type TouchControlMode = 'dpad' | 'tap' | 'slide' | 'none'

export interface GameMeta {
  id:                   string
  title:                string
  description:          string
  category:             GameCategory
  tags:                 string[]
  badge?:               GameBadge
  rating:               number
  playCount:            number
  icon:                 string
  bgGradient:           [string, string]
  type:                 GameType
  iframeUrl?:           string
  controls:             Array<[string, string]>
  isNew?:               boolean
  is2P?:                boolean
  hasOnline?:           boolean
  supportsMultiplayer?: boolean
  touchControlMode?:    TouchControlMode
}

export interface GameComponentProps {
  gameId:        string
  onScoreUpdate: (score: number) => void
  onGameOver:    (finalScore: number) => void
  onGameStart:   () => void
  isPaused:      boolean
  roomId?:       string
}

export type GamePhase = 'start' | 'playing' | 'paused' | 'gameover'
