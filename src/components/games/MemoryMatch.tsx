"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const EMOJIS = ["🚀","🌟","💎","🎮","🔥","⚡","🌈","🎯","👾","🤖","🎲","🃏","🦄","🐉","🍄","🔮","🎪","🧩","🏆","🎸","🦊","🌊","🎭","🍀"]

type Difficulty = 'easy'|'medium'|'hard'

const DIFFICULTY = {
  easy:   { cols:4, rows:3, timeLimit:120, pairs:6  },
  medium: { cols:4, rows:4, timeLimit:60,  pairs:8  },
  hard:   { cols:6, rows:4, timeLimit:45,  pairs:12 },
}

interface Card{id:number;emoji:string;flipped:boolean;matched:boolean}

export default function MemoryMatch({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const [cards,setCards]=useState<Card[]>([])
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const [moves,setMoves]=useState(0)
  const [flippedIds,setFlippedIds]=useState<number[]>([])
  const [timeLeft,setTimeLeft]=useState(60)
  const [difficulty,setDifficulty]=useState<Difficulty>('medium')
  const difficultyRef=useRef<Difficulty>('medium')
  const timerRef=useRef<ReturnType<typeof setInterval>>()
  const scoreRef=useRef(0)
  const lockedRef=useRef(false)
  const timeLeftRef=useRef(60)

  const startGame=useCallback((diff:Difficulty)=>{
    difficultyRef.current=diff
    const cfg=DIFFICULTY[diff]
    const pool=EMOJIS.slice(0,cfg.pairs)
    const shuffled=[...pool,...pool].sort(()=>Math.random()-0.5)
    const newCards=shuffled.map((emoji,i)=>({id:i,emoji,flipped:false,matched:false}))
    setCards(newCards);setScore(0);setMoves(0);setFlippedIds([])
    setTimeLeft(cfg.timeLimit);timeLeftRef.current=cfg.timeLimit
    scoreRef.current=0;lockedRef.current=false
    setPhase("playing");onGameStart()
    clearInterval(timerRef.current)
    timerRef.current=setInterval(()=>{
      setTimeLeft(t=>{
        timeLeftRef.current=t-1
        if(t<=1){clearInterval(timerRef.current);setPhase("gameover");onGameOver(scoreRef.current);return 0}
        return t-1
      })
    },1000)
  },[onGameStart,onGameOver])

  const goToStart=useCallback(()=>{
    clearInterval(timerRef.current)
    setPhase("start")
  },[])

  const flip=useCallback((card:Card)=>{
    if(lockedRef.current||card.flipped||card.matched||phase!=="playing") return
    setCards(prev=>prev.map(c=>c.id===card.id?{...c,flipped:true}:c))
    setFlippedIds(prev=>{
      const next=[...prev,card.id]
      if(next.length===2){
        lockedRef.current=true
        setTimeout(()=>{
          setCards(all=>{
            const [a,b]=next.map(id=>all.find(c=>c.id===id)!)
            if(a.emoji===b.emoji){
              const pts=timeLeftRef.current*2
              scoreRef.current+=pts
              setScore(scoreRef.current)
              onScoreUpdate(scoreRef.current)
              const updated=all.map(c=>next.includes(c.id)?{...c,matched:true}:c)
              if(updated.every(c=>c.matched)){
                clearInterval(timerRef.current)
                setPhase("gameover");onGameOver(scoreRef.current)
              }
              lockedRef.current=false
              return updated
            } else {
              const updated=all.map(c=>next.includes(c.id)?{...c,flipped:false}:c)
              lockedRef.current=false
              return updated
            }
          })
          setMoves(m=>m+1)
          setFlippedIds([])
        },600)
      }
      return next
    })
  },[phase,onScoreUpdate,onGameOver])

  useEffect(()=>()=>clearInterval(timerRef.current),[])

  const cfg=DIFFICULTY[difficulty]

  return(
    <div className="flex flex-col items-center gap-4 w-full max-w-lg">
      {phase!=="start"&&<div className="flex gap-6 text-sm font-rajdhani w-full justify-center">
        <div className="text-center"><div className="text-space-muted">SCORE</div><div className="text-xl text-neon-purple font-bold">{score}</div></div>
        <div className="text-center"><div className="text-space-muted">MOVES</div><div className="text-xl text-neon-blue font-bold">{moves}</div></div>
        <div className="text-center"><div className="text-space-muted">TIME</div><div className={"text-xl font-bold "+(timeLeft<10?"text-neon-red":"text-neon-green")}>{timeLeft}s</div></div>
      </div>}
      <div className="relative w-full">
        <div
          className="grid gap-2 p-2"
          style={{gridTemplateColumns:`repeat(${DIFFICULTY[difficultyRef.current].cols},minmax(0,1fr))`}}>
          {cards.map(card=>(
            <button key={card.id} onClick={()=>flip(card)}
              className={"w-full aspect-square rounded-lg text-xl flex items-center justify-center transition-all duration-300 border "+(card.matched?"border-neon-green/50 bg-neon-green/10 opacity-50":card.flipped?"border-neon-purple/60 bg-space-surface":"border-space-border bg-space-surface hover:border-neon-purple/40 cursor-pointer")}>
              {(card.flipped||card.matched)?card.emoji:""}
            </button>
          ))}
        </div>

        {phase==="start"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg p-4">
            <div className="text-5xl mb-3">🧠</div>
            <h2 className="text-2xl font-orbitron text-neon-purple mb-1">MEMORY MATCH</h2>
            <p className="text-space-muted mb-5 text-sm text-center">Find all pairs before time runs out!</p>
            <p className="text-space-muted text-xs uppercase tracking-widest mb-3">Select Difficulty</p>
            <div className="flex gap-3 mb-3">
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
            <div className="flex gap-4 text-xs text-space-muted">
              <span className="text-green-400">Easy: 4x3 · 120s</span>
              <span className="text-purple-400">Med: 4x4 · 60s</span>
              <span className="text-red-400">Hard: 6x4 · 45s</span>
            </div>
          </div>
        )}

        {phase==="gameover"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
            <div className="text-4xl mb-2">{score>200?"🏆":"😅"}</div>
            <h2 className="text-xl font-orbitron text-neon-yellow mb-1">GAME OVER</h2>
            <p className="text-3xl font-bold text-neon-purple mb-1">{score}</p>
            <p className="text-space-muted text-sm mb-6">{moves} moves</p>
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
