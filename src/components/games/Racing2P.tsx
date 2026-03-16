"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const W=500,H=400,LAPS=3

interface Car{x:number;y:number;angle:number;speed:number;lap:number;checkpoint:number}

// Simple oval track waypoints
const WAYPOINTS=[{x:250,y:60},{x:420,y:120},{x:460,y:200},{x:420,y:280},{x:250,y:340},{x:80,y:280},{x:40,y:200},{x:80,y:120}]

function angleTo(from:{x:number,y:number},to:{x:number,y:number}){return Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI}
function dist(a:{x:number,y:number},b:{x:number,y:number}){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)}

export default function Racing2P({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const carsRef=useRef<[Car,Car]>([
    {x:220,y:340,angle:-90,speed:0,lap:0,checkpoint:0},
    {x:280,y:340,angle:-90,speed:0,lap:0,checkpoint:0},
  ])
  const frameRef=useRef(0)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [laps,setLaps]=useState([0,0])
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const keysRef=useRef<Set<string>>(new Set())

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    // Track outer
    ctx.strokeStyle="#1e1b4b";ctx.lineWidth=60
    ctx.beginPath();ctx.ellipse(W/2,H/2,190,150,0,0,Math.PI*2);ctx.stroke()
    // Track surface
    ctx.strokeStyle="#374151";ctx.lineWidth=50
    ctx.beginPath();ctx.ellipse(W/2,H/2,190,150,0,0,Math.PI*2);ctx.stroke()
    // Track lines
    ctx.strokeStyle="rgba(255,255,255,0.15)";ctx.lineWidth=2;ctx.setLineDash([20,20])
    ctx.beginPath();ctx.ellipse(W/2,H/2,190,150,0,0,Math.PI*2);ctx.stroke()
    ctx.setLineDash([])
    // Start line
    ctx.strokeStyle="#fff";ctx.lineWidth=4
    ctx.beginPath();ctx.moveTo(220,320);ctx.lineTo(280,320);ctx.stroke()
    // Cars
    const colors=["#06b6d4","#f97316"]
    carsRef.current.forEach((car,ci)=>{
      ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.angle*Math.PI/180)
      ctx.fillStyle=colors[ci];ctx.beginPath();ctx.roundRect(-12,-7,24,14,3);ctx.fill()
      ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(-6,-5,8,10)
      ctx.fillStyle=colors[ci]=== "#06b6d4"?"#f97316":"#06b6d4"
      ctx.beginPath();ctx.arc(-10,0,3,0,Math.PI*2);ctx.fill()
      ctx.restore()
    })
    // HUD
    ctx.fillStyle="rgba(255,255,255,0.9)";ctx.font="14px Orbitron,monospace"
    ctx.textAlign="left";ctx.fillStyle="#06b6d4";ctx.fillText(`P1 Lap: ${carsRef.current[0].lap}/${LAPS}`,8,22)
    ctx.textAlign="right";ctx.fillStyle="#f97316";ctx.fillText(`P2 Lap: ${carsRef.current[1].lap}/${LAPS}`,W-8,22)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    frameRef.current++
    const [c1,c2]=carsRef.current
    // P1: WASD
    if(keysRef.current.has("KeyW")) c1.speed=Math.min(c1.speed+0.3,5)
    else if(keysRef.current.has("KeyS")) c1.speed=Math.max(c1.speed-0.3,-2)
    else c1.speed*=0.96
    if(keysRef.current.has("KeyA")) c1.angle-=c1.speed*2
    if(keysRef.current.has("KeyD")) c1.angle+=c1.speed*2
    // P2: Arrow keys
    if(keysRef.current.has("ArrowUp")) c2.speed=Math.min(c2.speed+0.3,5)
    else if(keysRef.current.has("ArrowDown")) c2.speed=Math.max(c2.speed-0.3,-2)
    else c2.speed*=0.96
    if(keysRef.current.has("ArrowLeft")) c2.angle-=c2.speed*2
    if(keysRef.current.has("ArrowRight")) c2.angle+=c2.speed*2
    // Move
    carsRef.current.forEach(car=>{
      car.x+=Math.cos(car.angle*Math.PI/180)*car.speed
      car.y+=Math.sin(car.angle*Math.PI/180)*car.speed
      car.x=Math.max(10,Math.min(W-10,car.x));car.y=Math.max(10,Math.min(H-10,car.y))
      // Checkpoints
      const wp=WAYPOINTS[car.checkpoint]
      if(dist(car,wp)<30){
        car.checkpoint=(car.checkpoint+1)%WAYPOINTS.length
        if(car.checkpoint===0){car.lap++;setLaps([carsRef.current[0].lap,carsRef.current[1].lap])}
      }
    })
    // Win check
    carsRef.current.forEach((car,i)=>{
      if(car.lap>=LAPS){phaseRef.current="gameover";setPhase("gameover");onGameOver(car.lap);onScoreUpdate(i+1)}
    })
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onGameOver,onScoreUpdate])

  const startGame=useCallback(()=>{
    carsRef.current=[{x:220,y:340,angle:-90,speed:0,lap:0,checkpoint:0},{x:280,y:340,angle:-90,speed:0,lap:0,checkpoint:0}]
    frameRef.current=0;setLaps([0,0])
    phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!);rafRef.current=requestAnimationFrame(loop)
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
        <span className="text-neon-blue">P1: WASD</span>
        <span className="text-neon-orange">P2: Arrow keys</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">🏎️</div>
          <h2 className="text-2xl font-orbitron text-neon-orange mb-2">RACING 2P</h2>
          <p className="text-space-muted mb-2 text-sm">P1: WASD | P2: Arrow keys</p>
          <p className="text-space-muted mb-6 text-sm">Complete {LAPS} laps first!</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">START RACE</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">🏁</div>
          <h2 className="text-xl font-orbitron text-neon-yellow mb-1">{laps[0]>=LAPS?"P1 WINS!":"P2 WINS!"}</h2>
          <button onClick={startGame} className="btn-primary mt-4 px-8 py-3">RACE AGAIN</button>
        </div>}
      </div>
    </div>
  )
}