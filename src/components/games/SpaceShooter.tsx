"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { GameComponentProps, GamePhase } from "@/types/game"
import TouchControls from "@/components/ui/TouchControls"

const W=400, H=550

const DIFFICULTY = {
  easy:   { enemyRows:2, enemyHP:1, enemySpeed:0.4, bulletSpeed:8,  shootInterval:20, cols:6, scoreMulti:1 },
  medium: { enemyRows:3, enemyHP:1, enemySpeed:0.6, bulletSpeed:10, shootInterval:15, cols:7, scoreMulti:2 },
  hard:   { enemyRows:4, enemyHP:2, enemySpeed:0.9, bulletSpeed:12, shootInterval:10, cols:8, scoreMulti:3 },
}

type Diff='easy'|'medium'|'hard'
interface Enemy { x:number;y:number;alive:boolean;hp:number;maxHp:number;flash:number }
interface Bullet { x:number;y:number;enemy?:boolean }
interface Explosion { x:number;y:number;r:number;life:number }
interface State { px:number;py:number;bullets:Bullet[];enemies:Enemy[];explosions:Explosion[];score:number;lives:number;wave:number;frame:number;shootTimer:number;enemyDir:number;enemyMoveTimer:number }

export default function SpaceShooter({ onScoreUpdate, onGameOver, onGameStart, isPaused }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<State>({px:W/2,py:H-70,bullets:[],enemies:[],explosions:[],score:0,lives:3,wave:1,frame:0,shootTimer:0,enemyDir:1,enemyMoveTimer:0})
  const [phase, setPhase] = useState<GamePhase>("start")
  const [score, setScore] = useState(0)
  const [diff, setDiff] = useState<Diff>('medium')
  const phaseRef = useRef<GamePhase>("start")
  const diffRef = useRef<Diff>('medium')
  const rafRef = useRef<number>()
  const keysRef = useRef<Record<string,boolean>>({})

  const spawnWave = useCallback((s: State, d: Diff) => {
    const cfg=DIFFICULTY[d]; s.enemies=[]
    for(let r=0;r<cfg.enemyRows;r++) for(let c=0;c<cfg.cols;c++){
      s.enemies.push({x:50+c*42,y:40+r*40,alive:true,hp:cfg.enemyHP+(s.wave>3?1:0),maxHp:cfg.enemyHP+(s.wave>3?1:0),flash:0})
    }
    s.enemyDir=1
  },[])

  const draw = useCallback((s: State) => {
    const canvas=canvasRef.current; if(!canvas) return
    const ctx=canvas.getContext("2d")!
    ctx.fillStyle="#03030a"; ctx.fillRect(0,0,W,H)
    for(let i=0;i<60;i++){
      const sx=(i*137+s.frame*0.2)%W,sy=(i*97+s.frame*0.1)%H
      const a=0.2+((i*7)%5)*0.12; ctx.fillStyle=`rgba(255,255,255,${a})`
      ctx.beginPath(); ctx.arc(sx,sy,0.8,0,Math.PI*2); ctx.fill()
    }
    // enemies
    s.enemies.filter(e=>e.alive).forEach(e=>{
      const frac=e.hp/e.maxHp
      const col=e.flash>0?'#fff':`rgba(${Math.floor(239*(1-frac)+139*frac)},${Math.floor(68*(1-frac)+92*frac)},${Math.floor(68*(1-frac)+246*frac)},1)`
      ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(e.x-14,e.y-10,28,20,5); ctx.fill()
      ctx.fillStyle="rgba(255,255,255,0.8)"; ctx.font="14px serif"; ctx.textAlign="center"; ctx.fillText("👾",e.x,e.y+5)
      if(e.maxHp>1){ ctx.fillStyle=frac>.5?"#10b981":"#ef4444"; ctx.fillRect(e.x-12,e.y-16,24*frac,4) }
    })
    // bullets
    s.bullets.forEach(b=>{
      ctx.fillStyle=b.enemy?"#ef4444":"#06b6d4"
      ctx.beginPath(); ctx.roundRect(b.x-2,b.y-8,4,16,2); ctx.fill()
    })
    // explosions
    s.explosions.forEach(ex=>{
      const a=ex.life/20; ctx.fillStyle=`rgba(251,191,36,${a})`
      ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.r,0,Math.PI*2); ctx.fill()
    })
    // player ship
    const pg=ctx.createLinearGradient(s.px-18,s.py,s.px+18,s.py+40); pg.addColorStop(0,"#8b5cf6"); pg.addColorStop(1,"#4f46e5")
    ctx.fillStyle=pg
    ctx.beginPath(); ctx.moveTo(s.px,s.py); ctx.lineTo(s.px-18,s.py+40); ctx.lineTo(s.px+18,s.py+40); ctx.closePath(); ctx.fill()
    ctx.fillStyle="#06b6d4"; ctx.beginPath(); ctx.arc(s.px,s.py+25,6,0,Math.PI*2); ctx.fill()
    // engine glow
    const eg=ctx.createRadialGradient(s.px,s.py+42,0,s.px,s.py+42,12); eg.addColorStop(0,"rgba(139,92,246,0.9)"); eg.addColorStop(1,"transparent")
    ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(s.px,s.py+42,12,0,Math.PI*2); ctx.fill()
    // HUD
    ctx.fillStyle="rgba(255,255,255,0.15)"; ctx.fillRect(0,0,W,30)
    ctx.fillStyle="#fff"; ctx.font="bold 13px Orbitron,monospace"; ctx.textAlign="left"; ctx.fillText(`SCORE ${s.score}`,8,20)
    ctx.textAlign="center"; ctx.fillText(`WAVE ${s.wave}`,W/2,20)
    ctx.textAlign="right"; ctx.fillText("❤️".repeat(s.lives),W-8,20)
  },[])

  const loop = useCallback(()=>{
    if(phaseRef.current!=="playing"){ draw(stateRef.current); rafRef.current=requestAnimationFrame(loop); return }
    const s=stateRef.current; const cfg=DIFFICULTY[diffRef.current]
    s.frame++
    // move player
    if(keysRef.current["ArrowLeft"]||keysRef.current["KeyA"]) s.px=Math.max(20,s.px-4)
    if(keysRef.current["ArrowRight"]||keysRef.current["KeyD"]) s.px=Math.min(W-20,s.px+4)
    // shoot
    s.shootTimer++
    if(s.shootTimer>=cfg.shootInterval){ s.bullets.push({x:s.px,y:s.py-10}); s.shootTimer=0 }
    // move enemies
    s.enemyMoveTimer++
    const alive=s.enemies.filter(e=>e.alive)
    if(s.enemyMoveTimer>=30-Math.min(20,s.wave*2)){
      s.enemyMoveTimer=0
      const minX=Math.min(...alive.map(e=>e.x)), maxX=Math.max(...alive.map(e=>e.x))
      if((s.enemyDir===1&&maxX>W-30)||(s.enemyDir===-1&&minX<30)){ s.enemyDir*=-1; alive.forEach(e=>e.y+=18) }
      else alive.forEach(e=>e.x+=s.enemyDir*18)
    }
    // enemy shoot
    if(s.frame%Math.max(60-s.wave*8,20)===0 && alive.length>0){
      const shooter=alive[Math.floor(Math.random()*alive.length)]
      s.bullets.push({x:shooter.x,y:shooter.y+10,enemy:true})
    }
    // move bullets
    s.bullets=s.bullets.filter(b=>{
      b.y+=b.enemy?4:-cfg.bulletSpeed
      return b.y>0&&b.y<H
    })
    // bullet vs enemy
    s.bullets.forEach((b,bi)=>{ if(b.enemy) return; s.enemies.forEach(e=>{ if(!e.alive) return; if(Math.abs(b.x-e.x)<16&&Math.abs(b.y-e.y)<14){ e.hp--; e.flash=8; s.bullets.splice(bi,1); if(e.hp<=0){ e.alive=false; s.explosions.push({x:e.x,y:e.y,r:20,life:20}); s.score+=cfg.scoreMulti*10; setScore(s.score); onScoreUpdate(s.score) } } }) })
    // bullet vs player
    s.bullets=s.bullets.filter(b=>{ if(!b.enemy) return true; if(Math.abs(b.x-s.px)<20&&Math.abs(b.y-s.py-20)<25){ s.lives--; s.explosions.push({x:s.px,y:s.py,r:30,life:20}); if(s.lives<=0){ phaseRef.current="gameover"; setPhase("gameover"); onGameOver(s.score); return false } return false } return true })
    // enemy reaches bottom
    if(alive.some(e=>e.y>H-80)){ phaseRef.current="gameover"; setPhase("gameover"); onGameOver(s.score); draw(s); return }
    // next wave
    if(alive.length===0){ s.wave++; spawnWave(s,diffRef.current) }
    // flash decay
    s.enemies.forEach(e=>{ if(e.flash>0) e.flash-- })
    s.explosions=s.explosions.filter(ex=>{ ex.life--; ex.r+=1.5; return ex.life>0 })
    draw(s); rafRef.current=requestAnimationFrame(loop)
  },[draw,onGameOver,onScoreUpdate,spawnWave])

  const startGame = useCallback((d: Diff)=>{
    diffRef.current=d
    const s:State={px:W/2,py:H-70,bullets:[],enemies:[],explosions:[],score:0,lives:3,wave:1,frame:0,shootTimer:0,enemyDir:1,enemyMoveTimer:0}
    stateRef.current=s; spawnWave(s,d)
    setScore(0); phaseRef.current="playing"; setPhase("playing"); onGameStart()
    cancelAnimationFrame(rafRef.current!); rafRef.current=requestAnimationFrame(loop)
  },[loop,onGameStart,spawnWave])

  useEffect(()=>{
    if(isPaused&&phaseRef.current==="playing"){ phaseRef.current="paused"; setPhase("paused"); cancelAnimationFrame(rafRef.current!) }
    else if(!isPaused&&phaseRef.current==="paused"){ phaseRef.current="playing"; setPhase("playing"); rafRef.current=requestAnimationFrame(loop) }
  },[isPaused,loop])

  useEffect(()=>{
    const dn=(e:KeyboardEvent)=>{ keysRef.current[e.code]=true }
    const up=(e:KeyboardEvent)=>{ keysRef.current[e.code]=false }
    window.addEventListener("keydown",dn); window.addEventListener("keyup",up); draw(stateRef.current)
    return ()=>{ window.removeEventListener("keydown",dn); window.removeEventListener("keyup",up); cancelAnimationFrame(rafRef.current!) }
  },[draw])

  const handleTouch=useCallback((dir:string)=>{
    if(dir==="left") stateRef.current.px=Math.max(20,stateRef.current.px-20)
    if(dir==="right") stateRef.current.px=Math.min(W-20,stateRef.current.px+20)
  },[])

  const diffColors={easy:'#10b981',medium:'#8b5cf6',hard:'#ef4444'}
  const diffLabels={easy:'Easy',medium:'Medium',hard:'Hard'}
  const diffDesc={easy:'2 rows, slower',medium:'3 rows, standard',hard:'4 rows, armored!'}

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-neon-purple/30" />
        {phase==="start"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg p-6">
            <div className="text-5xl mb-3">🚀</div>
            <h2 className="text-2xl font-orbitron text-neon-blue mb-1">SPACE SHOOTER</h2>
            <p className="text-space-muted mb-4 text-xs text-center">Arrow keys / WASD to move · Auto-fires!</p>
            <p className="text-white font-bold mb-3 font-orbitron text-xs tracking-widest">DIFFICULTY</p>
            <div className="flex flex-col gap-2 w-full max-w-[220px] mb-4">
              {(['easy','medium','hard'] as Diff[]).map(d=>(
                <button key={d} onClick={()=>{setDiff(d);diffRef.current=d}}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-white transition-all"
                  style={{background:diff===d?diffColors[d]:'rgba(255,255,255,0.07)',border:`2px solid ${diff===d?diffColors[d]:'rgba(255,255,255,0.15)'}`}}>
                  <span className="block">{diffLabels[d]}</span><span className="text-xs opacity-70">{diffDesc[d]}</span>
                </button>
              ))}
            </div>
            <button onClick={()=>startGame(diff)} className="btn-primary px-8 py-3 w-full max-w-[220px]">LAUNCH!</button>
          </div>
        )}
        {phase==="gameover"&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-bg/95 rounded-lg">
            <div className="text-4xl mb-2">💥</div>
            <h2 className="text-xl font-orbitron text-neon-red mb-1">DESTROYED!</h2>
            <div className="text-xs text-space-muted mb-1">{diffLabels[diff]} · Wave {stateRef.current.wave}</div>
            <p className="text-3xl font-bold text-neon-yellow mb-5">{score}</p>
            <div className="flex gap-3">
              <button className="btn-primary px-6 py-2" onClick={()=>startGame(diff)}>Retry</button>
              <button className="btn-secondary px-4 py-2 text-sm" onClick={()=>setPhase("start")}>Change Diff</button>
            </div>
          </div>
        )}
        {phase==="paused"&&<div className="absolute inset-0 flex items-center justify-center bg-space-bg/80 rounded-lg"><span className="text-3xl font-orbitron text-neon-blue">PAUSED</span></div>}
      </div>
      <TouchControls mode="dpad" onDirection={handleTouch} />
    </div>
  )
}
