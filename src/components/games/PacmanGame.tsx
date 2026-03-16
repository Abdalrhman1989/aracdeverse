"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const CELL=18
// Simplified Pacman maze: 0=empty/dot, 1=wall, 2=power pellet, 3=empty no dot
const MAZE_RAW = [
  "1111111111111111111",
  "1000000001000000001",
  "1011101101011101101",
  "1211101101011101121",
  "1011101101011101101",
  "1000000000000000001",
  "1011011110111011101",
  "1001100003001100101",
  "1111011113011101111",
  "3333013333310133333",
  "1111011111011101111",
  "1003330003000333001",
  "1011011110111011101",
  "1000000000000000001",
  "1011101101011101101",
  "1211101101011101121",
  "1001100001000110001",
  "1011011111111011101",
  "1000000001000000001",
  "1111111111111111111",
]

const COLS=MAZE_RAW[0].length
const ROWS=MAZE_RAW.length
const W=COLS*CELL,H=ROWS*CELL

function parseMaze(){
  return MAZE_RAW.map(row=>row.split("").map(c=>parseInt(c)))
}

interface Ghost{x:number;y:number;dir:{x:number;y:number};scared:boolean;eaten:boolean;color:string}

export default function PacmanGame({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const mazeRef=useRef(parseMaze())
  const pacRef=useRef({x:9,y:14,dir:{x:0,y:0},nextDir:{x:0,y:0},mouth:0,mouthDir:1})
  const ghostsRef=useRef<Ghost[]>([
    {x:9,y:9,dir:{x:1,y:0},scared:false,eaten:false,color:"#ef4444"},
    {x:10,y:9,dir:{x:-1,y:0},scared:false,eaten:false,color:"#f97316"},
    {x:9,y:10,dir:{x:0,y:1},scared:false,eaten:false,color:"#ec4899"},
    {x:10,y:10,dir:{x:0,y:-1},scared:false,eaten:false,color:"#06b6d4"},
  ])
  const scoreRef=useRef(0)
  const livesRef=useRef(3)
  const scaredTimerRef=useRef(0)
  const frameRef=useRef(0)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const [lives,setLives]=useState(3)
  const phaseRef=useRef<GamePhase>("start")
  const loopRef=useRef<ReturnType<typeof setTimeout>>()

  function canMove(maze:number[][],x:number,y:number){
    if(y<0||y>=ROWS||x<0||x>=COLS) return false
    return maze[y][x]!==1
  }

  function pickGhostDir(ghost:Ghost,maze:number[][],pac:{x:number;y:number}){
    const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]
    const valid=dirs.filter(d=>{
      const nx=ghost.x+d.x,ny=ghost.y+d.y
      return canMove(maze,nx,ny)&&!(d.x===-ghost.dir.x&&d.y===-ghost.dir.y)
    })
    if(!valid.length) return {x:-ghost.dir.x,y:-ghost.dir.y}
    if(ghost.scared) return valid[Math.floor(Math.random()*valid.length)]
    // Chase pacman
    valid.sort((a,b)=>{
      const da=Math.abs(ghost.x+a.x-pac.x)+Math.abs(ghost.y+a.y-pac.y)
      const db=Math.abs(ghost.x+b.x-pac.x)+Math.abs(ghost.y+b.y-pac.y)
      return da-db
    })
    return valid[0]
  }

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!;const maze=mazeRef.current
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    // Maze
    maze.forEach((row,y)=>row.forEach((cell,x)=>{
      if(cell===1){
        const g=ctx.createLinearGradient(x*CELL,y*CELL,x*CELL+CELL,y*CELL+CELL)
        g.addColorStop(0,"#1e1b4b");g.addColorStop(1,"#312e81")
        ctx.fillStyle=g;ctx.fillRect(x*CELL,y*CELL,CELL,CELL)
        ctx.strokeStyle="#4338ca";ctx.lineWidth=0.5;ctx.strokeRect(x*CELL,y*CELL,CELL,CELL)
      } else if(cell===0){
        ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(x*CELL+CELL/2,y*CELL+CELL/2,2,0,Math.PI*2);ctx.fill()
      } else if(cell===2){
        const pulse=0.6+0.4*Math.sin(frameRef.current*0.15)
        ctx.fillStyle=`rgba(251,191,36,${pulse})`;ctx.beginPath();ctx.arc(x*CELL+CELL/2,y*CELL+CELL/2,5,0,Math.PI*2);ctx.fill()
      }
    }))
    // Ghosts
    ghostsRef.current.forEach(g=>{
      if(g.eaten) return
      ctx.fillStyle=g.scared?"#06b6d4":g.color
      const gx=g.x*CELL+CELL/2,gy=g.y*CELL+CELL/2
      ctx.beginPath();ctx.arc(gx,gy-2,CELL/2-1,Math.PI,0);ctx.lineTo(gx+CELL/2-1,gy+5)
      for(let i=0;i<3;i++) ctx.arc(gx+CELL/2-1-(i+0.5)*(CELL-2)/3,gy+5,3,0,Math.PI)
      ctx.closePath();ctx.fill()
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(gx-3,gy-2,3,0,Math.PI*2);ctx.fill()
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(gx+3,gy-2,3,0,Math.PI*2);ctx.fill()
      ctx.fillStyle=g.scared?"#fff":"#1e40af";ctx.beginPath();ctx.arc(gx-3,gy-2,1.5,0,Math.PI*2);ctx.fill()
      ctx.fillStyle=g.scared?"#fff":"#1e40af";ctx.beginPath();ctx.arc(gx+3,gy-2,1.5,0,Math.PI*2);ctx.fill()
    })
    // Pacman
    const pac=pacRef.current
    const px=pac.x*CELL+CELL/2,py=pac.y*CELL+CELL/2
    const baseAngle=pac.dir.x===1?0:pac.dir.x===-1?Math.PI:pac.dir.y===1?Math.PI/2:pac.dir.y===-1?-Math.PI/2:0
    const mouthAngle=pac.mouth*(Math.PI/6)
    ctx.fillStyle="#fbbf24"
    ctx.beginPath();ctx.moveTo(px,py)
    ctx.arc(px,py,CELL/2-1,baseAngle+mouthAngle,baseAngle+2*Math.PI-mouthAngle)
    ctx.closePath();ctx.fill()
    // HUD
    ctx.fillStyle="white";ctx.font="12px Orbitron,monospace";ctx.textAlign="left"
    ctx.fillText(`${scoreRef.current}`,6,14)
    for(let i=0;i<livesRef.current;i++){
      ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(W-16-i*20,10,5,0.3,Math.PI*2-0.3);ctx.closePath();ctx.fill()
    }
  },[])

  const tick=useCallback(()=>{
    if(phaseRef.current!=="playing") return
    frameRef.current++
    const pac=pacRef.current;const maze=mazeRef.current
    // Pacman mouth animation
    pac.mouth+=0.15*pac.mouthDir
    if(pac.mouth>1||pac.mouth<0.05) pac.mouthDir*=-1
    // Try next dir first, then current dir
    const tryMove=(dir:{x:number;y:number})=>{
      const nx=pac.x+dir.x,ny=pac.y+dir.y
      return canMove(maze,nx,ny)?{x:nx,y:ny}:null
    }
    let moved=tryMove(pac.nextDir)
    if(moved){pac.x=moved.x;pac.y=moved.y;pac.dir=pac.nextDir}
    else{moved=tryMove(pac.dir);if(moved){pac.x=moved.x;pac.y=moved.y}}
    // Eat dot/power pellet
    const cell=maze[pac.y][pac.x]
    if(cell===0){maze[pac.y][pac.x]=3;scoreRef.current+=10;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
    else if(cell===2){
      maze[pac.y][pac.x]=3;scoreRef.current+=50;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)
      ghostsRef.current.forEach(g=>g.scared=true);scaredTimerRef.current=8000
    }
    // Scared timer
    if(scaredTimerRef.current>0){scaredTimerRef.current-=100;if(scaredTimerRef.current<=0) ghostsRef.current.forEach(g=>g.scared=false)}
    // Move ghosts every other tick
    if(frameRef.current%2===0){
      ghostsRef.current.forEach(g=>{
        if(g.eaten) return
        const newDir=pickGhostDir(g,maze,pac)
        const nx=g.x+newDir.x,ny=g.y+newDir.y
        if(canMove(maze,nx,ny)){g.x=nx;g.y=ny;g.dir=newDir}
      })
    }
    // Ghost-pac collision
    ghostsRef.current.forEach(g=>{
      if(g.eaten) return
      if(g.x===pac.x&&g.y===pac.y){
        if(g.scared){g.eaten=true;g.scared=false;scoreRef.current+=200;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)}
        else{
          livesRef.current--;setLives(livesRef.current)
          if(livesRef.current<=0){phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current);return}
          pac.x=9;pac.y=14;pac.dir={x:0,y:0};pac.nextDir={x:0,y:0}
        }
      }
    })
    // Win check
    if(!maze.flat().some(c=>c===0||c===2)){
      phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current)
    }
    draw()
    loopRef.current=setTimeout(tick,100)
  },[draw,onScoreUpdate,onGameOver])

  const startGame=useCallback(()=>{
    mazeRef.current=parseMaze()
    pacRef.current={x:9,y:14,dir:{x:0,y:0},nextDir:{x:0,y:0},mouth:0,mouthDir:1}
    ghostsRef.current=[
      {x:9,y:9,dir:{x:1,y:0},scared:false,eaten:false,color:"#ef4444"},
      {x:10,y:9,dir:{x:-1,y:0},scared:false,eaten:false,color:"#f97316"},
      {x:9,y:10,dir:{x:0,y:1},scared:false,eaten:false,color:"#ec4899"},
      {x:10,y:10,dir:{x:0,y:-1},scared:false,eaten:false,color:"#06b6d4"},
    ]
    scoreRef.current=0;livesRef.current=3;frameRef.current=0;scaredTimerRef.current=0
    setScore(0);setLives(3)
    phaseRef.current="playing";setPhase("playing");onGameStart()
    clearTimeout(loopRef.current);loopRef.current=setTimeout(tick,100)
  },[tick,onGameStart])

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const p=pacRef.current
      const m:{[k:string]:{x:number,y:number}}={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},KeyW:{x:0,y:-1},KeyS:{x:0,y:1},KeyA:{x:-1,y:0},KeyD:{x:1,y:0}}
      const d=m[e.code];if(d){p.nextDir=d;e.preventDefault()}
    }
    window.addEventListener("keydown",onKey)
    draw()
    return()=>{window.removeEventListener("keydown",onKey);clearTimeout(loopRef.current)}
  },[draw])

  const handleTouch=(dir:string)=>{
    const m:{[k:string]:{x:number,y:number}}={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}
    const d=m[dir];if(d) pacRef.current.nextDir=d
  }

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 max-h-[65vh]" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">👻</div>
          <h2 className="text-2xl font-orbitron text-neon-yellow mb-2">PAC-MAN</h2>
          <p className="text-space-muted mb-6 text-sm">Arrow keys or WASD to move</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">START GAME</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">👻</div>
          <h2 className="text-xl font-orbitron text-neon-yellow mb-1">GAME OVER</h2>
          <p className="text-3xl font-bold text-neon-purple mb-6">{score}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>
        </div>}
      </div>
      <TouchControls mode="dpad" onDirection={handleTouch} />
    </div>
  )
}