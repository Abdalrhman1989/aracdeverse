'use client'
import { formatScore } from '@/lib/utils'

interface Props { score: number }

export function GameHUD({ score }: Props) {
  if (score === 0) return null
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="px-4 py-2 rounded-xl text-center" style={{ background: '#0f0f2a', border: '1px solid rgba(139,92,246,0.18)' }}>
        <div className="font-orbitron text-xl font-bold text-neon-blue">{formatScore(score)}</div>
        <div className="text-space-dim text-xs">SCORE</div>
      </div>
    </div>
  )
}
