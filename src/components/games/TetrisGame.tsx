"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const COLS = 10
const ROWS = 20
const CELL = 28

const PIECES = [
  { shape: [[1,1,1,1]], color: "#06b6d4" },        // I
  { shape: [[1,1],[1,1]], color: "#fbbf24" },       // O
  { shape: [[0,1,0],[1,1,1]], color: "#8b5cf6" },   // T
  { shape: [[1,0],[1,1],[0,1]], color: "#10b981" },  // S
  { shape: [[0,1],[1,1],[1,0]], color: "#ef4444" },  // Z
  { shape: [[1,0],[1,0],[1,1]], color: "#f97316" },  // J
  { shape: [[0,1],[0,1],[1,1]], color: "#3b82f6" },  // L
]

interface Piece { shape: number[][], color: string, x: number, y: number }

function randomPiece(): Piece {
  const p = PIECES[Math.floor(Math.random()*PIECES.length)]
  return { ...p, x: Math.floor((COLS - p.shape[0].length)/2), y: 0 }
}

function rotate(shape: number[][]): number[][] {
  return shape[0].map((_,i) => shape.map(row => row[i]).reverse())
}

export default function TetrisGame({ onScoreUpdate, onGameOver, onGameStart, isPaused }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<(string|null)[][]>(Array.from({length:ROWS},()=>Array(COLS).fill(null)))
  const pieceRef = useRef<Piece>(randomPiece())
  const nextRef = useRef<Piece>(randomPiece())
  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const linesRef = useRef(0)
  const [phase, setPhase] = useState<GamePhase>("start")
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const phaseRef = useRef<GamePhase>("start")
  const loopRef = useRef<ReturnType<typeof setTimeout>>()

  const valid = useCallback((piece: Piece, board: (string|null)[][]) => {
    return piece.shape.every((row,dy) => row.every((cell,dx) => {
      if(!cell) return true
      const nx = piece.x+dx, ny = piece.y+dy
      return nx>=0 && nx<COLS && ny<ROWS && !board[ny]?.[nx]
    }))
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if(!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#03030a"
    ctx.fillRect(0,0,canvas.width,canvas.height)
    // Grid lines
    ctx.strokeStyle = "rgba(139,92,246,0.08)"
    ctx.lineWidth = 0.5
    for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,ROWS*CELL);ctx.stroke()}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(COLS*CELL,y*CELL);ctx.stroke()}
    // Board
    boardRef.current.forEach((row,y) => row.forEach((cell,x) => {
      if(cell){
        ctx.fillStyle = cell
        ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2)
        ctx.fillStyle = "rgba(255,255,255,0.3)"
        ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,4)
      }
    }))
    // Ghost piece
    const ghost = {...pieceRef.current}
    while(valid({...ghost,y:ghost.y+1},boardRef.current)) ghost.y++
    ghost.shape.forEach((row,dy) => row.forEach((cell,dx) => {
      if(cell){
        ctx.fillStyle = "rgba(255,255,255,0.1)"
        ctx.fillRect((ghost.x+dx)*CELL+1,(ghost.y+dy)*CELL+1,CELL-2,CELL-2)
      }
    }))
    // Active piece
    const p = pieceRef.current
    p.shape.forEach((row,dy) => row.forEach((cell,dx) => {
      if(cell){
        ctx.fillStyle = p.color
        ctx.fillRect((p.x+dx)*CELL+1,(p.y+dy)*CELL+1,CELL-2,CELL-2)
        ctx.fillStyle = "rgba(255,255,255,0.4)"
        ctx.fillRect((p.x+dx)*CELL+1,(p.y+dy)*CELL+1,CELL-2,4)
      }
    }))
  }, [valid])

  const lockPiece = useCallback(() => {
    const p = pieceRef.current
    p.shape.forEach((row,dy) => row.forEach((cell,dx) => {
      if(cell) boardRef.current[p.y+dy][p.x+dx] = p.color
    }))
    // Clear lines
    let cleared = 0
    boardRef.current = boardRef.current.filter(row => {
      if(row.every(c=>c)){ cleared++; return false }
      return true
    })
    while(boardRef.current.length < ROWS) boardRef.current.unshift(Array(COLS).fill(null))
    const points = [0,100,300,500,800][cleared] * levelRef.current
    scoreRef.current += points
    linesRef.current += cleared
    levelRef.current = 1 + Math.floor(linesRef.current/10)
    setScore(scoreRef.current)
    setLevel(levelRef.current)
    onScoreUpdate(scoreRef.current)
    pieceRef.current = nextRef.current
    nextRef.current = randomPiece()
    if(!valid(pieceRef.current, boardRef.current)){
      phaseRef.current = "gameover"
      setPhase("gameover")
      onGameOver(scoreRef.current)
    }
  }, [valid, onScoreUpdate, onGameOver])

  const tick = useCallback(() => {
    if(phaseRef.current !== "playing") return
    const p = pieceRef.current
    if(valid({...p,y:p.y+1},boardRef.current)){
      pieceRef.current = {...p,y:p.y+1}
    } else {
      lockPiece()
    }
    draw()
    const speed = Math.max(100, 500 - (levelRef.current-1)*40)
    loopRef.current = setTimeout(tick, speed)
  }, [valid, lockPiece, draw])

  const startGame = useCallback(() => {
    boardRef.current = Array.from({length:ROWS},()=>Array(COLS).fill(null))
    pieceRef.current = randomPiece()
    nextRef.current = randomPiece()
    scoreRef.current = 0; levelRef.current = 1; linesRef.current = 0
    setScore(0); setLevel(1)
    phaseRef.current = "playing"; setPhase("playing")
    onGameStart()
    clearTimeout(loopRef.current)
    loopRef.current = setTimeout(tick, 500)
  }, [tick, onGameStart])

  useEffect(() => {
    if(isPaused && phaseRef.current==="playing"){ phaseRef.current="paused"; setPhase("paused"); clearTimeout(loopRef.current) }
    else if(!isPaused && phaseRef.current==="paused"){ phaseRef.current="playing"; setPhase("playing"); loopRef.current=setTimeout(tick,500) }
  }, [isPaused, tick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if(phaseRef.current!=="playing") return
      const p = pieceRef.current
      if(e.code==="ArrowLeft" && valid({...p,x:p.x-1},boardRef.current)){ pieceRef.current={...p,x:p.x-1}; draw(); e.preventDefault() }
      else if(e.code==="ArrowRight" && valid({...p,x:p.x+1},boardRef.current)){ pieceRef.current={...p,x:p.x+1}; draw(); e.preventDefault() }
      else if(e.code==="ArrowDown"){ clearTimeout(loopRef.current); tick(); e.preventDefault() }
      else if(e.code==="ArrowUp"||e.code==="KeyX"){
        const rot = rotate(p.shape)
        if(valid({...p,shape:rot},boardRef.current)){ pieceRef.current={...p,shape:rot}; draw() }
        e.preventDefault()
      } else if(e.code==="Space"){
        while(valid({...pieceRef.current,y:pieceRef.current.y+1},boardRef.current)) pieceRef.current={...pieceRef.current,y:pieceRef.current.y+1}
        clearTimeout(loopRef.current); tick()
        e.preventDefault()
      }
    }
    window.addEventListener("keydown",onKey)
    draw()
    return () => { window.removeEventListener("keydown",onKey); clearTimeout(loopRef.current) }
  }, [draw, tick, valid])

  const handleTouch = useCallback((dir: string) => {
    if(phaseRef.current!=="playing") return
    const p = pieceRef.current
    if(dir==="left" && valid({...p,x:p.x-1},boardRef.current)){ pieceRef.current={...p,x:p.x-1}; draw() }
    else if(dir==="right" && valid({...p,x:p.x+1},boardRef.current)){ pieceRef.current={...p,x:p.x+1}; draw() }
    else if(dir==="down"){ clearTimeout(loopRef.current); tick() }
    else if(dir==="up"){ const rot=rotate(p.shape); if(valid({...p,shape:rot},boardRef.current)){ pieceRef.current={...p,shape:rot}; draw() } }
  }, [draw, tick, valid])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-6 text-sm font-rajdhani">
        <div className="text-center"><div className="text-space-muted">SCORE</div><div className="text-xl text-neon-purple font-bold">{score}</div></div>
        <div className="text-center"><div className="text-space-muted">LEVEL</div><div className="text-xl text-neon-blue font-bold">{level}</div></div>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL} className="rounded-lg border border-neon-purple/30" />
        {phase==="start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
            <div className="text-5xl mb-4">🧩</div>
            <h2 className="text-2xl font-orbitron text-neon-purple mb-2">TETRIS</h2>
            <p className="text-space-muted mb-6 text-sm text-center px-4">Arrow keys to move · Up/X to rotate · Space to drop</p>
            <button onClick={startGame} className="btn-primary px-8 py-3">START GAME</button>
          </div>
        )}
        {phase==="gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
            <div className="text-4xl mb-2">💀</div>
            <h2 className="text-xl font-orbitron text-neon-red mb-1">GAME OVER</h2>
            <p className="text-3xl font-bold text-neon-yellow mb-6">{score}</p>
            <button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>
          </div>
        )}
        {phase==="paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-space-bg/80 rounded-lg">
            <span className="text-3xl font-orbitron text-neon-blue">PAUSED</span>
          </div>
        )}
      </div>
      <TouchControls mode="dpad" onDirection={handleTouch} />
    </div>
  )
}