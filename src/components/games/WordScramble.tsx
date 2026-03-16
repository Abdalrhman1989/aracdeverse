"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const WORDS = [
  // easy
  {word:"PIXEL",hint:"Small screen unit"},
  {word:"LASER",hint:"Light beam weapon"},
  {word:"QUEST",hint:"An epic journey"},
  {word:"NEON",hint:"Glowing gas sign"},
  {word:"NOVA",hint:"Exploding star"},
  // medium
  {word:"GALAXY",hint:"Star system"},
  {word:"ARCADE",hint:"Game hall"},
  {word:"PORTAL",hint:"Magic doorway"},
  {word:"RETRO",hint:"Old style"},
  {word:"COSMIC",hint:"Universe scale"},
  {word:"TURBO",hint:"Extra fast"},
  {word:"VECTOR",hint:"Direction + magnitude"},
  // hard
  {word:"QUANTUM",hint:"Tiny energy packet"},
  {word:"NEBULA",hint:"Gas cloud in space"},
  {word:"PHOTON",hint:"Light particle"},
  {word:"PULSAR",hint:"Rotating neutron star"},
  {word:"WORMHOLE",hint:"Space shortcut"},
  {word:"HYPERDRIVE",hint:"FTL travel system"},
]

function scramble(word:string):string{
  let arr=word.split(""),tries=0
  while(arr.join("")===word&&tries<20){arr=arr.sort(()=>Math.random()-0.5);tries++}
  return arr.join("")
}

export default function WordScramble({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const [phase,setPhase]=useState<GamePhase>("start")
  const [currentWord,setCurrentWord]=useState({word:"",hint:"",scrambled:""})
  const [input,setInput]=useState("")
  const [score,setScore]=useState(0)
  const [timeLeft,setTimeLeft]=useState(60)
  const [feedback,setFeedback]=useState<"correct"|"wrong"|null>(null)
  const [streak,setStreak]=useState(0)
  const [wordsLeft,setWordsLeft]=useState<typeof WORDS>([])
  const timerRef=useRef<ReturnType<typeof setInterval>>()
  const scoreRef=useRef(0)
  const streakRef=useRef(0)

  function getNextWord(pool:typeof WORDS):{word:typeof WORDS[0],pool:typeof WORDS}{
    if(!pool.length) pool=[...WORDS]
    const idx=Math.floor(Math.random()*pool.length)
    const word=pool[idx]
    const newPool=[...pool.slice(0,idx),...pool.slice(idx+1)]
    return{word,pool:newPool}
  }

  const nextWord=useCallback((pool:typeof WORDS)=>{
    const{word,pool:newPool}=getNextWord(pool)
    setCurrentWord({...word,scrambled:scramble(word.word)})
    setInput("")
    setWordsLeft(newPool)
  },[])

  const startGame=useCallback(()=>{
    scoreRef.current=0;streakRef.current=0
    setScore(0);setStreak(0);setTimeLeft(60)
    const initialPool=[...WORDS]
    nextWord(initialPool)
    setPhase("playing");onGameStart()
    clearInterval(timerRef.current)
    timerRef.current=setInterval(()=>{
      setTimeLeft(t=>{
        if(t<=1){clearInterval(timerRef.current);setPhase("gameover");onGameOver(scoreRef.current);return 0}
        return t-1
      })
    },1000)
  },[nextWord,onGameStart,onGameOver])

  const checkAnswer=useCallback((val:string)=>{
    if(val.toUpperCase()===currentWord.word){
      streakRef.current++
      const pts=currentWord.word.length*10*(1+streakRef.current*0.2)|0
      scoreRef.current+=pts;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)
      setStreak(streakRef.current)
      setFeedback("correct")
      setTimeLeft(t=>Math.min(t+5,60))
      setTimeout(()=>{setFeedback(null);nextWord(wordsLeft)},500)
    } else if(val.length===currentWord.word.length){
      streakRef.current=0;setStreak(0)
      setFeedback("wrong")
      setTimeout(()=>setFeedback(null),400)
      setInput("")
    }
  },[currentWord,wordsLeft,nextWord,onScoreUpdate])

  useEffect(()=>{setInput("");checkAnswer(input)},[])

  const skipWord=()=>{streakRef.current=0;setStreak(0);nextWord(wordsLeft)}

  useEffect(()=>()=>clearInterval(timerRef.current),[])

  const letterTiles=currentWord.scrambled.split("")
  const [usedIndices,setUsedIndices]=useState<number[]>([])

  const tapLetter=(i:number)=>{
    if(usedIndices.includes(i)||phase!=="playing") return
    const newInput=input+currentWord.scrambled[i]
    setUsedIndices(p=>[...p,i])
    setInput(newInput)
    checkAnswer(newInput)
  }

  const backspace=()=>{
    if(!input.length) return
    const lastChar=input[input.length-1]
    // Remove last used index that matches this char
    const idx=[...usedIndices].reverse().find(i=>currentWord.scrambled[i]===lastChar)
    if(idx!==undefined) setUsedIndices(p=>p.filter((_,i2)=>i2!==p.lastIndexOf(idx)))
    setInput(input.slice(0,-1))
  }

  return(
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      {phase!=="start"&&<div className="flex gap-6 text-sm font-rajdhani w-full justify-center">
        <div className="text-center"><div className="text-space-muted">SCORE</div><div className="text-xl text-neon-purple font-bold">{score}</div></div>
        <div className="text-center"><div className="text-space-muted">TIME</div><div className={"text-xl font-bold "+(timeLeft<10?"text-neon-red animate-pulse":"text-neon-green")}>{timeLeft}s</div></div>
        <div className="text-center"><div className="text-space-muted">STREAK</div><div className="text-xl text-neon-orange font-bold">{streak}🔥</div></div>
      </div>}

      {phase==="start"&&<div className="text-center py-8">
        <div className="text-5xl mb-4">🔤</div>
        <h2 className="text-2xl font-orbitron text-neon-purple mb-2">WORD SCRAMBLE</h2>
        <p className="text-space-muted mb-6 text-sm">Unscramble the cosmic words before time runs out!</p>
        <button onClick={startGame} className="btn-primary px-8 py-3">START GAME</button>
      </div>}

      {phase==="playing"&&<>
        <div className={"p-4 rounded-xl border w-full text-center transition-colors "+(feedback==="correct"?"border-neon-green bg-neon-green/10":feedback==="wrong"?"border-neon-red bg-neon-red/10":"border-space-border bg-space-surface")}>
          <p className="text-space-muted text-xs mb-1">💡 {currentWord.hint}</p>
          <p className="font-orbitron text-3xl tracking-widest text-neon-blue">{currentWord.scrambled}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {letterTiles.map((letter,i)=>(
            <button key={i} onClick={()=>tapLetter(i)}
              className={"w-10 h-10 rounded-lg font-orbitron font-bold text-lg border transition-all "+(usedIndices.includes(i)?"opacity-20 cursor-not-allowed border-space-border":"border-neon-purple/50 bg-space-surface hover:bg-neon-purple/20 hover:border-neon-purple")}>
              {letter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-12 rounded-xl bg-space-surface border border-space-border flex items-center px-4">
            <span className="font-orbitron text-xl tracking-widest text-neon-purple">{input}<span className="animate-pulse text-neon-blue">|</span></span>
          </div>
          <button onClick={backspace} className="w-12 h-12 rounded-xl border border-space-border bg-space-surface hover:bg-space-card flex items-center justify-center text-lg">⌫</button>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>{setUsedIndices([]);setInput("")}} className="text-space-muted text-sm hover:text-white">Clear</button>
          <span className="text-space-border">|</span>
          <button onClick={skipWord} className="text-space-muted text-sm hover:text-neon-orange">Skip (-streak)</button>
        </div>
      </>}

      {phase==="gameover"&&<div className="text-center py-4">
        <div className="text-5xl mb-4">{score>500?"🏆":"🔤"}</div>
        <h2 className="text-xl font-orbitron text-neon-yellow mb-1">TIME UP!</h2>
        <p className="text-4xl font-bold text-neon-purple mb-2">{score}</p>
        <button onClick={startGame} className="btn-primary px-8 py-3 mt-4">PLAY AGAIN</button>
      </div>}
    </div>
  )
}