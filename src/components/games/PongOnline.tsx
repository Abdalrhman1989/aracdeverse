"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

// Reuse Pong2P as PongOnline (same-device multiplayer, could hook into Supabase Realtime)
const W=400,H=300,PADDLE_H=60,PADDLE_W=10,BALL_R=7,WIN=7

export default function PongOnline({onScoreUpdate,onGameOver,onGameStart,isPaused,roomId}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const stateRef=useRef({ball:{x:W/2,y:H/2,vx:4,vy:3},p1:{y:H/2-PADDLE_H/2,score:0},p2:{y:H/2-PADDLE_H/2,score:0}})
  const [phase,setPhase]=useState<GamePhase>("start")
  const [scores,setScores]=useState([0,0])
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const keysRef=useRef<Set<string>>(new Set())

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!;const s=stateRef.current
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    ctx.setLineDash([8,8]);ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.lineWidth=2
    ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([])
    ctx.fillStyle="#8b5cf6";ctx.beginPath();ctx.roundRect(10,s.p1.y,PADDLE_W,PADDLE_H,4);ctx.fill()
    ctx.fillStyle="#06b6d4";ctx.beginPath();ctx.roundRect(W-20,s.p2.y,PADDLE_W,PADDLE_H,4);ctx.fill()
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s.ball.x,s.ball.y,BALL_R,0,Math.PI*2);ctx.fill()
    ctx.fillStyle="white";ctx.font="32px Orbitron,monospace";ctx.textAlign="center"
    ctx.fillText(String(s.p1.score),W/4,40);ctx.fillText(String(s.p2.score),3*W/4,40)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    const s=stateRef.current;const b=s.ball
    if(keysRef.current.has("KeyW")) s.p1.y=Math.max(0,s.p1.y-5)
    if(keysRef.current.has("KeyS")) s.p1.y=Math.min(H-PADDLE_H,s.p1.y+5)
    if(keysRef.current.has("ArrowUp")) s.p2.y=Math.max(0,s.p2.y-5)
    if(keysRef.current.has("ArrowDown")) s.p2.y=Math.min(H-PADDLE_H,s.p2.y+5)
    b.x+=b.vx;b.y+=b.vy
    if(b.y-BALL_R<=0){b.y=BALL_R;b.vy=Math.abs(b.vy)}
    if(b.y+BALL_R>=H){b.y=H-BALL_R;b.vy=-Math.abs(b.vy)}
    if(b.x-BALL_R<=20+PADDLE_W&&b.y>s.p1.y&&b.y<s.p1.y+PADDLE_H&&b.vx<0){b.vx=Math.abs(b.vx)*1.05;b.vy+=((b.y-(s.p1.y+PADDLE_H/2))/PADDLE_H)*3}
    if(b.x+BALL_R>=W-20&&b.y>s.p2.y&&b.y<s.p2.y+PADDLE_H&&b.vx>0){b.vx=-Math.abs(b.vx)*1.05;b.vy+=((b.y-(s.p2.y+PADDLE_H/2))/PADDLE_H)*3}
    if(b.x<0){s.p2.score++;setScores([s.p1.score,s.p2.score]);onScoreUpdate(Math.max(s.p1.score,s.p2.score));b.x=W/2;b.y=H/2;b.vx=4;b.vy=3*(Math.random()<0.5?1:-1)}
    if(b.x>W){s.p1.score++;setScores([s.p1.score,s.p2.score]);onScoreUpdate(Math.max(s.p1.score,s.p2.score));b.x=W/2;b.y=H/2;b.vx=-4;b.vy=3*(Math.random()<0.5?1:-1)}
    const spd=Math.sqrt(b.vx*b.vx+b.vy*b.vy);if(spd>12){b.vx=b.vx/spd*12;b.vy=b.vy/spd*12}
    if(s.p1.score>=WIN||s.p2.score>=WIN){phaseRef.current="gameover";setPhase("gameover");onGameOver(Math.max(s.p1.score,s.p2.score))}
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback(()=>{
    stateRef.current={ball:{x:W/2,y:H/2,vx:4,vy:3},p1:{y:H/2-PADDLE_H/2,score:0},p2:{y:H/2-PADDLE_H/2,score:0}}
    setScores([0,0]);phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!);rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart])

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>keysRef.current.add(e.code)
    const up=(e:KeyboardEvent)=>keysRef.current.delete(e.code)
    window.addEventListener("keydown",down);window.addEventListener("keyup",up)
    draw()
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);cancelAnimationFrame(rafRef.current!)}
  },[draw])

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-12 text-sm font-rajdhani">
        <span className="text-neon-purple">P1: W/S keys</span>
        <span className="text-neon-blue">P2: ↑/↓ keys</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">🏓</div>
          <h2 className="text-2xl font-orbitron text-neon-blue mb-2">PONG ONLINE</h2>
          <p className="text-space-muted mb-6 text-sm">{roomId?"Room: "+roomId:"P1: W/S | P2: ↑/↓"}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">START</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-xl font-orbitron text-neon-yellow mb-1">{scores[0]>=WIN?"P1 WINS!":"P2 WINS!"}</h2>
          <p className="text-2xl text-white mb-6">{scores[0]} – {scores[1]}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">REMATCH</button>
        </div>}
      </div>
    </div>
  )
}