"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

type Board = (number|0)[][]
const SIZE = 4

function empty(): Board { return Array.from({length:SIZE},()=>Array(SIZE).fill(0)) }

function addRandom(board: Board): Board {
  const b = board.map(r=>[...r])
  const cells: [number,number][] = []
  b.forEach((row,y) => row.forEach((v,x) => { if(!v) cells.push([y,x]) }))
  if(!cells.length) return b
  const [y,x] = cells[Math.floor(Math.random()*cells.length)]
  b[y][x] = Math.random()<0.9?2:4
  return b
}

function slide(row: number[]): [number[], number] {
  let score = 0
  const r = row.filter(v=>v)
  const out: number[] = []
  let i = 0
  while(i<r.length){
    if(i+1<r.length && r[i]===r[i+1]){ out.push(r[i]*2); score+=r[i]*2; i+=2 }
    else{ out.push(r[i]); i++ }
  }
  while(out.length<SIZE) out.push(0)
  return [out, score]
}

function move(board: Board, dir: string): [Board, number, boolean] {
  let b = board.map(r=>[...r])
  let total = 0, changed = false
  if(dir==="left"){ b=b.map(r=>{ const [nr,s]=slide(r); if(nr.join()!==r.join()) changed=true; total+=s; return nr }) }
  else if(dir==="right"){ b=b.map(r=>{ const rev=[...r].reverse(); const [nr,s]=slide(rev); const fin=nr.reverse(); if(fin.join()!==r.join()) changed=true; total+=s; return fin }) }
  else if(dir==="up"){
    for(let x=0;x<SIZE;x++){
      const col=b.map(r=>r[x])
      const [nc,s]=slide(col); if(nc.join()!==col.join()) changed=true; total+=s
      nc.forEach((v,y)=>b[y][x]=v)
    }
  } else {
    for(let x=0;x<SIZE;x++){
      const col=b.map(r=>r[x]).reverse()
      const [nc,s]=slide(col); const fin=nc.reverse(); if(fin.join()!==col.reverse().join()) changed=true; total+=s
      fin.forEach((v,y)=>b[y][x]=v)
    }
  }
  return [b, total, changed]
}

const COLORS: Record<number,string> = {
  0:"#0f0f2a",2:"#1e1b4b",4:"#312e81",8:"#4338ca",16:"#6d28d9",
  32:"#7c3aed",64:"#8b5cf6",128:"#a78bfa",256:"#c4b5fd",
  512:"#06b6d4",1024:"#0ea5e9",2048:"#f59e0b",
}

export default function Game2048({ onScoreUpdate, onGameOver, onGameStart, isPaused }: GameComponentProps) {
  const [board, setBoard] = useState<Board>(empty())
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<GamePhase>("start")
  const phaseRef = useRef<GamePhase>("start")
  const boardRef = useRef<Board>(empty())
  const scoreRef = useRef(0)

  const startGame = useCallback(() => {
    let b = addRandom(addRandom(empty()))
    boardRef.current = b; scoreRef.current = 0
    setBoard(b); setScore(0)
    phaseRef.current = "playing"; setPhase("playing")
    onGameStart()
  }, [onGameStart])

  const handleMove = useCallback((dir: string) => {
    if(phaseRef.current!=="playing") return
    const [nb, pts, changed] = move(boardRef.current, dir)
    if(!changed) return
    scoreRef.current += pts
    const newBoard = addRandom(nb)
    boardRef.current = newBoard
    setBoard([...newBoard.map(r=>[...r])])
    setScore(scoreRef.current)
    setBest(b => Math.max(b, scoreRef.current))
    onScoreUpdate(scoreRef.current)
    const hasMove = ["left","right","up","down"].some(d=>move(newBoard,d)[2])
    const flat = newBoard.flat()
    if(flat.includes(2048)){ phaseRef.current="gameover"; setPhase("gameover"); onGameOver(scoreRef.current) }
    else if(!hasMove){ phaseRef.current="gameover"; setPhase("gameover"); onGameOver(scoreRef.current) }
  }, [onScoreUpdate, onGameOver])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string,string> = {ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"}
      const d = map[e.code]
      if(d){ handleMove(d); e.preventDefault() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleMove])

  let startX=0, startY=0
  const onTouchStart = (e: React.TouchEvent) => { startX=e.touches[0].clientX; startY=e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx=e.changedTouches[0].clientX-startX, dy=e.changedTouches[0].clientY-startY
    if(Math.max(Math.abs(dx),Math.abs(dy))<20) return
    if(Math.abs(dx)>Math.abs(dy)) handleMove(dx>0?"right":"left")
    else handleMove(dy>0?"down":"up")
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-6 text-sm font-rajdhani">
        <div className="text-center"><div className="text-space-muted">SCORE</div><div className="text-xl text-neon-purple font-bold">{score}</div></div>
        <div className="text-center"><div className="text-space-muted">BEST</div><div className="text-xl text-neon-blue font-bold">{best}</div></div>
      </div>
      <div className="relative p-2 bg-space-surface rounded-xl border border-neon-purple/30" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="grid gap-2" style={{gridTemplateColumns:`repeat(${SIZE},1fr)`}}>
          {board.flat().map((v,i) => (
            <div key={i} className="w-16 h-16 flex items-center justify-center rounded-lg font-bold text-xl font-orbitron transition-all duration-100"
              style={{backgroundColor:COLORS[v]||"#1e1b4b",color:v>=128?"#fff":"#a78bfa",boxShadow:v>=2?"0 0 8px rgba(139,92,246,0.3)":"none"}}>
              {v||""}
            </div>
          ))}
        </div>
        {phase==="start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-xl">
            <div className="text-5xl mb-4">🔢</div>
            <h2 className="text-2xl font-orbitron text-neon-purple mb-2">2048</h2>
            <p className="text-space-muted mb-6 text-sm">Combine tiles to reach 2048!</p>
            <button onClick={startGame} className="btn-primary px-8 py-3">START GAME</button>
          </div>
        )}
        {phase==="gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-xl">
            <div className="text-4xl mb-2">🎯</div>
            <h2 className="text-xl font-orbitron text-neon-red mb-1">GAME OVER</h2>
            <p className="text-3xl font-bold text-neon-yellow mb-6">{score}</p>
            <button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>
          </div>
        )}
      </div>
      <p className="text-xs text-space-muted">Arrow keys or swipe to move tiles</p>
    </div>
  )
}