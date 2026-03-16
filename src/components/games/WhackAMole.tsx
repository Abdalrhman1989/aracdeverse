"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const HOLES=9
const MOLES=["👾","🤖","👽","💀","🐛"]

type Difficulty = 'easy'|'medium'|'hard'

const DIFFICULTY = {
  easy:   { moleTime:1400, maxMoles:2, gameTime:45 },
  medium: { moleTime:1000, maxMoles:3, gameTime:30 },
  hard:   { moleTime:650,  maxMoles:4, gameTime:25 },
}

export default function WhackAMole({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const [timeLeft,setTimeLeft]=useState(30)
  const [activeMoles,setActiveMoles]=useState<(string|null)[]>(Array(HOLES).fill(null))
  const [hit,setHit]=useState<number|null>(null)
  const [difficulty,setDifficulty]=useState<Difficulty>('medium')
  const difficultyRef=useRef<Difficulty>('medium')
  const scoreRef=useRef(0)
  const timerRef=useRef<ReturnType<typeof setInterval>>()
  const moleTimersRef=useRef<(ReturnType<typeof setTimeout>|null)[]>(Array(HOLES).fill(null))
  const activeMolesRef=useRef<(string|null)[]>(Array(HOLES).fill(null))

  const popMole=useCallback(()=>{
    const cfg=DIFFICULTY[difficultyRef.current]
    const current=activeMolesRef.current
    if(current.filter(Boolean).length>=cfg.maxMoles) return
    const available=current.map((_,i)=>i).filter(i=>!current[i])
    if(!available.length) return
    const idx=available[Math.floor(Math.random()*available.length)]
    const mole=MOLES[Math.floor(Math.random()*MOLES.length)]
    activeMolesRef.current=[...current];activeMolesRef.current[idx]=mole
    setActiveMoles(prev=>{const n=[...prev];n[idx]=mole;return n})
    moleTimersRef.current[idx]=setTimeout(()=>{
      activeMolesRef.current[idx]=null
      setActiveMoles(prev=>{const n=[...prev];n[idx]=null;return n})
    },cfg.moleTime)
  },[])

  const whack=useCallback((i:number)=>{
    if(!activeMolesRef.current[i]||phase!=="playing") return
    clearTimeout(moleTimersRef.current[i]!)
    activeMolesRef.current[i]=null
    setActiveMoles(prev=>{const n=[...prev];n[i]=null;return n})
    scoreRef.current+=10;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)
    setHit(i);setTimeout(()=>setHit(null),200)
  },[phase,onScoreUpdate])

  const startGame=useCallback((diff:Difficulty)=>{
    difficultyRef.current=diff
    const cfg=DIFFICULTY[diff]
    scoreRef.current=0;setScore(0);setTimeLeft(cfg.gameTime)
    const empty=Array(HOLES).fill(null)
    activeMolesRef.current=empty
    setActiveMoles(empty)
    setPhase("playing");onGameStart()
    clearInterval(timerRef.current)
    timerRef.current=setInterval(()=>{
      setTimeLeft(t=>{
        if(t<=1){clearInterval(timerRef.current);setPhase("gameover");onGameOver(scoreRef.current);return 0}
        return t-1
      })
    },1000)
  },[onGameStart,onGameOver])

  const goToStart=useCallback(()=>{
    clearInterval(timerRef.current)
    moleTimersRef.current.forEach(t=>t&&clearTimeout(t))
    setPhase("start")
  },[])

  useEffect(()=>{
    if(phase!=="playing") return
    const cfg=DIFFICULTY[difficultyRef.current]
    const id=setInterval(popMole,cfg.moleTime*0.6)
    return()=>clearInterval(id)
  },[phase,popMole])

  useEffect(()=>()=>{clearInterval(timerRef.current);moleTimersRef.current.forEach(t=>t&&clearTimeout(t))},[])

  return(
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      {phase!=="start"&&<div className="flex gap-8 font-rajdhani">
        <div className="text-center"><div className="text-space-muted text-sm">SCORE</div><div className="text-2xl text-neon-purple font-bold">{score}</div></div>
        <div className="text-center"><div className="text-space-muted text-sm">TIME</div><div className={"text-2xl font-bold "+(timeLeft<10?"text-neon-red animate-pulse":"text-neon-green")}>{timeLeft}s</div></div>
      </div>}
      <div className="relative w-full">
        <div className="grid grid-cols-3 gap-4 p-4 bg-space-surface rounded-2xl border border-neon-purple/20">
          {Array.from({length:HOLES}).map((_,i)=>(
            <button key={i} onClick={()=>whack(i)}
              className={"relative w-full aspect-square rounded-full border-2 text-4xl flex items-center justify-center transition-all duration-100 select-none "+(activeMoles[i]?"border-neon-yellow bg-space-bg cursor-pointer hover:scale-110 "+(hit===i?"scale-90 brightness-150":""):"border-space-border bg-space-bg/40 cursor-default")}>
              <span className={"transition-transform duration-100 "+(activeMoles[i]?"scale-100 translate-y-0":"scale-0 translate-y-4")}>
                {activeMoles[i]||""}
              </span>
              {!activeMoles[i]&&<span className="w-10 h-3 rounded-full bg-space-border absolute bottom-2" />}
            </button>
          ))}
        </div>

        {phase==="start"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-2xl px-6">
            <div className="text-5xl mb-3">🔨</div>
            <h2 className="text-2xl font-orbitron text-neon-yellow mb-1">WHACK-A-MOLE</h2>
            <p className="text-space-muted mb-5 text-sm">Tap the moles before they hide!</p>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-2xl">
            <div className="text-4xl mb-2">⏰</div>
            <h2 className="text-xl font-orbitron text-neon-yellow mb-1">TIME UP!</h2>
            <p className="text-3xl font-bold text-neon-purple mb-6">{score}</p>
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
