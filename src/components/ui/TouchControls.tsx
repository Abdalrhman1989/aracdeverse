'use client'
import { useCallback } from 'react'

export type Direction = 'up' | 'down' | 'left' | 'right'

interface Props {
  onDirection: (dir: Direction) => void
  onAction?:   (btn: 'A' | 'B') => void
  mode?:       'dpad' | 'tap'
  onTap?:      () => void
  onRelease?:  () => void
}

function DpadBtn({ dir, onDir, label }: { dir: Direction; onDir: (d: Direction) => void; label: string }) {
  const handle = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); onDir(dir)
  }, [dir, onDir])
  return (
    <button
      className="flex items-center justify-center rounded-lg text-white text-lg font-bold select-none"
      style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)', width: 52, height: 52 }}
      onTouchStart={handle} onMouseDown={handle} aria-label={dir}
    >{label}</button>
  )
}

export function TouchControls({ onDirection, onAction, mode = 'dpad', onTap, onRelease }: Props) {
  if (mode === 'tap') {
    return (
      <div className="w-full px-4">
        <button onClick={onTap} className="w-full py-5 rounded-xl text-white font-rajdhani font-bold text-lg"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
          TAP TO PLAY / JUMP
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-8 px-4 py-3 w-full"
      style={{ background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
      {/* D-pad */}
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3,52px)', gridTemplateRows: 'repeat(3,52px)' }}>
        <div />
        <DpadBtn dir="up"    onDir={onDirection} label="▲" />
        <div />
        <DpadBtn dir="left"  onDir={onDirection} label="◀" />
        <div className="flex items-center justify-center rounded-lg text-space-dim text-xs"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>⏸</div>
        <DpadBtn dir="right" onDir={onDirection} label="▶" />
        <div />
        <DpadBtn dir="down"  onDir={onDirection} label="▼" />
        <div />
      </div>
      {/* Action buttons */}
      {onAction && (
        <div className="flex flex-col gap-2">
          {(['A','B'] as const).map(btn => (
            <button key={btn}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold font-orbitron"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)' }}
              onTouchStart={e => { e.preventDefault(); onAction(btn) }}
              onMouseDown={() => onAction(btn)}>
              {btn}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default TouchControls
