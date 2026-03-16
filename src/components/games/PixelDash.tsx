"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const W=480,H=320,GRAVITY=0.5,JUMP=-12,MOVE_SPD=3.5

interface Platform{x:number;y:number;w:number;h:number;color?:string;moves?:boolean;vx?:number;minX?:number;maxX?:number}
interface Coin{x:number;y:number;collected:boolean}
interface Enemy{x:number;y:number;vx:number;alive:boolean}
interface Spike{x:number;y:number;w:number}

interface Level{platforms:Platform[];coins:Coin[];enemies:Enemy[];spikes:Spike[];goal:{x:number;y:number}}

function level1():Level{
  return{
    platforms:[
      {x:0,y:280,w:200,h:20},{x:250,y:240,w:120,h:20},{x:420,y:200,w:180,h:20},
      {x:0,y:160,w:150,h:20},{x:200,y:130,w:80,h:20,moves:true,vx:1.5,minX:200,maxX:320},
      {x:380,y:100,w:200,h:20},{x:0,y:60,w:120,h:20},{x:200,y:40,w:300,h:20},
    ],
    coins:[
      {x:80,y:255,collected:false},{x:300,y:215,collected:false},{x:470,y:175,collected:false},
      {x:50,y:135,collected:false},{x:240,y:105,collected:false},{x:420,y:75,collected:false},
    ],
    enemies:[
      {x:260,y:220,vx:1,alive:true},{x:430,y:180,vx:-1,alive:true},
    ],
    spikes:[{x:180,y:268,w:30},{x:370,y:188,w:30}],
    goal:{x:450,y:20},
  }
}

export default function PixelDash({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const playerRef=useRef({x:20,y:240,vx:0,vy:0,onGround:false,jumps:0,facing:1,deaths:0})
  const levelRef=useRef(level1())
  const scoreRef=useRef(0)
  const frameRef=useRef(0)
  const cameraRef=useRef({x:0})
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const keysRef=useRef<Set<string>>(new Set())
  const touchRef=useRef<{left:boolean,right:boolean,jump:boolean}>({left:false,right:false,jump:false})
  const jumpPressedRef=useRef(false)

  function rectOverlap(ax:number,ay:number,aw:number,ah:number,bx:number,by:number,bw:number,bh:number){
    return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by
  }

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!;const lv=levelRef.current;const cam=cameraRef.current
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    // Stars
    for(let i=0;i<40;i++){ctx.fillStyle="rgba(255,255,255,0.3)";ctx.beginPath();ctx.arc((i*137)%W,(i*89)%H,0.8,0,Math.PI*2);ctx.fill()}
    ctx.save();ctx.translate(-cam.x,0)
    // Platforms
    lv.platforms.forEach(p=>{
      const g=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h)
      g.addColorStop(0,p.moves?"#06b6d4":"#8b5cf6");g.addColorStop(1,p.moves?"#0369a1":"#6d28d9")
      ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,3);ctx.fill()
    })
    // Spikes
    lv.spikes.forEach(s=>{
      ctx.fillStyle="#ef4444"
      for(let i=0;i<s.w/12;i++){
        ctx.beginPath();ctx.moveTo(s.x+i*12,s.y+10);ctx.lineTo(s.x+i*12+6,s.y);ctx.lineTo(s.x+i*12+12,s.y+10);ctx.fill()
      }
    })
    // Enemies
    lv.enemies.filter(e=>e.alive).forEach(e=>{
      ctx.fillStyle="#ef4444";ctx.beginPath();ctx.roundRect(e.x,e.y,20,20,4);ctx.fill()
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(e.x+5,e.y+6,3,0,Math.PI*2);ctx.fill()
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(e.x+15,e.y+6,3,0,Math.PI*2);ctx.fill()
    })
    // Coins
    lv.coins.forEach(c=>{
      if(c.collected) return
      ctx.fillStyle="#fbbf24"
      ctx.beginPath();ctx.arc(c.x+6,c.y+6,6,0,Math.PI*2);ctx.fill()
    })
    // Goal
    const goal=lv.goal;ctx.fillStyle="#10b981";ctx.beginPath();ctx.arc(goal.x+10,goal.y+10,10,0,Math.PI*2);ctx.fill()
    ctx.fillStyle="#fff";ctx.font="12px serif";ctx.fillText("🚪",goal.x+2,goal.y+16)
    // Player
    const p=playerRef.current
    ctx.save();ctx.translate(p.x+10,p.y+14);if(p.facing===-1) ctx.scale(-1,1)
    ctx.fillStyle="#8b5cf6";ctx.beginPath();ctx.roundRect(-10,-14,20,24,4);ctx.fill()
    ctx.fillStyle="#c4b5fd";ctx.fillRect(-6,-14,12,8)
    ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(0,-8,5,0,Math.PI*2);ctx.fill()
    ctx.fillStyle="#1e1b4b";ctx.beginPath();ctx.arc(2,-9,2,0,Math.PI*2);ctx.fill()
    ctx.restore()
    ctx.restore()
    // HUD
    ctx.fillStyle="rgba(255,255,255,0.9)";ctx.font="13px Orbitron,monospace";ctx.textAlign="left"
    ctx.fillText(`SCORE: ${scoreRef.current}`,8,20)
    ctx.textAlign="right";ctx.fillText(`❤ ${3-playerRef.current.deaths}`,W-8,20)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    frameRef.current++;const p=playerRef.current;const lv=levelRef.current;const cam=cameraRef.current
    // Input
    const left=keysRef.current.has("ArrowLeft")||keysRef.current.has("KeyA")||touchRef.current.left
    const right=keysRef.current.has("ArrowRight")||keysRef.current.has("KeyD")||touchRef.current.right
    const jumpKey=keysRef.current.has("ArrowUp")||keysRef.current.has("KeyW")||keysRef.current.has("Space")||touchRef.current.jump
    if(left){p.vx=-MOVE_SPD;p.facing=-1}
    else if(right){p.vx=MOVE_SPD;p.facing=1}
    else p.vx=0
    if(jumpKey&&!jumpPressedRef.current&&p.jumps<2){p.vy=JUMP;p.jumps++;jumpPressedRef.current=true}
    if(!jumpKey) jumpPressedRef.current=false
    p.vy+=GRAVITY;p.x+=p.vx;p.y+=p.vy
    p.onGround=false
    // Move platforms
    lv.platforms.forEach(pl=>{
      if(!pl.moves) return
      pl.x+=pl.vx!;if(pl.x<pl.minX!||pl.x+pl.w>pl.maxX!) pl.vx!*=-1
    })
    // Platform collision
    lv.platforms.forEach(pl=>{
      if(rectOverlap(p.x,p.y,20,28,pl.x,pl.y,pl.w,pl.h)&&p.vy>=0&&p.y+24<=pl.y+10){
        p.y=pl.y-28;p.vy=0;p.onGround=true;p.jumps=0
        if(pl.moves) p.x+=pl.vx!
      }
    })
    // Bounds
    if(p.y>H+50){p.deaths++;if(p.deaths>=3){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return}p.x=20;p.y=240;p.vx=0;p.vy=0}
    if(p.x<0) p.x=0
    // Camera
    cam.x=Math.max(0,p.x-W/3)
    // Coins
    lv.coins.forEach(c=>{
      if(!c.collected&&rectOverlap(p.x,p.y,20,28,c.x,c.y,12,12)){c.collected=true;scoreRef.current+=50;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
    })
    // Enemies
    lv.enemies.forEach(e=>{
      if(!e.alive) return
      e.x+=e.vx
      lv.platforms.forEach(pl=>{if((e.x<pl.x||e.x+20>pl.x+pl.w)&&e.y+20===pl.y) e.vx*=-1})
      if(e.x<0||e.x>800) e.vx*=-1
      if(rectOverlap(p.x,p.y,20,28,e.x,e.y,20,20)){
        if(p.vy>0&&p.y+28<=e.y+10){e.alive=false;p.vy=-8;scoreRef.current+=100;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
        else{p.deaths++;if(p.deaths>=3){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return}p.x=20;p.y=240;p.vx=0;p.vy=0}
      }
    })
    // Spikes
    lv.spikes.forEach(s=>{
      if(rectOverlap(p.x,p.y+20,20,8,s.x,s.y,s.w,10)){p.deaths++;if(p.deaths>=3){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return}p.x=20;p.y=240;p.vx=0;p.vy=0}
    })
    // Goal
    if(rectOverlap(p.x,p.y,20,28,lv.goal.x,lv.goal.y,20,20)){
      scoreRef.current+=500;setScore(scoreRef.current);phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return
    }
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback(()=>{
    playerRef.current={x:20,y:240,vx:0,vy:0,onGround:false,jumps:0,facing:1,deaths:0}
    levelRef.current=level1();scoreRef.current=0;frameRef.current=0;cameraRef.current={x:0}
    setScore(0);phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!);rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart])

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{ keysRef.current.add(e.code); if([" ","ArrowUp","ArrowDown"].includes(e.code)) e.preventDefault() }
    const up=(e:KeyboardEvent)=>keysRef.current.delete(e.code)
    window.addEventListener("keydown",down);window.addEventListener("keyup",up)
    draw()
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);cancelAnimationFrame(rafRef.current!)}
  },[draw])

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 w-full max-w-2xl" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">🎮</div>
          <h2 className="text-2xl font-orbitron text-neon-purple mb-2">PIXEL DASH</h2>
          <p className="text-space-muted mb-2 text-sm">Arrow keys / WASD to move</p>
          <p className="text-space-muted mb-6 text-sm">Space / Up to jump (double jump!)</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">PLAY!</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">🎯</div>
          <h2 className="text-xl font-orbitron text-neon-purple mb-1">GAME OVER</h2>
          <p className="text-3xl font-bold text-neon-yellow mb-6">{score}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">TRY AGAIN</button>
        </div>}
      </div>
      <TouchControls mode="dpad" onDirection={d=>{
        if(d==="left") touchRef.current={...touchRef.current,left:true,right:false}
        else if(d==="right") touchRef.current={...touchRef.current,right:true,left:false}
        else if(d==="up") touchRef.current={...touchRef.current,jump:true}
      }} onRelease={()=>touchRef.current={left:false,right:false,jump:false}} />
    </div>
  )
}