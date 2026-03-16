"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const W = 320, H = 480
const BIRD_X = 60, BIRD_R = 14

const DIFFICULTY = {
  easy:   { gravity: 0.32, jump: -7.0, pipeSpeed: 2.0, gap: 160, interval: 110 },
  medium: { gravity: 0.45, jump: -8.5, pipeSpeed: 2.5, gap: 130, interval: 90  },
  hard:   { gravity: 0.60, jump: -9.5, pipeSpeed: 3.5, gap: 100, interval: 70  },
}

type Diff = 'easy' | 'medium' | 'hard'
interface Pipe { x: number; top: number; passed: boolean }
interface State { birdY: number; vel: number; pipes: Pipe[]; score: number; frame: number; birdAngle: number }

export default function FlappyBird({ onScoreUpdate, onGameOver, onGameStart, isPaused }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<State>({birdY:H/2,vel:0,pipes:[],score:0,frame:0,birdAngle:0})
  const [phase, setPhase] = useState<GamePhase>("start")
  const [score, setScore] = useState(0)
  const [diff, setDiff] = useState<Diff>('medium')
  const phaseRef = useRef<GamePhase>("start")
  const diffRef = useRef<Diff>('medium')
  const rafRef = useRef<number>()

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if(!canvas) return
    const ctx = canvas.getContext("2d")!
    const s = stateRef.current
    const cfg = DIFFICULTY[diffRef.current]
    const sky = ctx.createLinearGradient(0,0,0,H)
    sky.addColorStop(0,"#0a0a1a"); sky.addColorStop(1,"#1a0a2e")
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H)
    ctx.fillStyle="rgba(255,255,255,0.6)"
    for(let i=0;i<30;i++){ const sx=(i*137+s.frame*0.3)%W, sy=(i*97)%H; ctx.beginPath(); ctx.arc(sx,sy,0.8,0,Math.PI*2); ctx.fill() }
    s.pipes.forEach(p => {
      const pg = ctx.createLinearGradient(p.x,0,p.x+52,0)
      pg.addColorStop(0,"#10b981"); pg.addColorStop(1,"#059669")
      ctx.fillStyle=pg; ctx.fillRect(p.x,0,52,p.top); ctx.fillRect(p.x,p.top+cfg.gap,52,H-p.top-cfg.gap)
      ctx.fillStyle="#064e3b"; ctx.fillRect(p.x-4,p.top-12,60,12); ctx.fillRect(p.x-4,p.top+cfg.gap,60,12)
    })
    ctx.save(); ctx.translate(BIRD_X,s.birdY); ctx.rotate(s.birdAngle*Math.PI/180)
    const bg = ctx.createRadialGradient(0,0,2,0,0,BIRD_R)
    bg.addColorStop(0,"#fbbf24"); bg.addColorStop(1,"#f59e0b")
    ctx.fillStyle=bg; ctx.beginPath(); ctx.ellipse(0,0,BIRD_R,BIRD_R-2,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle="#78350f"; ctx.beginPath(); ctx.ellipse(8,0,6,4,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(BIRD_R/2-4,-BIRD_R/2+4,4,0,Math.PI*2); ctx.fill()
    ctx.fillStyle="#1e1b4b"; ctx.beginPath(); ctx.arc(BIRD_R/2-3,-BIRD_R/2+4,2,0,Math.PI*2); ctx.fill()
    ctx.restore()
    const gg = ctx.createLinearGradient(0,H-40,0,H)
    gg.addColorStop(0,"#065f46"); gg.addColorStop(1,"#022c22")
    ctx.fillStyle=gg; ctx.fillRect(0,H-40,W,40)
    ctx.fillStyle="white"; ctx.font="bold 24px Orbitron,monospace"; ctx.textAlign="center"; ctx.fillText(String(s.score),W/2,40)
  }, [])

  const loop = useCallback(() => {
    if(phaseRef.current!=="playing"){ rafRef.current=requestAnimationFrame(loop); draw(); return }
    const s = stateRef.current
    const cfg = DIFFICULTY[diffRef.current]
    s.frame++; s.vel+=cfg.gravity; s.birdY+=s.vel; s.birdAngle=Math.max(-25,Math.min(70,s.vel*5))
    if(s.frame%cfg.interval===0){ s.pipes.push({x:W, top:60+Math.random()*(H-cfg.gap-100), passed:false}) }
    s.pipes.forEach(p=>p.x-=cfg.pipeSpeed)
    s.pipes=s.pipes.filter(p=>p.x>-52)
    s.pipes.forEach(p=>{ if(!p.passed && p.x+52<BIRD_X){ p.passed=true; s.score++; setScore(s.score); onScoreUpdate(s.score) } })
    const hit = s.birdY-BIRD_R<0||s.birdY+BIRD_R>H-40||s.pipes.some(p=>BIRD_X+BIRD_R>p.x&&BIRD_X-BIRD_R<p.x+52&&(s.birdY-BIRD_R<p.top||s.birdY+BIRD_R>p.top+cfg.gap))
    if(hit){ phaseRef.current="gameover"; setPhase("gameover"); onGameOver(s.score); draw(); return }
    draw(); rafRef.current=requestAnimationFrame(loop)
  }, [draw, onScoreUpdate, onGameOver])

  const jump = useCallback(() => {
    const cfg = DIFFICULTY[diffRef.current]
    if(phaseRef.current==="start"){ phaseRef.current="playing"; setPhase("playing"); onGameStart(); stateRef.current.vel=cfg.jump; rafRef.current=requestAnimationFrame(loop) }
    else if(phaseRef.current==="playing"){ stateRef.current.vel=cfg.jump }
    else if(phaseRef.current==="gameover"){ stateRef.current={birdY:H/2,vel:0,pipes:[],score:0,frame:0,birdAngle:0}; setScore(0); phaseRef.current="playing"; setPhase("playing"); onGameStart(); rafRef.current=requestAnimationFrame(loop) }
  }, [loop, onGameStart])

  useEffect(() => {
    const onKey=(e: KeyboardEvent)=>{ if(e.code==="Space"||e.code==="ArrowUp"){ jump(); e.preventDefault() } }
    window.addEventListener("keydown",onKey); draw()
    return ()=>{ window.removeEventListener("keydown",onKey); cancelAnimationFrame(rafRef.current!) }
  }, [draw, jump])

  const diffColors = { easy:'#10b981', medium:'#8b5cf6', hard:'#ef4444' }
  const diffLabels = { easy:'Easy', medium:'Medium', hard:'Hard' }
  const diffDesc = { easy:'Wider gaps, slower', medium:'Standard challenge', hard:'Narrow gaps, fast!' }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative cursor-pointer" onClick={jump}>
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 max-h-[70vh] object-contain" />
        {phase==="start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg p-6">
            <div className="text-5xl mb-3">🐦</div>
            <h2 className="text-2xl font-orbitron text-neon-yellow mb-1">FLAPPY BIRD</h2>
            <p className="text-space-muted mb-4 text-sm">Tap / Space to flap!</p>
            <p className="text-white font-bold mb-3 font-orbitron text-xs tracking-widest">SELECT DIFFICULTY</p>
            <div className="flex flex-col gap-2 w-full max-w-[220px] mb-4">
              {(['easy','medium','hard'] as Diff[]).map(d => (
                <button key={d} onClick={e=>{e.stopPropagation();setDiff(d);diffRef.current=d}}
                  className="px-4 py-2 rounded-xl font-bold text-sm transition-all text-white"
                  style={{ background: diff===d ? diffColors[d] : 'rgba(255,255,255,0.07)', border: `2px solid ${diff===d ? diffColors[d] : 'rgba(255,255,255,0.15)'}` }}>
                  <span className="block">{diffLabels[d]}</span>
                  <span className="text-xs opacity-70">{diffDesc[d]}</span>
                </button>
              ))}
            </div>
            <button className="btn-primary px-8 py-3 w-full max-w-[220px]" onClick={e=>{e.stopPropagation();jump()}}>TAP TO START</button>
          </div>
        )}
        {phase==="gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg" onClick={e=>e.stopPropagation()}>
            <div className="text-4xl mb-2">💥</div>
            <h2 className="text-xl font-orbitron text-neon-red mb-1">CRASHED!</h2>
            <div className="text-xs text-space-muted mb-1 font-orbitron uppercase tracking-widest">{diffLabels[diff]}</div>
            <p className="text-3xl font-bold text-neon-yellow mb-5">{score}</p>
            <div className="flex gap-3">
              <button className="btn-primary px-6 py-2" onClick={jump}>Retry</button>
              <button className="btn-secondary px-4 py-2 text-sm" onClick={()=>setPhase("start")}>Change Diff</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
