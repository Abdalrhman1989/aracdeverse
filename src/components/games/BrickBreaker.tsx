"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const W=400,H=500,PADDLE_W=80,PADDLE_H=12,BALL_R=8
const BRICK_COLS=8,BRICK_W=42,BRICK_H=18,BRICK_PAD=4,BRICK_OFF_X=12,BRICK_OFF_Y=50

type Difficulty = 'easy'|'medium'|'hard'

const DIFFICULTY = {
  easy:   { ballSpeed:3,   brickRows:4, brickHP:1 },
  medium: { ballSpeed:4.5, brickRows:6, brickHP:1 },
  hard:   { ballSpeed:6,   brickRows:6, brickHP:2 },
}

interface Brick{x:number;y:number;hp:number;maxHp:number;color:string;alive:boolean}
interface Ball{x:number;y:number;vx:number;vy:number}

const COLORS=["#ef4444","#f97316","#fbbf24","#10b981","#06b6d4","#8b5cf6"]

export default function BrickBreaker({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const paddleRef=useRef({x:W/2-PADDLE_W/2})
  const ballRef=useRef<Ball>({x:W/2,y:H-80,vx:3,vy:-4})
  const bricksRef=useRef<Brick[]>([])
  const scoreRef=useRef(0)
  const livesRef=useRef(3)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const [lives,setLives]=useState(3)
  const [difficulty,setDifficulty]=useState<Difficulty>('medium')
  const difficultyRef=useRef<Difficulty>('medium')
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const mouseRef=useRef(W/2)
  const keysRef=useRef<Set<string>>(new Set())

  function initBricks(diff:Difficulty){
    const cfg=DIFFICULTY[diff]
    const b:Brick[]=[]
    for(let r=0;r<cfg.brickRows;r++) for(let c=0;c<BRICK_COLS;c++){
      const hp=cfg.brickHP
      b.push({x:BRICK_OFF_X+c*(BRICK_W+BRICK_PAD),y:BRICK_OFF_Y+r*(BRICK_H+BRICK_PAD),hp,maxHp:hp,color:COLORS[r%COLORS.length],alive:true})
    }
    return b
  }

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext("2d")!
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    ctx.strokeStyle="rgba(139,92,246,0.06)";ctx.lineWidth=0.5
    for(let x=0;x<W;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    bricksRef.current.filter(b=>b.alive).forEach(b=>{
      // Darken color for damaged 2-hp bricks
      if(b.maxHp>1 && b.hp===1){
        ctx.fillStyle="#555"
      } else {
        ctx.fillStyle=b.color
      }
      ctx.beginPath();ctx.roundRect(b.x,b.y,BRICK_W,BRICK_H,4);ctx.fill()
      if(b.hp>1){ctx.fillStyle="rgba(255,255,255,0.4)";ctx.fillRect(b.x+4,b.y+2,BRICK_W-8,3)}
    })
    const pg=ctx.createLinearGradient(paddleRef.current.x,0,paddleRef.current.x+PADDLE_W,0)
    pg.addColorStop(0,"#8b5cf6");pg.addColorStop(1,"#06b6d4")
    ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(paddleRef.current.x,H-PADDLE_H-10,PADDLE_W,PADDLE_H,6);ctx.fill()
    const bg=ctx.createRadialGradient(ballRef.current.x,ballRef.current.y,1,ballRef.current.x,ballRef.current.y,BALL_R)
    bg.addColorStop(0,"#fff");bg.addColorStop(1,"#8b5cf6")
    ctx.fillStyle=bg;ctx.beginPath();ctx.arc(ballRef.current.x,ballRef.current.y,BALL_R,0,Math.PI*2);ctx.fill()
    ctx.fillStyle="white";ctx.font="13px Orbitron,monospace";ctx.textAlign="left"
    ctx.fillText(`${scoreRef.current}`,8,20);ctx.textAlign="right"
    ctx.fillText(`♥ ${livesRef.current}`,W-8,20)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    const b=ballRef.current,p=paddleRef.current
    if(keysRef.current.has("ArrowLeft")) p.x=Math.max(0,p.x-5)
    if(keysRef.current.has("ArrowRight")) p.x=Math.min(W-PADDLE_W,p.x+5)
    else p.x=Math.max(0,Math.min(W-PADDLE_W,mouseRef.current-PADDLE_W/2))
    b.x+=b.vx;b.y+=b.vy
    if(b.x-BALL_R<=0){b.x=BALL_R;b.vx=Math.abs(b.vx)}
    if(b.x+BALL_R>=W){b.x=W-BALL_R;b.vx=-Math.abs(b.vx)}
    if(b.y-BALL_R<=0){b.y=BALL_R;b.vy=Math.abs(b.vy)}
    if(b.y+BALL_R>=H-PADDLE_H-10 && b.y+BALL_R<=H-5 && b.x>=p.x && b.x<=p.x+PADDLE_W){
      b.vy=-Math.abs(b.vy)
      b.vx=((b.x-(p.x+PADDLE_W/2))/(PADDLE_W/2))*4
    }
    bricksRef.current.filter(br=>br.alive).forEach(br=>{
      if(b.x+BALL_R>br.x && b.x-BALL_R<br.x+BRICK_W && b.y+BALL_R>br.y && b.y-BALL_R<br.y+BRICK_H){
        br.hp--
        if(br.hp<=0){br.alive=false;scoreRef.current+=(br.y<100?200:100);setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
        b.vy*=-1
      }
    })
    if(b.y>H+20){
      livesRef.current--;setLives(livesRef.current)
      if(livesRef.current<=0){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return}
      const cfg=DIFFICULTY[difficultyRef.current]
      const spd=cfg.ballSpeed
      b.x=W/2;b.y=H-80;b.vx=spd*(Math.random()<0.5?0.6:-0.6);b.vy=-spd
    }
    if(!bricksRef.current.some(br=>br.alive)){
      bricksRef.current=initBricks(difficultyRef.current);scoreRef.current+=500;b.vy-=0.3
    }
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback((diff:Difficulty)=>{
    difficultyRef.current=diff
    const cfg=DIFFICULTY[diff]
    const spd=cfg.ballSpeed
    paddleRef.current={x:W/2-PADDLE_W/2}
    ballRef.current={x:W/2,y:H-80,vx:spd*0.6,vy:-spd}
    bricksRef.current=initBricks(diff)
    scoreRef.current=0;livesRef.current=3
    setScore(0);setLives(3)
    phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!)
    rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart])

  const goToStart=useCallback(()=>{
    phaseRef.current="start";setPhase("start")
    cancelAnimationFrame(rafRef.current!)
    draw()
  },[draw])

  useEffect(()=>{
    const onMouse=(e:MouseEvent)=>{const r=canvasRef.current!.getBoundingClientRect();mouseRef.current=e.clientX-r.left}
    const onKey=(e:KeyboardEvent)=>{keysRef.current.add(e.code);e.preventDefault()}
    const offKey=(e:KeyboardEvent)=>keysRef.current.delete(e.code)
    const canvas=canvasRef.current
    canvas?.addEventListener("mousemove",onMouse)
    window.addEventListener("keydown",onKey);window.addEventListener("keyup",offKey)
    draw()
    return()=>{canvas?.removeEventListener("mousemove",onMouse);window.removeEventListener("keydown",onKey);window.removeEventListener("keyup",offKey);cancelAnimationFrame(rafRef.current!)}
  },[draw])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 max-h-[65vh]" />

        {phase==="start"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg px-6">
            <div className="text-5xl mb-3">🧱</div>
            <h2 className="text-2xl font-orbitron text-neon-orange mb-1">BRICK BREAKER</h2>
            <p className="text-space-muted mb-5 text-sm">Move mouse or arrow keys</p>
            <p className="text-space-muted text-xs uppercase tracking-widest mb-3">Select Difficulty</p>
            <div className="flex gap-3 mb-2">
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
            <h2 className="text-xl font-orbitron text-neon-red mb-1">GAME OVER</h2>
            <p className="text-3xl font-bold text-neon-yellow mb-6">{score}</p>
            <div className="flex gap-3">
              <button onClick={()=>startGame(difficulty)} className="btn-primary px-6 py-3">RETRY</button>
              <button onClick={goToStart} className="px-6 py-3 rounded-lg font-orbitron text-sm border-2 border-space-border text-space-muted hover:border-neon-purple/50 hover:text-white transition-all">CHANGE DIFFICULTY</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
