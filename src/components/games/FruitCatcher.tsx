"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const W=360,H=480,BASKET_W=60,BASKET_H=20
const FRUITS=["🍎","🍊","🍋","🍇","🍓","🍒","🥝","🍑"]
const BOMBS=["💣","☠️","⚡"]

type Difficulty = 'easy'|'medium'|'hard'

const DIFFICULTY = {
  easy:   { fallSpeed:2,   spawnRate:80, bombRatio:0.15, lives:5 },
  medium: { fallSpeed:3.5, spawnRate:60, bombRatio:0.25, lives:3 },
  hard:   { fallSpeed:5.5, spawnRate:40, bombRatio:0.35, lives:2 },
}

interface Item{x:number;y:number;emoji:string;vy:number;good:boolean}

export default function FruitCatcher({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const basketRef=useRef({x:W/2-BASKET_W/2})
  const itemsRef=useRef<Item[]>([])
  const scoreRef=useRef(0)
  const livesRef=useRef(3)
  const frameRef=useRef(0)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const [lives,setLives]=useState(3)
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
    for(let i=0;i<30;i++){ctx.fillStyle="rgba(255,255,255,0.4)";ctx.beginPath();ctx.arc((i*97+frameRef.current*0.2)%W,(i*53)%H,0.8,0,Math.PI*2);ctx.fill()}
    ctx.font="28px serif"
    itemsRef.current.forEach(item=>{ctx.fillText(item.emoji,item.x-14,item.y+14)})
    const b=basketRef.current
    const bg=ctx.createLinearGradient(b.x,0,b.x+BASKET_W,0)
    bg.addColorStop(0,"#8b5cf6");bg.addColorStop(1,"#06b6d4")
    ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(b.x,H-BASKET_H-10,BASKET_W,BASKET_H,6);ctx.fill()
    ctx.fillStyle="white";ctx.font="13px Orbitron,monospace";ctx.textAlign="left"
    ctx.fillText(`${scoreRef.current}`,8,22);ctx.textAlign="right"
    for(let i=0;i<livesRef.current;i++) ctx.fillText("♥",W-8-i*20,22)
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    frameRef.current++
    const b=basketRef.current
    const dir=touchRef.current
    if(keysRef.current.has("ArrowLeft")||dir==="left") b.x=Math.max(0,b.x-5)
    if(keysRef.current.has("ArrowRight")||dir==="right") b.x=Math.min(W-BASKET_W,b.x+5)
    const cfg=DIFFICULTY[difficultyRef.current]
    const baseSpeed=cfg.fallSpeed+Math.floor(scoreRef.current/200)*0.5
    if(frameRef.current%cfg.spawnRate===0){
      const good=Math.random()>cfg.bombRatio
      itemsRef.current.push({x:20+Math.random()*(W-40),y:-20,emoji:good?FRUITS[Math.floor(Math.random()*FRUITS.length)]:BOMBS[Math.floor(Math.random()*BOMBS.length)],vy:baseSpeed,good})
    }
    itemsRef.current.forEach(it=>it.y+=it.vy)
    itemsRef.current=itemsRef.current.filter(it=>{
      if(it.y>H-BASKET_H-10 && it.y<H && it.x>b.x-10 && it.x<b.x+BASKET_W+10){
        if(it.good){scoreRef.current+=10;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
        else{livesRef.current--;setLives(livesRef.current);if(livesRef.current<=0){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current)}}
        return false
      }
      if(it.y>H+20){
        if(it.good){livesRef.current--;setLives(livesRef.current);if(livesRef.current<=0){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current)}}
        return false
      }
      return true
    })
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback((diff:Difficulty)=>{
    difficultyRef.current=diff
    const cfg=DIFFICULTY[diff]
    basketRef.current={x:W/2-BASKET_W/2};itemsRef.current=[]
    scoreRef.current=0;livesRef.current=cfg.lives;frameRef.current=0
    setScore(0);setLives(cfg.lives)
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
            <div className="text-5xl mb-3">🍎</div>
            <h2 className="text-2xl font-orbitron text-neon-green mb-1">FRUIT CATCHER</h2>
            <p className="text-space-muted mb-5 text-sm">Catch fruits, avoid bombs!</p>
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
            <h2 className="text-xl font-orbitron text-neon-red mb-1">GAME OVER</h2>
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
