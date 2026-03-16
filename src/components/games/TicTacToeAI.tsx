"use client"
import { useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

type Cell = "X"|"O"|null
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWinner(b:Cell[]): Cell|"draw"|null {
  for(const [a,c,e] of WINS) if(b[a]&&b[a]===b[c]&&b[a]===b[e]) return b[a]
  if(b.every(c=>c)) return "draw"
  return null
}

function minimax(b:Cell[],isMax:boolean,depth:number): number {
  const w=checkWinner(b)
  if(w==="O") return 10-depth
  if(w==="X") return depth-10
  if(w==="draw") return 0
  if(isMax){
    let best=-Infinity
    b.forEach((_,i)=>{if(!b[i]){b[i]="O";best=Math.max(best,minimax(b,false,depth+1));b[i]=null}})
    return best
  } else {
    let best=Infinity
    b.forEach((_,i)=>{if(!b[i]){b[i]="X";best=Math.min(best,minimax(b,true,depth+1));b[i]=null}})
    return best
  }
}

function bestMove(b:Cell[]): number {
  let best=-Infinity,move=0
  b.forEach((_,i)=>{if(!b[i]){b[i]="O";const v=minimax(b,false,0);b[i]=null;if(v>best){best=v;move=i}}})
  return move
}

export default function TicTacToeAI({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const [board,setBoard]=useState<Cell[]>(Array(9).fill(null))
  const [phase,setPhase]=useState<GamePhase>("start")
  const [status,setStatus]=useState("")
  const [wins,setWins]=useState(0)
  const [losses,setLosses]=useState(0)

  const startGame=useCallback(()=>{setBoard(Array(9).fill(null));setStatus("Your turn (X)");setPhase("playing");onGameStart()},[onGameStart])

  const click=useCallback((i:number)=>{
    if(phase!=="playing"||board[i]) return
    const nb=[...board];nb[i]="X";setBoard(nb)
    const w=checkWinner(nb)
    if(w){
      if(w==="X"){setStatus("You win! 🎉");setWins(p=>p+1);onScoreUpdate(wins+1);onGameOver(wins+1)}
      else if(w==="draw"){setStatus("Draw!");onGameOver(wins)}
      setPhase("gameover");return
    }
    // AI move
    setTimeout(()=>{
      const ai=bestMove(nb);nb[ai]="O";setBoard([...nb])
      const w2=checkWinner(nb)
      if(w2){
        if(w2==="O"){setStatus("AI wins 🤖");setLosses(p=>p+1)}
        else{setStatus("Draw!")}
        setPhase("gameover");onGameOver(wins)
      } else setStatus("Your turn (X)")
    },300)
  },[board,phase,wins,onScoreUpdate,onGameOver])

  const winLine=WINS.find(([a,b,c])=>board[a]&&board[a]===board[b]&&board[a]===board[c])

  return(
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-8 font-rajdhani text-center">
        <div><div className="text-space-muted text-sm">YOU</div><div className="text-2xl text-neon-blue font-bold">{wins}</div></div>
        <div><div className="text-space-muted text-sm">AI</div><div className="text-2xl text-neon-red font-bold">{losses}</div></div>
      </div>
      <p className="text-neon-purple font-rajdhani">{status}</p>
      <div className="relative grid grid-cols-3 gap-2">
        {board.map((cell,i)=>(
          <button key={i} onClick={()=>click(i)}
            className={"w-20 h-20 rounded-xl border text-4xl font-bold flex items-center justify-center transition-all duration-200 "+(cell?"cursor-default border-neon-purple/40":phase==="playing"?"cursor-pointer border-space-border hover:border-neon-purple/60 hover:bg-space-surface":"border-space-border cursor-default")+(winLine?.includes(i)?" bg-neon-purple/20 border-neon-purple":"")}>
            <span className={cell==="X"?"text-neon-blue":cell==="O"?"text-neon-red":""}>
              {cell==="X"?"✕":cell==="O"?"○":""}
            </span>
          </button>
        ))}
      </div>
      {phase==="start"&&<div className="text-center">
        <div className="text-5xl mb-4">❎</div>
        <h2 className="text-xl font-orbitron text-neon-purple mb-4">TIC TAC TOE vs AI</h2>
        <button onClick={startGame} className="btn-primary px-8 py-3">START GAME</button>
      </div>}
      {phase==="gameover"&&<button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>}
    </div>
  )
}