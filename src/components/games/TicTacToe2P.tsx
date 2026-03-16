"use client"
import { useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

type Cell = "X"|"O"|null
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWin(b:Cell[]): Cell|"draw"|null {
  for(const [a,c,e] of WINS) if(b[a]&&b[a]===b[c]&&b[a]===b[e]) return b[a]
  if(b.every(c=>c)) return "draw"
  return null
}

export default function TicTacToe2P({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const [board,setBoard]=useState<Cell[]>(Array(9).fill(null))
  const [turn,setTurn]=useState<"X"|"O">("X")
  const [phase,setPhase]=useState<GamePhase>("start")
  const [result,setResult]=useState("")
  const [scores,setScores]=useState({X:0,O:0})

  const startGame=useCallback(()=>{setBoard(Array(9).fill(null));setTurn("X");setResult("");setPhase("playing");onGameStart()},[onGameStart])

  const click=useCallback((i:number)=>{
    if(phase!=="playing"||board[i]) return
    const nb=[...board];nb[i]=turn;setBoard(nb)
    const w=checkWin(nb)
    if(w){
      if(w==="draw"){setResult("It's a Draw!");onGameOver(0)}
      else{setScores(s=>({...s,[w]:s[w]+1}));setResult(`Player ${w} wins! 🏆`);onScoreUpdate(scores[w]+1);onGameOver(scores[w]+1)}
      setPhase("gameover")
    } else setTurn(t=>t==="X"?"O":"X")
  },[board,phase,turn,scores,onScoreUpdate,onGameOver])

  const winLine=WINS.find(([a,b,c])=>board[a]&&board[a]===board[b]&&board[a]===board[c])

  return(
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-12 font-rajdhani text-center">
        <div><div className="text-neon-blue text-sm">PLAYER 1 (X)</div><div className="text-2xl font-bold text-neon-blue">{scores.X}</div></div>
        <div><div className="text-neon-red text-sm">PLAYER 2 (O)</div><div className="text-2xl font-bold text-neon-red">{scores.O}</div></div>
      </div>
      {phase==="playing"&&<p className={"font-rajdhani text-lg "+(turn==="X"?"text-neon-blue":"text-neon-red")}>Player {turn}&apos;s turn</p>}
      {phase==="gameover"&&<p className="font-orbitron text-neon-yellow text-lg">{result}</p>}
      <div className="grid grid-cols-3 gap-2">
        {board.map((cell,i)=>(
          <button key={i} onClick={()=>click(i)}
            className={"w-24 h-24 rounded-xl border text-5xl font-bold flex items-center justify-center transition-all "+(winLine?.includes(i)?"bg-neon-purple/20 border-neon-purple":cell?"border-neon-purple/40":phase==="playing"?"border-space-border hover:border-neon-purple/50 hover:bg-space-surface cursor-pointer":"border-space-border")}>
            <span className={cell==="X"?"text-neon-blue":cell==="O"?"text-neon-red":""}>
              {cell==="X"?"✕":cell==="O"?"○":""}
            </span>
          </button>
        ))}
      </div>
      {phase==="start"&&<div className="text-center">
        <div className="text-5xl mb-4">🎮</div>
        <h2 className="text-2xl font-orbitron text-neon-purple mb-2">TIC TAC TOE 2P</h2>
        <p className="text-space-muted mb-6 text-sm">2 players on same device</p>
        <button onClick={startGame} className="btn-primary px-8 py-3">START MATCH</button>
      </div>}
      {phase==="gameover"&&<button onClick={startGame} className="btn-primary px-8 py-3">NEXT ROUND</button>}
    </div>
  )
}