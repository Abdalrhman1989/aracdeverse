'use client'
import { useState } from 'react'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import type { GameMeta } from '@/types/game'

interface Props { game: GameMeta }

export function IframeGamePlayer({ game }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState(false)

  const url = game.iframeUrl
  if (!url) return (
    <div className="aspect-video flex items-center justify-center bg-black text-space-muted">
      <AlertTriangle className="w-8 h-8 mr-2" /> No URL configured for this game.
    </div>
  )

  if (error) return (
    <div className="aspect-video flex flex-col items-center justify-center bg-black gap-4">
      <AlertTriangle className="w-12 h-12 text-neon-orange" />
      <p className="font-orbitron text-white">Unable to embed this game</p>
      <p className="text-space-muted text-sm text-center max-w-xs">The game may have blocked embedding. Open it directly in a new tab.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
        <ExternalLink className="w-4 h-4" /> Open {game.title}
      </a>
    </div>
  )

  return (
    <div className="relative" style={{ aspectRatio: '16/9' }}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
          <div className="w-10 h-10 rounded-full border-2 border-neon-blue border-t-transparent animate-spin mb-3" />
          <p className="font-orbitron text-sm text-space-muted">Loading {game.title}...</p>
        </div>
      )}
      <iframe
        src={url}
        title={game.title}
        className="w-full h-full border-0"
        allow="fullscreen; gamepad; autoplay; pointer-lock"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-orientation-lock allow-popups"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}
