"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const W = 480, H = 200
const GROUND_Y = H - 40
const DINO_X = 60

const DIFFICULTY = {
  easy:   { baseSpeed: 3.5, speedInc: 0.0008, jumpVel: -13, gravity: 0.7,  minSpawn: 80, maxSpawn: 140 },
  medium: { baseSpeed: 5.0, speedInc: 0.0012, jumpVel: -14, gravity: 0.8,  minSpawn: 55, maxSpawn: 100 },
  hard:   { baseSpeed: 7.0, speedInc: 0.0020, jumpVel: -15, gravity: 0.95, minSpawn: 35, maxSpawn: 65  },
}

type Diff = 'easy' | 'medium' | 'hard'
interface Cactus { x: number; w: number; h: number }
interface State { dinoY: number; vel: number; onGround: boolean; cacti: Cactus[]; score: number; frame: number; speed: number; nextSpawn: number; dead: boolean }

export default function DinoRun({ onScoreUpdate, onGameOver, onGameStart, isPaused }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<GamePhase>("start")
  const [score, setScore] = useState(0)
  const [diff, setDiff] = useState<Diff>('medium')
  const stateRef = useRef<State>({ dinoY:0,vel:0,onGround:true,cacti:[],score:0,frame:0,speed:5,nextSpawn:60,dead:false })
  const phaseRef = useRef<GamePhase>("start")
  const diffRef = useRef<Diff>('medium')
  const rafRef = useRef<number>()

  const initState = useCallback((d: Diff): State => {
    const cfg = DIFFICULTY[d]
    return { dinoY:0, vel:0, onGround:true, cacti:[], score:0, frame:0, speed:cfg.baseSpeed, nextSpawn:70, dead:false }
  }, [])

  const draw = useCallback((s: State) => {
    const canvas = canvasRef.current; if(!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle="#03030a"; ctx.fillRect(0,0,W,H)
    // stars
    ctx.fillStyle="rgba(255,255,255,0.5)"
    for(let i=0;i<20;i++){ ctx.beginPath(); ctx.arc((i*73+s.frame)%W,(i*31)%(GROUND_Y-20),1,0,Math.PI*2); ctx.fill() }
    // ground
    const gg=ctx.createLinearGradient(0,GROUND_Y,0,H); gg.addColorStop(0,"#1e1b4b"); gg.addColorStop(1,"#07071a")
    ctx.fillStyle=gg; ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y)
    ctx.strokeStyle="rgba(139,92,246,0.4)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,GROUND_Y); ctx.lineTo(W,GROUND_Y); ctx.stroke()
    // cacti
    s.cacti.forEach(c => {
      const cg=ctx.createLinearGradient(c.x,0,c.x+c.w,0); cg.addColorStop(0,"#10b981"); cg.addColorStop(1,"#059669")
      ctx.fillStyle=cg; ctx.beginPath(); ctx.roundRect(c.x,GROUND_Y-c.h,c.w,c.h,3); ctx.fill()
    })
    // dino
    const dy = GROUND_Y - 40 - (s.dinoY > 0 ? s.dinoY : 0)
    const dg=ctx.createLinearGradient(DINO_X,dy,DINO_X+28,dy+38); dg.addColorStop(0,"#8b5cf6"); dg.addColorStop(1,"#06b6d4")
    ctx.fillStyle=dg; ctx.beginPath(); ctx.roundRect(DINO_X,dy+8,28,30,4); ctx.fill()
    ctx.fillStyle="#06b6d4"; ctx.beginPath(); ctx.roundRect(DINO_X+8,dy,20,18,5); ctx.fill()
    // legs
    const legOff = s.onGround ? Math.floor(s.frame/8)%2*4 : 0
    ctx.fillStyle="#7c3aed"; ctx.fillRect(DINO_X+4,dy+38,8,8+legOff); ctx.fillRect(DINO_X+16,dy+38,8,8+(legOff?0:4))
    // eye
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(DINO_X+22,dy+6,4,0,Math.PI*2); ctx.fill()
    ctx.fillStyle="#1e1b4b"; ctx.beginPath(); ctx.arc(DINO_X+23,dy+6,2,0,Math.PI*2); ctx.fill()
    // score
    ctx.fillStyle="rgba(255,255,255,0.8)"; ctx.font="bold 14px Orbitron,monospace"; ctx.textAlign="right"
    ctx.fillText(`${Math.floor(s.score)}`, W-10, 25)
  }, [])

  const loop = useCallback(() => {
    if(phaseRef.current!=="playing"){ draw(stateRef.current); rafRef.current=requestAnimationFrame(loop); return }
    const s = stateRef.current
    const cfg = DIFFICULTY[diffRef.current]
    s.frame++; s.score+=0.17; s.speed+=cfg.speedInc
    // physics
    if(!s.onGround){ s.vel+=cfg.gravity; s.dinoY=Math.max(0,s.dinoY-s.vel) }
    if(s.dinoY<=0 && !s.onGround){ s.dinoY=0; s.onGround=true; s.vel=0 }
    // spawn
    s.nextSpawn--
    if(s.nextSpawn<=0){
      s.cacti.push({x:W+10, w:14+Math.floor(Math.random()*12), h:30+Math.floor(Math.random()*20)})
      s.nextSpawn=cfg.minSpawn+Math.floor(Math.random()*(cfg.maxSpawn-cfg.minSpawn))
    }
    s.cacti.forEach(c=>c.x-=s.speed); s.cacti=s.cacti.filter(c=>c.x>-50)
    // collision
    const dinoTop=GROUND_Y-40-(s.dinoY>0?s.dinoY:0), dinoRight=DINO_X+26
    const hit=s.cacti.some(c=>dinoRight>c.x+4&&DINO_X+2<c.x+c.w-4&&GROUND_Y>GROUND_Y-c.h&&dinoTop<GROUND_Y)
    if(hit){ phaseRef.current="gameover"; setPhase("gameover"); onGameOver(Math.floor(s.score)); draw(s); return }
    setScore(Math.floor(s.score)); onScoreUpdate(Math.floor(s.score))
    draw(s); rafRef.current=requestAnimationFrame(loop)
  }, [draw, onGameOver, onScoreUpdate])

  const jump = useCallback(() => {
    const s = stateRef.current; const cfg=DIFFICULTY[diffRef.current]
    if(s.onGround){ s.onGround=false; s.vel=cfg.jumpVel }
  }, [])

  const startGame = useCallback((d: Diff) => {
    diffRef.current=d
    stateRef.current=initState(d)
    setScore(0); phaseRef.current="playing"; setPhase("playing"); onGameStart()
    cancelAnimationFrame(rafRef.current!)
    rafRef.current=requestAnimationFrame(loop)
  }, [loop, onGameStart, initState])

  useEffect(()=>{
    if(isPaused&&phaseRef.current==="playing"){ phaseRef.current="paused"; setPhase("paused"); cancelAnimationFrame(rafRef.current!) }
    else if(!isPaused&&phaseRef.current==="paused"){ phaseRef.current="playing"; setPhase("playing"); rafRef.current=requestAnimationFrame(loop) }
  },[isPaused,loop])

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{ if(e.code==="Space"||e.code==="ArrowUp"){ jump(); e.preventDefault() } }
    window.addEventListener("keydown",onKey); draw(stateRef.current)
    return ()=>{ window.removeEventListener("keydown",onKey); cancelAnimationFrame(rafRef.current!) }
  },[draw,jump])

  const diffColors={easy:'#10b981',medium:'#8b5cf6',hard:'#ef4444'}
  const diffLabels={easy:'Easy',medium:'Medium',hard:'Hard'}
  const diffDesc={easy:'Slow & sparse',medium:'Standard run',hard:'Blazing fast!'}

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative cursor-pointer w-full" onClick={jump} style={{maxWidth:W}}>
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 w-full" />
        {phase==="start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg p-4">
            <div className="text-4xl mb-2">🦕</div>
            <h2 className="text-xl font-orbitron text-neon-green mb-1">DINO RUN</h2>
            <p className="text-space-muted mb-3 text-xs">Space / Tap to jump</p>
            <p className="text-white font-bold mb-2 font-orbitron text-xs tracking-widest">DIFFICULTY</p>
            <div className="flex gap-2 mb-3">
              {(['easy','medium','hard'] as Diff[]).map(d=>(
                <button key={d} onClick={e=>{e.stopPropagation();setDiff(d);diffRef.current=d}}
                  className="px-3 py-2 rounded-lg font-bold text-xs text-white transition-all"
                  style={{background:diff===d?diffColors[d]:'rgba(255,255,255,0.07)',border:`2px solid ${diff===d?diffColors[d]:'rgba(255,255,255,0.15)'}`}}>
                  <div>{diffLabels[d]}</div><div className="opacity-70">{diffDesc[d]}</div>
                </button>
              ))}
            </div>
            <button className="btn-primary px-6 py-2" onClick={e=>{e.stopPropagation();startGame(diff)}}>RUN!</button>
          </div>
        )}
        {phase==="gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg" onClick={e=>e.stopPropagation()}>
            <div className="text-3xl mb-1">💥</div>
            <h2 className="text-lg font-orbitron text-neon-red mb-1">CRASHED!</h2>
            <div className="text-xs text-space-muted mb-1">{diffLabels[diff]}</div>
            <p className="text-2xl font-bold text-neon-yellow mb-4">{score} pts</p>
            <div className="flex gap-2">
              <button className="btn-primary px-4 py-2 text-sm" onClick={()=>startGame(diff)}>Retry</button>
              <button className="btn-secondary px-3 py-2 text-xs" onClick={()=>setPhase("start")}>Change Diff</button>
            </div>
          </div>
        )}
        {phase==="paused" && <div className="absolute inset-0 flex items-center justify-center bg-space-bg/80 rounded-lg"><span className="text-2xl font-orbitron text-neon-blue">PAUSED</span></div>}
      </div>
    </div>
  )
}
