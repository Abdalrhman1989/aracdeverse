"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const CELL=20,COLS=20,ROWS=20,SPEED=150

type Dir={x:number;y:number}
interface SnakeState{body:Array<{x:number;y:number}>;dir:Dir;nextDir:Dir;alive:boolean;score:number;color:string}

export default function SnakeBattleOnline({gameId,onScoreUpdate,onGameOver,onGameStart,isPaused,roomId}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const s1Ref=useRef<SnakeState>({body:[{x:5,y:10},{x:4,y:10},{x:3,y:10}],dir:{x:1,y:0},nextDir:{x:1,y:0},alive:true,score:0,color:"#8b5cf6"})
  const s2Ref=useRef<SnakeState>({body:[{x:15,y:10},{x:16,y:10},{x:17,y:10}],dir:{x:-1,y:0},nextDir:{x:-1,y:0},alive:true,score:0,color:"#f97316"})
  const foodRef=useRef({x:10,y:5})
  const [phase,setPhase]=useState<GamePhase>("start")
  const [scores,setScores]=useState([0,0])
  const phaseRef=useRef<GamePhase>("start")
  const loopRef=useRef<ReturnType<typeof setTimeout>>()

  function placeFood(s1:SnakeState,s2:SnakeState){
    let pos:{x:number;y:number}
    do{pos={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}}
    while([...s1.body,...s2.body].some(seg=>seg.x===pos.x&&seg.y===pos.y))
    return pos
  }

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,COLS*CELL,ROWS*CELL)
    ctx.strokeStyle="rgba(139,92,246,0.07)";ctx.lineWidth=0.5
    for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++) ctx.strokeRect(x*CELL,y*CELL,CELL,CELL)
    // Food
    ctx.fillStyle="#ef4444";ctx.beginPath();ctx.arc(foodRef.current.x*CELL+CELL/2,foodRef.current.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2);ctx.fill()
    // Snakes
    ;[s1Ref.current,s2Ref.current].forEach(s=>{
      if(!s.alive) return
      s.body.forEach((seg,i)=>{
        const alpha=1-(i/s.body.length)*0.5
        ctx.globalAlpha=alpha;ctx.fillStyle=s.color
        ctx.beginPath();ctx.roundRect(seg.x*CELL+1,seg.y*CELL+1,CELL-2,CELL-2,3);ctx.fill()
      })
      ctx.globalAlpha=1
    })
    // Score
    ctx.font="12px Orbitron,monospace";ctx.textAlign="left"
    ctx.fillStyle=s1Ref.current.color;ctx.fillText(`P1:${s1Ref.current.score}`,4,16)
    ctx.textAlign="right";ctx.fillStyle=s2Ref.current.color;ctx.fillText(`P2:${s2Ref.current.score}`,COLS*CELL-4,16)
  },[])

  function moveSnake(s:SnakeState,food:{x:number;y:number},other:SnakeState){
    s.dir=s.nextDir
    const head={x:s.body[0].x+s.dir.x,y:s.body[0].y+s.dir.y}
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS) return false
    if([...s.body,...other.body].some(seg=>seg.x===head.x&&seg.y===head.y)) return false
    s.body.unshift(head)
    if(head.x===food.x&&head.y===food.y){s.score+=10;return "ate"}
    s.body.pop();return true
  }

  const tick=useCallback(()=>{
    if(phaseRef.current!=="playing") return
    const s1=s1Ref.current,s2=s2Ref.current
    const r1=moveSnake(s1,foodRef.current,s2)
    const r2=moveSnake(s2,foodRef.current,s1)
    if(r1==="ate"||r2==="ate") foodRef.current=placeFood(s1,s2)
    if(r1===false) s1.alive=false
    if(r2===false) s2.alive=false
    setScores([s1.score,s2.score])
    onScoreUpdate(Math.max(s1.score,s2.score))
    if(!s1.alive||!s2.alive){
      phaseRef.current="gameover";setPhase("gameover")
      onGameOver(Math.max(s1.score,s2.score))
      draw();return
    }
    draw()
    loopRef.current=setTimeout(tick,SPEED)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback(()=>{
    s1Ref.current={body:[{x:5,y:10},{x:4,y:10},{x:3,y:10}],dir:{x:1,y:0},nextDir:{x:1,y:0},alive:true,score:0,color:"#8b5cf6"}
    s2Ref.current={body:[{x:15,y:10},{x:16,y:10},{x:17,y:10}],dir:{x:-1,y:0},nextDir:{x:-1,y:0},alive:true,score:0,color:"#f97316"}
    foodRef.current={x:10,y:5};setScores([0,0])
    phaseRef.current="playing";setPhase("playing");onGameStart()
    clearTimeout(loopRef.current);loopRef.current=setTimeout(tick,SPEED)
  },[tick,onGameStart])

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const s1=s1Ref.current,s2=s2Ref.current
      const m1:{[k:string]:Dir}={KeyW:{x:0,y:-1},KeyS:{x:0,y:1},KeyA:{x:-1,y:0},KeyD:{x:1,y:0}}
      const m2:{[k:string]:Dir}={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}}
      const d1=m1[e.code];if(d1&&!(d1.x===-s1.dir.x&&d1.y===0)&&!(d1.y===-s1.dir.y&&d1.x===0)) s1.nextDir=d1
      const d2=m2[e.code];if(d2&&!(d2.x===-s2.dir.x&&d2.y===0)&&!(d2.y===-s2.dir.y&&d2.x===0)) s2.nextDir=d2
      e.preventDefault()
    }
    window.addEventListener("keydown",onKey)
    draw()
    return()=>{window.removeEventListener("keydown",onKey);clearTimeout(loopRef.current)}
  },[draw])

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-12 text-sm font-rajdhani">
        <span style={{color:"#8b5cf6"}}>P1: WASD</span>
        <span style={{color:"#f97316"}}>P2: Arrow keys</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL} className="rounded-lg border border-neon-purple/30" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">🐍</div>
          <h2 className="text-2xl font-orbitron text-neon-purple mb-2">SNAKE BATTLE</h2>
          <p className="text-space-muted mb-2 text-sm">P1: WASD | P2: Arrow keys</p>
          <p className="text-space-muted mb-6 text-sm">Last snake standing wins!</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">START BATTLE</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-xl font-orbitron text-neon-yellow mb-1">{!s1Ref.current.alive?"P2 WINS!":"P1 WINS!"}</h2>
          <p className="text-white mb-6">{scores[0]} – {scores[1]}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>
        </div>}
      </div>
    </div>
  )
}