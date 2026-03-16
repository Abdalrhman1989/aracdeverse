"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"

const W=360,H=480,BUBBLE_R=18,COLS=9,ROWS=8
const COLORS=["#ef4444","#f97316","#fbbf24","#10b981","#06b6d4","#8b5cf6"]

interface Bubble{x:number;y:number;color:string}

function gridPos(col:number,row:number,rowOffset=0){
  const xOff=row%2===0?0:BUBBLE_R
  return{x:BUBBLE_R+col*(BUBBLE_R*2)+xOff,y:BUBBLE_R*1.5+row*(BUBBLE_R*1.7)}
}

function initGrid():Bubble[][]{
  return Array.from({length:ROWS},(_,r)=>
    Array.from({length:COLS-(r%2)},(_,c)=>({...gridPos(c,r),color:COLORS[Math.floor(Math.random()*COLORS.length)]}))
  )
}

function dist(a:{x:number,y:number},b:{x:number,y:number}){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)}

export default function BubbleShooterGame({onScoreUpdate,onGameOver,onGameStart,isPaused}:GameComponentProps){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const gridRef=useRef<Bubble[][]>(initGrid())
  const shooterRef=useRef({color:COLORS[0],angle:-Math.PI/2})
  const nextColorRef=useRef(COLORS[Math.floor(Math.random()*COLORS.length)])
  const bulletRef=useRef<{x:number;y:number;vx:number;vy:number;color:string}|null>(null)
  const scoreRef=useRef(0)
  const [phase,setPhase]=useState<GamePhase>("start")
  const [score,setScore]=useState(0)
  const phaseRef=useRef<GamePhase>("start")
  const rafRef=useRef<number>()
  const mouseRef=useRef({x:W/2,y:H-40})

  function getNeighbors(grid:Bubble[][],row:number,col:number):Array<[number,number]>{
    const even=row%2===0
    const dirs=even?[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]]:[[- 1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
    return (dirs.map(([dr,dc])=>[row+dr,col+dc]) as [number,number][]).filter(([r,c])=>r>=0&&r<grid.length&&c>=0&&c<(grid[r]?.length||0)&&grid[r]?.[c])
  }

  function findMatches(grid:Bubble[][],row:number,col:number,color:string):Array<[number,number]>{
    const visited=new Set<string>();const result:Array<[number,number]>=[]
    const queue:Array<[number,number]>=[[row,col]]
    while(queue.length){
      const [r,c]=queue.shift()!;const key=`${r},${c}`
      if(visited.has(key)) continue;visited.add(key)
      if(grid[r]?.[c]?.color===color){result.push([r,c]);getNeighbors(grid,r,c).forEach(n=>queue.push(n))}
    }
    return result
  }

  function snapToBubble(bx:number,by:number):Bubble|null{
    for(let r=0;r<gridRef.current.length;r++){
      for(let c=0;c<gridRef.current[r].length;c++){
        if(!gridRef.current[r][c]) continue
        if(dist({x:bx,y:by},gridRef.current[r][c])<BUBBLE_R*2) return gridRef.current[r][c]
      }
    }
    return null
  }

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!
    ctx.fillStyle="#03030a";ctx.fillRect(0,0,W,H)
    // Grid bubbles
    gridRef.current.forEach(row=>row.forEach(b=>{
      if(!b) return
      const g=ctx.createRadialGradient(b.x-4,b.y-4,2,b.x,b.y,BUBBLE_R)
      g.addColorStop(0,"rgba(255,255,255,0.6)");g.addColorStop(1,b.color)
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,BUBBLE_R-1,0,Math.PI*2);ctx.fill()
      ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x,b.y,BUBBLE_R-1,0,Math.PI*2);ctx.stroke()
    }))
    // Trajectory preview
    const shooter=shooterRef.current
    ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=1;ctx.setLineDash([5,8])
    ctx.beginPath();ctx.moveTo(W/2,H-40)
    let tx=W/2,ty=H-40,tvx=Math.cos(shooter.angle)*8,tvy=Math.sin(shooter.angle)*8
    for(let i=0;i<60;i++){tx+=tvx;ty+=tvy;if(tx<BUBBLE_R||tx>W-BUBBLE_R){tvx*=-1};if(ty<0) break;ctx.lineTo(tx,ty)}
    ctx.stroke();ctx.setLineDash([])
    // Shooter bubble
    const sg=ctx.createRadialGradient(W/2-4,H-44,2,W/2,H-40,BUBBLE_R)
    sg.addColorStop(0,"rgba(255,255,255,0.6)");sg.addColorStop(1,shooter.color)
    ctx.fillStyle=sg;ctx.beginPath();ctx.arc(W/2,H-40,BUBBLE_R,0,Math.PI*2);ctx.fill()
    // Next bubble indicator
    ctx.fillStyle=nextColorRef.current;ctx.beginPath();ctx.arc(W-30,H-30,10,0,Math.PI*2);ctx.fill()
    ctx.fillStyle="rgba(255,255,255,0.5)";ctx.font="9px sans-serif";ctx.textAlign="center";ctx.fillText("NEXT",W-30,H-15)
    // Bullet
    const blt=bulletRef.current
    if(blt){
      const bg=ctx.createRadialGradient(blt.x-4,blt.y-4,2,blt.x,blt.y,BUBBLE_R)
      bg.addColorStop(0,"rgba(255,255,255,0.6)");bg.addColorStop(1,blt.color)
      ctx.fillStyle=bg;ctx.beginPath();ctx.arc(blt.x,blt.y,BUBBLE_R,0,Math.PI*2);ctx.fill()
    }
    // Score
    ctx.fillStyle="white";ctx.font="13px Orbitron,monospace";ctx.textAlign="left";ctx.fillText(`${scoreRef.current}`,8,20)
    // Danger line
    ctx.strokeStyle="rgba(239,68,68,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H-90);ctx.lineTo(W,H-90);ctx.stroke()
  },[])

  const loop=useCallback(()=>{
    if(phaseRef.current!=="playing"){draw();rafRef.current=requestAnimationFrame(loop);return}
    const blt=bulletRef.current
    if(blt){
      blt.x+=blt.vx;blt.y+=blt.vy
      if(blt.x<BUBBLE_R){blt.x=BUBBLE_R;blt.vx=Math.abs(blt.vx)}
      if(blt.x>W-BUBBLE_R){blt.x=W-BUBBLE_R;blt.vx=-Math.abs(blt.vx)}
      // Check collision with grid
      let hit=false
      outer: for(let r=0;r<gridRef.current.length;r++){
        for(let c=0;c<gridRef.current[r].length;c++){
          const gb=gridRef.current[r][c];if(!gb) continue
          if(dist(blt,gb)<BUBBLE_R*2-2){
            // Place near collision
            gridRef.current[0]?.push({x:blt.x,y:blt.y,color:blt.color})
            const matches=findMatches(gridRef.current,0,gridRef.current[0].length-1,blt.color)
            if(matches.length>=3){
              matches.forEach(([mr,mc])=>{(gridRef.current[mr] as Bubble[])[mc]=null as unknown as Bubble})
              scoreRef.current+=matches.length*10;setScore(scoreRef.current);onScoreUpdate(scoreRef.current)
            }
            bulletRef.current=null;hit=true;break outer
          }
        }
      }
      if(!hit && blt.y<BUBBLE_R){
        gridRef.current[0]?.push({x:blt.x,y:BUBBLE_R,color:blt.color})
        bulletRef.current=null
      }
      // Check lose condition
      if(gridRef.current.some(row=>row.some(b=>b&&b.y>H-90))){
        phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current)
      }
      // Check win
      if(gridRef.current.every(row=>row.every(b=>!b))){
        phaseRef.current="gameover";setPhase("gameover");onGameOver(scoreRef.current+1000)
      }
    }
    // Rotate shooter toward mouse
    const mx=mouseRef.current.x,my=mouseRef.current.y
    shooterRef.current.angle=Math.atan2(my-(H-40),mx-W/2)
    shooterRef.current.angle=Math.max(-Math.PI+0.2,Math.min(-0.2,shooterRef.current.angle))
    draw()
    rafRef.current=requestAnimationFrame(loop)
  },[draw,onScoreUpdate,onGameOver])

  const shoot=useCallback(()=>{
    if(phaseRef.current!=="playing"||bulletRef.current) return
    const angle=shooterRef.current.angle
    bulletRef.current={x:W/2,y:H-40,vx:Math.cos(angle)*8,vy:Math.sin(angle)*8,color:shooterRef.current.color}
    shooterRef.current.color=nextColorRef.current
    nextColorRef.current=COLORS[Math.floor(Math.random()*COLORS.length)]
  },[])

  const startGame=useCallback(()=>{
    gridRef.current=initGrid()
    scoreRef.current=0;setScore(0)
    shooterRef.current={color:COLORS[Math.floor(Math.random()*COLORS.length)],angle:-Math.PI/2}
    nextColorRef.current=COLORS[Math.floor(Math.random()*COLORS.length)]
    bulletRef.current=null
    phaseRef.current="playing";setPhase("playing");onGameStart()
    cancelAnimationFrame(rafRef.current!);rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart])

  useEffect(()=>{
    const onMouse=(e:MouseEvent)=>{const r=canvasRef.current!.getBoundingClientRect();mouseRef.current={x:e.clientX-r.left,y:e.clientY-r.top}}
    const onClick=()=>{ if(phaseRef.current==="playing") shoot() }
    const canvas=canvasRef.current
    canvas?.addEventListener("mousemove",onMouse)
    canvas?.addEventListener("click",onClick)
    draw()
    return()=>{canvas?.removeEventListener("mousemove",onMouse);canvas?.removeEventListener("click",onClick);cancelAnimationFrame(rafRef.current!)}
  },[draw,shoot])

  return(
    <div className="flex flex-col items-center gap-4">
      <div className="relative cursor-crosshair">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30 max-h-[70vh]" />
        {phase==="start"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-5xl mb-4">🫧</div>
          <h2 className="text-2xl font-orbitron text-neon-blue mb-2">BUBBLE SHOOTER</h2>
          <p className="text-space-muted mb-6 text-sm">Click to shoot, match 3+ to pop!</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">START!</button>
        </div>}
        {phase==="gameover"&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/90 rounded-lg">
          <div className="text-4xl mb-2">🫧</div>
          <h2 className="text-xl font-orbitron text-neon-blue mb-1">GAME OVER</h2>
          <p className="text-3xl font-bold text-neon-yellow mb-6">{score}</p>
          <button onClick={startGame} className="btn-primary px-8 py-3">PLAY AGAIN</button>
        </div>}
      </div>
      <p className="text-xs text-space-muted">Click/tap to aim and shoot!</p>
    </div>
  )
}