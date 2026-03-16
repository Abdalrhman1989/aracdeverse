'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import type { GameMeta, GameComponentProps } from '@/types/game'
import { useGameStore } from '@/store/game'
import { useScoreSubmission } from '@/hooks/useScoreSubmission'
import { useAuthStore } from '@/store/auth'
import { useFavorites } from '@/hooks/useFavorites'
import { GameHUD } from './GameHUD'
import { IframeGamePlayer } from './IframeGamePlayer'
import { OnlineLobby } from './OnlineLobby'
import { Heart, Share2, Maximize, Pause, Play, Users, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { setMuted, isMuted } from '@/lib/sound'

// Dynamic imports — code split every game
const CANVAS_GAMES: Record<string, React.ComponentType<GameComponentProps>> = {
  snake:       dynamic(() => import('@/components/games/SnakeGame'),       { ssr:false }),
  tetris:      dynamic(() => import('@/components/games/TetrisGame'),      { ssr:false }),
  '2048':      dynamic(() => import('@/components/games/Game2048'),        { ssr:false }),
  flappy:      dynamic(() => import('@/components/games/FlappyBird'),      { ssr:false }),
  space:       dynamic(() => import('@/components/games/SpaceShooter'),    { ssr:false }),
  breakout:    dynamic(() => import('@/components/games/BrickBreaker'),    { ssr:false }),
  memory:      dynamic(() => import('@/components/games/MemoryMatch'),     { ssr:false }),
  dino:        dynamic(() => import('@/components/games/DinoRun'),         { ssr:false }),
  whack:       dynamic(() => import('@/components/games/WhackAMole'),      { ssr:false }),
  tictac:      dynamic(() => import('@/components/games/TicTacToeAI'),     { ssr:false }),
  catch:       dynamic(() => import('@/components/games/FruitCatcher'),    { ssr:false }),
  dodge:       dynamic(() => import('@/components/games/DodgeMasters'),    { ssr:false }),
  pong:        dynamic(() => import('@/components/games/Pong2P'),          { ssr:false }),
  tictac2p:    dynamic(() => import('@/components/games/TicTacToe2P'),     { ssr:false }),
  airhockey:   dynamic(() => import('@/components/games/AirHockey2P'),     { ssr:false }),
  racing2p:    dynamic(() => import('@/components/games/Racing2P'),        { ssr:false }),
  snake2p:     dynamic(() => import('@/components/games/SnakeBattleOnline'),{ ssr:false }),
  pong2p:      dynamic(() => import('@/components/games/PongOnline'),      { ssr:false }),
  pacman:      dynamic(() => import('@/components/games/PacmanGame'),      { ssr:false }),
  platformer:  dynamic(() => import('@/components/games/PixelDash'),       { ssr:false }),
  solitaire:   dynamic(() => import('@/components/games/SolitaireGame'),   { ssr:false }),
  bubble:      dynamic(() => import('@/components/games/BubbleShooterGame'), { ssr:false }),
  wordscramble:dynamic(() => import('@/components/games/WordScramble'),    { ssr:false }),
  // Western Card games
  blackjack:   dynamic(() => import('@/components/games/BlackjackGame'),   { ssr:false }),
  hearts:      dynamic(() => import('@/components/games/HeartsGame'),      { ssr:false }),
  slapjack:    dynamic(() => import('@/components/games/SlapJackGame'),    { ssr:false }),
  war:         dynamic(() => import('@/components/games/WarCardGame'),     { ssr:false }),
  // Arab & Middle Eastern Card Games
  trix:        dynamic(() => import('@/components/games/TrixGame'),        { ssr:false }),
  tarneeb:     dynamic(() => import('@/components/games/TarneebGame'),     { ssr:false }),
  baloot:      dynamic(() => import('@/components/games/BalootGame'),      { ssr:false }),
  estimation:  dynamic(() => import('@/components/games/EstimationGame'), { ssr:false }),
  basra:       dynamic(() => import('@/components/games/BasraGame'),       { ssr:false }),
  kout:        dynamic(() => import('@/components/games/KoutBo6Game'),     { ssr:false }),
  oono:        dynamic(() => import('@/components/games/OONOGame'),        { ssr:false }),
  // Board Games
  ludo:        dynamic(() => import('@/components/games/LudoGame'),        { ssr:false }),
  domino:      dynamic(() => import('@/components/games/DominoGame'),      { ssr:false }),
  snakes:      dynamic(() => import('@/components/games/SnakesLaddersGame'), { ssr:false }),
}

interface Props { game: GameMeta }

export function GamePlayerClient({ game }: Props) {
  const { setScore, setPhase, currentScore } = useGameStore()
  const { submitScore } = useScoreSubmission()
  const { user } = useAuthStore()
  const { favorites, toggle } = useFavorites(user?.id)
  const [isPaused,   setIsPaused]   = useState(false)
  const [lobbyOpen,  setLobbyOpen]  = useState(false)
  const [roomId,     setRoomId]     = useState<string>()
  const [muted,      setMutedState] = useState(false)

  const toggleMute = useCallback(() => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    toast(next ? '🔇 Sound off' : '🔊 Sound on', { duration: 1500 })
  }, [muted])

  const onScoreUpdate = useCallback((s: number) => setScore(s), [setScore])
  const onGameOver    = useCallback((final: number) => {
    setPhase('gameover')
    submitScore(game.id, final)
  }, [setPhase, submitScore, game.id])
  const onGameStart   = useCallback(() => setPhase('playing'), [setPhase])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: `Play ${game.title} on ArcadeVerse!`, text: `I'm playing ${game.title} — challenge me!`, url }) } catch {} }
    else { navigator.clipboard?.writeText(url); toast.success('🔗 Link copied! Share with friends') }
  }

  const handleInvite = async () => {
    const url = `${window.location.origin}/play/${game.id}?invite=1`
    try { await navigator.clipboard?.writeText(url) } catch {}
    toast.success('🎮 Invite link copied! Send to your friend', { duration: 3000 })
  }

  const handleFullscreen = () => {
    const el = document.getElementById('game-area')
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  const GameComponent = CANVAS_GAMES[game.id]

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/games" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-rajdhani font-semibold text-space-muted hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.18)' }}>
          ← Back
        </Link>
        <h1 className="font-orbitron font-bold text-xl text-white flex-1 truncate">{game.title}</h1>
        <div className="flex items-center gap-2">
          {game.type === 'canvas' && (
            <button onClick={() => setIsPaused(p => !p)}
              className={cn('p-2 rounded-xl transition-colors', isPaused ? 'text-neon-green bg-neon-green/10' : 'text-space-muted hover:text-neon-green')}
              style={{ border: '1px solid rgba(139,92,246,0.18)' }} title={isPaused ? 'Resume' : 'Pause'}>
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
          {game.hasOnline && (
            <button onClick={() => setLobbyOpen(true)} className="btn-online !px-3 !py-2 !text-sm flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Play Online
            </button>
          )}
          {(game.hasOnline || game.is2P) && (
            <button onClick={handleInvite} className="p-2 rounded-xl text-space-muted hover:text-neon-purple transition-colors" style={{ border: '1px solid rgba(139,92,246,0.18)' }} title="Copy invite link">
              🔗
            </button>
          )}
          <button onClick={() => toggle(game.id)} className={cn('p-2 rounded-xl transition-colors', favorites.has(game.id) ? 'text-neon-pink bg-neon-pink/10' : 'text-space-muted hover:text-neon-pink')} style={{ border: '1px solid rgba(139,92,246,0.18)' }} title="Favorite">
            <Heart className={cn('w-4 h-4', favorites.has(game.id) && 'fill-current')} />
          </button>
          <button onClick={handleShare} className="p-2 rounded-xl text-space-muted hover:text-neon-blue transition-colors" style={{ border: '1px solid rgba(139,92,246,0.18)' }} title="Share">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={toggleMute}
            className={cn('p-2 rounded-xl transition-colors', muted ? 'text-red-400 bg-red-400/10' : 'text-space-muted hover:text-neon-yellow')}
            style={{ border: '1px solid rgba(139,92,246,0.18)' }} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button onClick={handleFullscreen} className="p-2 rounded-xl text-space-muted hover:text-neon-blue transition-colors" style={{ border: '1px solid rgba(139,92,246,0.18)' }} title="Fullscreen">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Score HUD */}
      <GameHUD score={currentScore} />

      {/* Game area */}
      <div id="game-area" className="rounded-2xl overflow-hidden mb-5" style={{ border: '1px solid rgba(139,92,246,0.18)' }}>
        {game.type === 'iframe' ? (
          <IframeGamePlayer game={game} />
        ) : GameComponent ? (
          <div className="bg-black flex justify-center">
            <GameComponent
              gameId={game.id}
              onScoreUpdate={onScoreUpdate}
              onGameOver={onGameOver}
              onGameStart={onGameStart}
              isPaused={isPaused}
              roomId={roomId}
            />
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center text-space-muted">Game not found</div>
        )}
      </div>

      {/* Info panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 rounded-2xl p-5" style={{ background: '#0f0f2a', border: '1px solid rgba(139,92,246,0.18)' }}>
          <h3 className="font-orbitron font-bold text-sm text-white mb-3 flex items-center gap-2">📋 About</h3>
          <p className="text-space-muted text-sm leading-relaxed">{game.description}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {game.tags.map(tag => (
              <span key={tag} className="px-2 py-1 rounded-full text-neon-purple text-xs font-rajdhani" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.22)' }}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: '#0f0f2a', border: '1px solid rgba(139,92,246,0.18)' }}>
            <h3 className="font-orbitron font-bold text-sm text-white mb-3">⌨️ Controls</h3>
            <ul className="space-y-2">
              {game.controls.map(([key, action]) => (
                <li key={key} className="flex items-center gap-2 text-sm text-space-muted border-b pb-2 last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <code className="px-2 py-0.5 rounded text-xs text-white font-mono" style={{ background: '#141438', border: '1px solid rgba(139,92,246,0.18)' }}>{key}</code>
                  {action}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl p-5 text-center" style={{ background: '#0f0f2a', border: '1px solid rgba(139,92,246,0.18)' }}>
            <div className="font-orbitron font-black text-4xl text-neon-yellow">{game.rating}</div>
            <div className="text-neon-yellow text-lg mt-1">{'⭐'.repeat(5)}</div>
            <div className="text-space-dim text-xs mt-1">Community Rating</div>
          </div>
        </div>
      </div>

      {lobbyOpen && <OnlineLobby game={game} onClose={() => setLobbyOpen(false)} onStart={rId => { setRoomId(rId); setLobbyOpen(false) }} />}
    </>
  )
}
