"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const CELL = 20, COLS = 20, ROWS = 20

const DIFFICULTY = {
  easy:   { speed: 200, scorePerFood: 10, speedIncrease: 1 },
  medium: { speed: 150, scorePerFood: 15, speedIncrease: 2 },
  hard:   { speed: 90,  scorePerFood: 25, speedIncrease: 4 },
}

type Dir = { x: number; y: number }
type Diff = 'easy' | 'medium' | 'hard'

interface State {
  snake: Array<{x:number;y:number}>
  dir: Dir; nextDir: Dir
  food: {x:number;y:number}
  score: number; speed: number
}

export default function SnakeGame({ onScoreUpdate, onGameOver, onGameStart, isPaused }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<State>({ snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}], dir:{x:1,y:0}, nextDir:{x:1,y:0}, food:{x:15,y:10}, score:0, speed:150 })
  const [phase, setPhase] = useState<GamePhase>("start")
  const [score, setScore] = useState(0)
  const [diff, setDiff] = useState<Diff>('medium')
  const loopRef = useRef<ReturnType<typeof setTimeout>>()
  const phaseRef = useRef<GamePhase>("start")
  const diffRef = useRef<Diff>('medium')

  const placeFood = useCallback((snake: Array<{x:number;y:number}>) => {
    let pos: {x:number;y:number}
    do { pos = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) } }
    while (snake.some(s => s.x===pos.x && s.y===pos.y))
    return pos
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if(!canvas) return
    const ctx = canvas.getContext("2d")!
    const s = stateRef.current
    ctx.fillStyle = "#03030a"; ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.strokeStyle = "rgba(139,92,246,0.08)"; ctx.lineWidth = 0.5
    for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) ctx.strokeRect(x*CELL,y*CELL,CELL,CELL)
    const gf = ctx.createRadialGradient(s.food.x*CELL+CELL/2,s.food.y*CELL+CELL/2,2,s.food.x*CELL+CELL/2,s.food.y*CELL+CELL/2,CELL/2)
    gf.addColorStop(0,"#fff"); gf.addColorStop(1,"#ef4444")
    ctx.fillStyle=gf; ctx.beginPath(); ctx.arc(s.food.x*CELL+CELL/2,s.food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2); ctx.fill()
    s.snake.forEach((seg,i) => {
      const alpha = 1-(i/s.snake.length)*0.5
      const g = ctx.createLinearGradient(seg.x*CELL,seg.y*CELL,seg.x*CELL+CELL,seg.y*CELL+CELL)
      g.addColorStop(0,`rgba(139,92,246,${alpha})`); g.addColorStop(1,`rgba(6,182,212,${alpha})`)
      ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(seg.x*CELL+1,seg.y*CELL+1,CELL-2,CELL-2,4); ctx.fill()
      if(i===0){ ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(seg.x*CELL+CELL/2+(s.dir.x===1?3:s.dir.x===-1?-3:0),seg.y*CELL+CELL/2+(s.dir.y===1?3:s.dir.y===-1?-3:0),2,0,Math.PI*2); ctx.fill() }
    })
  }, [])

  const tick = useCallback(() => {
    if(phaseRef.current!=="playing") return
    const s = stateRef.current
    const cfg = DIFFICULTY[diffRef.current]
    s.dir = s.nextDir
    const head = { x: s.snake[0].x+s.dir.x, y: s.snake[0].y+s.dir.y }
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||s.snake.some(seg=>seg.x===head.x&&seg.y===head.y)){
      phaseRef.current="gameover"; setPhase("gameover"); onGameOver(s.score); draw(); return
    }
    s.snake.unshift(head)
    if(head.x===s.food.x && head.y===s.food.y){
      s.score += cfg.scorePerFood
      s.speed = Math.max(50, s.speed - cfg.speedIncrease)
      s.food = placeFood(s.snake)
      setScore(s.score); onScoreUpdate(s.score)
    } else { s.snake.pop() }
    draw()
    loopRef.current = setTimeout(tick, s.speed)
  }, [draw, onGameOver, onScoreUpdate, placeFood])

  const startGame = useCallback((d: Diff) => {
    diffRef.current = d
    const cfg = DIFFICULTY[d]
    stateRef.current = { snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}], dir:{x:1,y:0}, nextDir:{x:1,y:0}, food:{x:15,y:10}, score:0, speed:cfg.speed }
    setScore(0); phaseRef.current="playing"; setPhase("playing"); onGameStart()
    clearTimeout(loopRef.current); loopRef.current = setTimeout(tick, cfg.speed)
  }, [tick, onGameStart])

  useEffect(() => {
    if(isPaused && phaseRef.current==="playing"){ phaseRef.current="paused"; setPhase("paused"); clearTimeout(loopRef.current) }
    else if(!isPaused && phaseRef.current==="paused"){ phaseRef.current="playing"; setPhase("playing"); loopRef.current=setTimeout(tick,stateRef.current.speed) }
  }, [isPaused, tick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current
      const map: Record<string,Dir> = { ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},KeyW:{x:0,y:-1},KeyS:{x:0,y:1},KeyA:{x:-1,y:0},KeyD:{x:1,y:0} }
      const d = map[e.code]
      if(d && !(d.x===-s.dir.x&&d.y===0) && !(d.y===-s.dir.y&&d.x===0)){ s.nextDir=d; e.preventDefault() }
    }
    window.addEventListener("keydown",onKey); draw()
    return () => { window.removeEventListener("keydown",onKey); clearTimeout(loopRef.current) }
  }, [draw])

  const handleTouch = useCallback((dir: string) => {
    const s = stateRef.current
    const map: Record<string,Dir> = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}
    const d = map[dir]
    if(d && !(d.x===-s.dir.x&&d.y===0) && !(d.y===-s.dir.y&&d.x===0)) s.nextDir=d
  }, [])

  const diffColors: Record<Diff, string> = { easy:'#10b981', medium:'#8b5cf6', hard:'#ef4444' }
  const diffLabels: Record<Diff, string> = { easy:'Easy', medium:'Medium', hard:'Hard' }
  const diffDesc: Record<Diff, string> = { easy:'Slow pace, 10pts/food', medium:'Standard speed, 15pts', hard:'Fast & furious, 25pts' }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL} className="rounded-lg border border-neon-purple/30" />
        {phase==="start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg p-6">
            <div className="text-5xl mb-3">🐍</div>
            <h2 className="text-2xl font-orbitron text-neon-purple mb-1">SNAKE</h2>
            <p className="text-space-muted mb-5 text-sm text-center">Use arrow keys or WASD to move</p>
            <p className="text-white font-bold mb-3 font-orbitron text-sm tracking-widest">SELECT DIFFICULTY</p>
            <div className="flex flex-col gap-2 w-full max-w-[220px] mb-4">
              {(['easy','medium','hard'] as Diff[]).map(d => (
                <button key={d} onClick={() => { setDiff(d); diffRef.current=d }}
                  className="px-4 py-2 rounded-xl font-bold text-sm transition-all text-white"
                  style={{ background: diff===d ? diffColors[d] : 'rgba(255,255,255,0.07)', border: `2px solid ${diff===d ? diffColors[d] : 'rgba(255,255,255,0.15)'}`, transform: diff===d ? 'scale(1.04)' : 'scale(1)' }}>
                  <span className="block">{diffLabels[d]}</span>
                  <span className="text-xs opacity-70">{diffDesc[d]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => startGame(diff)} className="btn-primary px-8 py-3 w-full max-w-[220px]">START</button>
          </div>
        )}
        {phase==="gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg">
            <div className="text-5xl mb-3">💀</div>
            <h2 className="text-2xl font-orbitron text-neon-red mb-1">GAME OVER</h2>
            <div className="text-xs text-space-muted mb-1 font-orbitron uppercase tracking-widest">{diffLabels[diff]}</div>
            <p className="text-3xl font-bold text-neon-yellow mb-2">{score}</p>
            <p className="text-space-muted text-xs mb-5">Snake length: {stateRef.current.snake.length}</p>
            <div className="flex gap-3">
              <button onClick={() => startGame(diff)} className="btn-primary px-6 py-2">Retry</button>
              <button onClick={() => setPhase("start")} className="btn-secondary px-4 py-2 text-sm">Change Diff</button>
            </div>
          </div>
        )}
        {phase==="paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-space-bg/80 rounded-lg">
            <span className="text-3xl font-orbitron text-neon-blue">PAUSED</span>
          </div>
        )}
      </div>
      <TouchControls mode="dpad" onDirection={handleTouch} />
    </div>
  )
}
