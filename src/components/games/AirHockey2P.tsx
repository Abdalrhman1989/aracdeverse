"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const W=400,H=500,PUCK_R=14,PADDLE_R=24,WIN=5

export default function AirHockey2P({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const stateRef=useRef({
    puck:{x:W/2,y:H/2,vx:4,vy:3},
    p1:{x:W/2,y:H-60},
    p2:{x:W/2,y:60},
    score:[0,0],
  })
  const [phase,setPhase]=useState<GamePhase>("start")
  const [scores,setScores]=useState([0,0])
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const keysRef=useRef<Set<string>>(new Set())

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!;const s=stateRef.current
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    // Table markings
    ctx.strokeStyle="rgba(255,255,255,0.15)";ctx.lineWidth=2
    ctx.beginPath();ctx.arc(W/2,H/2,80,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke()
    // Goals
    ctx.strokeStyle="rgba(139,92,246,0.6)";ctx.lineWidth=4
    ctx.beginPath();ctx.moveTo(W/2-60,0);ctx.lineTo(W/2+60,0);ctx.stroke()
    ctx.strokeStyle="rgba(6,182,212,0.6)"
    ctx.beginPath();ctx.moveTo(W/2-60,H);ctx.lineTo(W/2+60,H);ctx.stroke()
    // Paddles
    const p1g=ctx.createRadialGradient(s.p1.x,s.p1.y,4,s.p1.x,s.p1.y,PADDLE_R)
    p1g.addColorStop(0,"#06b6d4");p1g.addColorStop(1,"rgba(6,182,212,0.3)")
    ctx.fillStyle=p1g;ctx.beginPath();ctx.arc(s.p1.x,s.p1.y,PADDLE_R,0,Math.PI*2);ctx.fill()
    const p2g=ctx.createRadialGradient(s.p2.x,s.p2.y,4,s.p2.x,s.p2.y,PADDLE_R)
    p2g.addColorStop(0,"#8b5cf6");p2g.addColorStop(1,"rgba(139,92,246,0.3)")
    ctx.fillStyle=p2g;ctx.beginPath();ctx.arc(s.p2.x,s.p2.y,PADDLE_R,0,Math.PI*2);ctx.fill()
    // Puck
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s.puck.x,s.puck.y,PUCK_R,0,Math.PI*2);ctx.fill()
    // Score
    ctx.fillStyle="rgba(6,182,212,0.9)";ctx.font="28px Orbitron,monospace";ctx.textAlign="center"
    ctx.fillText(String(s.score[0]),W/4,H-15)
    ctx.fillStyle="rgba(139,92,246,0.9)"
    ctx.fillText(String(s.score[1]),W/4,30)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    const s=stateRef.current;const pk=s.puck
    // Input
    if(keysRef.current.has("KeyA")) s.p1.x=Math.max(PADDLE_R,s.p1.x-5)
    if(keysRef.current.has("KeyD")) s.p1.x=Math.min(W-PADDLE_R,s.p1.x+5)
    if(keysRef.current.has("KeyW")) s.p1.y=Math.max(H/2+PADDLE_R,s.p1.y-5)
    if(keysRef.current.has("KeyS")) s.p1.y=Math.min(H-PADDLE_R,s.p1.y+5)
    if(keysRef.current.has("ArrowLeft")) s.p2.x=Math.max(PADDLE_R,s.p2.x-5)
    if(keysRef.current.has("ArrowRight")) s.p2.x=Math.min(W-PADDLE_R,s.p2.x+5)
    if(keysRef.current.has("ArrowUp")) s.p2.y=Math.max(PADDLE_R,s.p2.y-5)
    if(keysRef.current.has("ArrowDown")) s.p2.y=Math.min(H/2-PADDLE_R,s.p2.y+5)
    pk.x+=pk.vx;pk.y+=pk.vy
    // Wall bounce
    if(pk.x-PUCK_R<=0||pk.x+PUCK_R>=W) pk.vx*=-1
    // Paddle collision helper
    const hitPaddle=(px:number,py:number)=>{
      const dx=pk.x-px,dy=pk.y-py,d=Math.sqrt(dx*dx+dy*dy)
      if(d<PUCK_R+PADDLE_R){const nx=dx/d,ny=dy/d;const spd=Math.sqrt(pk.vx*pk.vx+pk.vy*pk.vy);pk.vx=nx*spd*1.05;pk.vy=ny*spd*1.05;pk.x=px+nx*(PUCK_R+PADDLE_R+1);pk.y=py+ny*(PUCK_R+PADDLE_R+1)}
    }
    hitPaddle(s.p1.x,s.p1.y);hitPaddle(s.p2.x,s.p2.y)
    // Goals
    if(pk.y<0 && pk.x>W/2-60 && pk.x<W/2+60){s.score[0]++;setScores([...s.score]);pk.x=W/2;pk.y=H/2;pk.vx=4*(Math.random()<0.5?1:-1);pk.vy=3}
    if(pk.y>H && pk.x>W/2-60 && pk.x<W/2+60){s.score[1]++;setScores([...s.score]);pk.x=W/2;pk.y=H/2;pk.vx=4*(Math.random()<0.5?1:-1);pk.vy=-3}
    else if(pk.y<-20||pk.y>H+20){pk.y=H/2;pk.vy*=-1}
    if(s.score[0]>=WIN||s.score[1]>=WIN){phaseRef.current="gameover";setPhase("gameover");onGameOver(Math.max(s.score[0],s.score[1]))}
    const spd=Math.sqrt(pk.vx*pk.vx+pk.vy*pk.vy);if(spd>15){pk.vx=pk.vx/spd*15;pk.vy=pk.vy/spd*15}
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onGameOver])

  const startGame=useCallback(()=>{
    stateRef.current={puck:{x:W/2,y:H/2,vx:4,vy:3},p1:{x:W/2,y:H-60},p2:{x:W/2,y:60},score:[0,0]}
    setScores([0,0]);phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!)
    rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart])

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{keysRef.current.add(e.code);e.preventDefault()}
    const up=(e:KeyboardEvent)=>keysRef.current.delete(e.code)
    window.addEventListener("keydown",down);window.addEventListener("keyup",up)
    draw()
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);cancelAnimationFrame(rafRef.current!)}
  },[draw])

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-12 text-sm font-rajdhani">
        <span className="text-neon-blue">P1 (bottom): WASD</span>
        <span className="text-neon-purple">P2 (top): Arrow keys</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 max-h-[65vh]" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">🏒</div>
          <h2 className="text-2xl font-orbitron text-neon-blue mb-2">AIR HOCKEY</h2>
          <p className="text-space-muted mb-2 text-sm">P1: WASD | P2: Arrow keys</p>
          <p className="text-space-muted mb-6 text-sm">First to {WIN} goals wins!</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">START MATCH</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-xl font-orbitron text-neon-yellow mb-1">{scores[0]>=WIN?"P1 WINS!":"P2 WINS!"}</h2>
          <p className="text-2xl font-bold text-white mb-6">{scores[0]} – {scores[1]}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>
        </div>}
      </div>
    </div>
  )
}