"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const W=360,H=480

type Difficulty = 'easy'|'medium'|'hard'

const DIFFICULTY = {
  easy:   { bulletSpeed:2.5, spawnRate:90, maxBullets:6  },
  medium: { bulletSpeed:4,   spawnRate:60, maxBullets:10 },
  hard:   { bulletSpeed:6,   spawnRate:35, maxBullets:15 },
}

interface Bullet{x:number;y:number;vx:number;vy:number;r:number}

export default function DodgeMasters({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const playerRef=useRef({x:W/2,y:H/2})
  const bulletsRef=useRef<Bullet[]>([])
  const scoreRef=useRef(0)
  const frameRef=useRef(0)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const [difficulty,setDifficulty]=useState<Difficulty>('medium')
  const difficultyRef=useRef<Difficulty>('medium')
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const keysRef=useRef<Set<string>>(new Set())
  const touchRef=useRef<string|null>(null)

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    ctx.strokeStyle="rgba(139,92,246,0.08)";ctx.lineWidth=0.5
    for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    bulletsRef.current.forEach(b=>{
      const g=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,b.r)
      g.addColorStop(0,"#fff");g.addColorStop(1,"#ef4444")
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill()
    })
    const p=playerRef.current
    ctx.strokeStyle="#8b5cf6";ctx.lineWidth=2
    for(let i=0;i<3;i++){
      ctx.globalAlpha=1-(i*0.25);ctx.beginPath();ctx.arc(p.x,p.y,8+i*5,0,Math.PI*2);ctx.stroke()
    }
    ctx.globalAlpha=1;ctx.fillStyle="#8b5cf6";ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill()
    ctx.fillStyle="rgba(255,255,255,0.9)";ctx.font="14px Orbitron,monospace";ctx.textAlign="left"
    ctx.fillText(`${scoreRef.current}`,8,22)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    frameRef.current++;const p=playerRef.current
    const dir=touchRef.current
    if(keysRef.current.has("ArrowLeft")||dir==="left") p.x=Math.max(8,p.x-4)
    if(keysRef.current.has("ArrowRight")||dir==="right") p.x=Math.min(W-8,p.x+4)
    if(keysRef.current.has("ArrowUp")||dir==="up") p.y=Math.max(8,p.y-4)
    if(keysRef.current.has("ArrowDown")||dir==="down") p.y=Math.min(H-8,p.y+4)
    const cfg=DIFFICULTY[difficultyRef.current]
    if(bulletsRef.current.length<cfg.maxBullets && frameRef.current%cfg.spawnRate===0){
      const side=Math.floor(Math.random()*4)
      let x=0,y=0,vx=0,vy=0
      const spd=cfg.bulletSpeed+Math.random()*1.5+scoreRef.current/1000
      if(side===0){x=Math.random()*W;y=-10;vx=(Math.random()-0.5)*2;vy=spd}
      else if(side===1){x=W+10;y=Math.random()*H;vx=-spd;vy=(Math.random()-0.5)*2}
      else if(side===2){x=Math.random()*W;y=H+10;vx=(Math.random()-0.5)*2;vy=-spd}
      else{x=-10;y=Math.random()*H;vx=spd;vy=(Math.random()-0.5)*2}
      bulletsRef.current.push({x,y,vx,vy,r:4+Math.random()*4})
    }
    bulletsRef.current.forEach(b=>{b.x+=b.vx;b.y+=b.vy})
    bulletsRef.current=bulletsRef.current.filter(b=>b.x>-20&&b.x<W+20&&b.y>-20&&b.y<H+20)
    if(frameRef.current%10===0){scoreRef.current++;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
    const hit=bulletsRef.current.some(b=>{const dx=b.x-p.x,dy=b.y-p.y;return Math.sqrt(dx*dx+dy*dy)<b.r+5})
    if(hit){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return}
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback((diff:Difficulty)=>{
    difficultyRef.current=diff
    playerRef.current={x:W/2,y:H/2};bulletsRef.current=[];scoreRef.current=0;frameRef.current=0
    setScore(0);phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!)
    rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart])

  const goToStart=useCallback(()=>{
    phaseRef.current="start";setPhase("start")
    cancelAnimationFrame(rafRef.current!)
    draw()
  },[draw])

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>keysRef.current.add(e.code)
    const up=(e:KeyboardEvent)=>keysRef.current.delete(e.code)
    window.addEventListener("keydown",down);window.addEventListener("keyup",up)
    draw()
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);cancelAnimationFrame(rafRef.current!)}
  },[draw])

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 max-h-[65vh]" />

        {phase==="start"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg px-6">
            <div className="text-5xl mb-3">🎯</div>
            <h2 className="text-2xl font-orbitron text-neon-purple mb-1">DODGE MASTERS</h2>
            <p className="text-space-muted mb-5 text-sm">Avoid all bullets. Survive!</p>
            <p className="text-space-muted text-xs uppercase tracking-widest mb-3">Select Difficulty</p>
            <div className="flex gap-3">
              <button
                onClick={()=>{setDifficulty('easy');startGame('easy')}}
                className="px-5 py-2 rounded-lg font-orbitron text-sm font-bold border-2 border-green-500 text-green-400 hover:bg-green-500/20 transition-all">
                EASY
              </button>
              <button
                onClick={()=>{setDifficulty('medium');startGame('medium')}}
                className="px-5 py-2 rounded-lg font-orbitron text-sm font-bold border-2 border-purple-500 text-purple-400 hover:bg-purple-500/20 transition-all">
                MEDIUM
              </button>
              <button
                onClick={()=>{setDifficulty('hard');startGame('hard')}}
                className="px-5 py-2 rounded-lg font-orbitron text-sm font-bold border-2 border-red-500 text-red-400 hover:bg-red-500/20 transition-all">
                HARD
              </button>
            </div>
          </div>
        )}

        {phase==="gameover"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
            <div className="text-4xl mb-2">💥</div>
            <h2 className="text-xl font-orbitron text-neon-red mb-1">HIT!</h2>
            <p className="text-3xl font-bold text-neon-yellow mb-6">{score}</p>
            <div className="flex gap-3">
              <button onClick={()=>startGame(difficulty)} className="btn-primary px-6 py-3">RETRY</button>
              <button onClick={goToStart} className="px-6 py-3 rounded-lg font-orbitron text-sm border-2 border-space-border text-space-muted hover:border-neon-purple/50 hover:text-white transition-all">CHANGE DIFFICULTY</button>
            </div>
          </div>
        )}
      </div>
      <TouchControls mode="dpad" onDirection={d=>touchRef.current=d} onRelease={()=>touchRef.current=null} />
    </div>
  )
}
