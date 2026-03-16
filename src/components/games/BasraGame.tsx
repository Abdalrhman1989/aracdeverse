"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type Card = { suit: Suit; rank: Rank; id: string }
type Diff = 'easy' | 'medium' | 'hard'
type Phase = 'start' | 'playing' | 'round-deal' | 'gameover'

const RANKS: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const SUITS: Suit[] = ['S','H','D','C']
const RANK_VAL: Record<Rank,number> = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13}
const NUM_VAL: Record<Rank,number> = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':0,'Q':0,'K':0}
const SUIT_DISP: Record<Suit,string> = {S:'♠',H:'♥',D:'♦',C:'♣'}
const SUIT_COLOR: Record<Suit,string> = {S:'#c7d2fe',H:'#fca5a5',D:'#fca5a5',C:'#c7d2fe'}
const WIN_SCORE = 101
const FACE_RANKS: Rank[] = ['J','Q','K']

function makeId(s:Suit,r:Rank): string { return `${s}${r}` }
function makeDeck(): Card[] {
  const d: Card[] = []
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r,id:makeId(s,r)})
  return d.sort(()=>Math.random()-0.5)
}

function isFaceCard(card: Card): boolean { return FACE_RANKS.includes(card.rank) }
function isAce(card: Card): boolean { return card.rank==='A' }
function isJack(card: Card): boolean { return card.rank==='J' }
function numVal(card: Card): number { return NUM_VAL[card.rank] }

// Find what can be captured from table with played card
function findCaptures(played: Card, table: Card[]): Card[][] {
  const result: Card[][] = []
  if(isAce(played)||isJack(played)){
    // Capture everything
    if(table.length>0) result.push([...table])
    return result
  }
  if(isFaceCard(played)){
    // Face cards capture matching face cards
    const matching = table.filter(c=>c.rank===played.rank)
    if(matching.length>0) result.push(matching)
    return result
  }
  // Number card: capture same rank
  const sameRank = table.filter(c=>c.rank===played.rank)
  if(sameRank.length>0) result.push(sameRank)
  // Sets that sum to the played card value (numeric only)
  const pv = numVal(played)
  if(pv>1){
    const nums = table.filter(c=>!isFaceCard(c)&&!isAce(c))
    // Find subsets summing to pv
    for(let mask=1;mask<(1<<nums.length);mask++){
      let sum=0
      const subset: Card[] = []
      for(let i=0;i<nums.length;i++){
        if(mask&(1<<i)){sum+=numVal(nums[i]);subset.push(nums[i])}
      }
      if(sum===pv&&subset.length>1){
        // Make sure no duplicate with sameRank capture
        const isNew=!result.some(r=>r.length===subset.length&&r.every(c=>subset.find(s=>s.id===c.id)))
        if(isNew) result.push(subset)
      }
    }
  }
  return result
}

function bestCapture(played: Card, table: Card[]): Card[]|null {
  const caps = findCaptures(played, table)
  if(caps.length===0) return null
  // Prefer captures that include special cards
  if(isAce(played)||isJack(played)) return table.length>0 ? [...table] : null
  return caps.sort((a,b)=>b.length-a.length)[0]
}

function calcScore(captured: Card[]): number {
  let score = 0
  for(const c of captured){
    if(c.rank==='A') score+=1
    if(c.rank==='2'&&c.suit==='C') score+=3
    if(c.rank==='7'&&c.suit==='D') score+=10
  }
  return score
}

// Basra bonus points are tracked separately
function getAICard(hand: Card[], table: Card[], difficulty: Diff): Card {
  if(difficulty==='easy') return hand[Math.floor(Math.random()*hand.length)]
  // Medium: prefer cards that make captures
  const withCapture = hand.filter(c=>bestCapture(c,table)!==null)
  if(withCapture.length>0){
    if(difficulty==='hard'){
      // Prefer captures that get more cards or special cards
      const scored = withCapture.map(c=>{
        const cap=bestCapture(c,table)!
        let s=cap.length
        if(cap.some(c2=>c2.rank==='A')) s+=10
        if(cap.some(c2=>c2.rank==='7'&&c2.suit==='D')) s+=10
        if(cap.some(c2=>c2.rank==='2'&&c2.suit==='C')) s+=5
        // Check basra
        if(table.length===1) s+=20
        return {card:c,score:s}
      })
      scored.sort((a,b)=>b.score-a.score)
      return scored[0].card
    }
    return withCapture[Math.floor(Math.random()*withCapture.length)]
  }
  // No captures: play a low-value card (hard: protect 7D and 2C if possible)
  if(difficulty==='hard'){
    const safe=hand.filter(c=>!(c.rank==='7'&&c.suit==='D')&&!(c.rank==='2'&&c.suit==='C')&&c.rank!=='A')
    if(safe.length>0) return safe[Math.floor(Math.random()*safe.length)]
  }
  return hand[Math.floor(Math.random()*hand.length)]
}

function CardFace({card,small=false,highlight=false,faceDown=false,onClick,glowing=false}:{card:Card,small?:boolean,highlight?:boolean,faceDown?:boolean,onClick?:()=>void,glowing?:boolean}){
  const color=SUIT_COLOR[card.suit]
  const bg=highlight?'rgba(250,204,21,0.18)':'rgba(255,255,255,0.08)'
  const border=highlight?'2px solid #facc15':glowing?'2px solid #4ade80':'1.5px solid rgba(255,255,255,0.18)'
  const size=small?{w:40,h:58,fs:'10px',fs2:'15px'}:{w:52,h:72,fs:'12px',fs2:'18px'}
  if(faceDown) return (
    <div style={{width:size.w,height:size.h,borderRadius:7,background:'linear-gradient(135deg,#3730a3,#1e1b4b)',border:'1.5px solid rgba(255,255,255,0.1)',boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}/>
  )
  return (
    <div onClick={onClick} style={{
      width:size.w,height:size.h,borderRadius:7,background:bg,border,
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      cursor:onClick?'pointer':'default',
      boxShadow:highlight?'0 0 12px 2px #facc1566':glowing?'0 0 10px 2px #4ade8044':'0 2px 8px rgba(0,0,0,0.3)',
      transition:'transform 0.15s,box-shadow 0.15s',userSelect:'none',
    }} className={onClick?'card-hover':''}>
      <div style={{fontSize:size.fs,fontWeight:700,color,lineHeight:1}}>{card.rank}</div>
      <div style={{fontSize:size.fs2,color,lineHeight:1}}>{SUIT_DISP[card.suit]}</div>
    </div>
  )
}

interface BonusEvent { type:'basra'|'super-basra'|'capture'; message:string; pts:number }

interface PlayerState {
  hand: Card[]
  captured: Card[]
  basraBonus: number
  score: number
}

interface GameState {
  deck: Card[]
  players: [PlayerState,PlayerState] // 0=you, 1=ai
  table: Card[]
  turn: 0|1
  phase: Phase
  dealCount: number
  lastCapture: 0|1|null
  message: string
  roundScores: [number,number]
  totalScores: [number,number]
}

export default function BasraGame({ onScoreUpdate, onGameOver, onGameStart }:GameComponentProps){
  const [difficulty, setDifficulty] = useState<Diff|null>(null)
  const [gs, setGs] = useState<GameState|null>(null)
  const [bonusEvent, setBonusEvent] = useState<BonusEvent|null>(null)
  const [animCard, setAnimCard] = useState<string|null>(null)
  const [selectedCard, setSelectedCard] = useState<string|null>(null)
  const aiTimerRef = useRef<NodeJS.Timeout|null>(null)

  const initGame = useCallback((diff:Diff)=>{
    const deck = makeDeck()
    const p0Hand = deck.slice(0,4)
    const p1Hand = deck.slice(4,8)
    const tableCards = deck.slice(8,12)
    const remaining = deck.slice(12)
    const state: GameState = {
      deck:remaining,
      players:[
        {hand:p0Hand,captured:[],basraBonus:0,score:0},
        {hand:p1Hand,captured:[],basraBonus:0,score:0},
      ],
      table:tableCards,
      turn:0,
      phase:'playing',
      dealCount:1,
      lastCapture:null,
      message:'Your turn! Play a card.',
      roundScores:[0,0],
      totalScores:[0,0],
    }
    setGs(state)
    setDifficulty(diff)
    setSelectedCard(null)
  },[])

  const triggerBonus = (type: BonusEvent['type'], pts: number, name: string)=>{
    const msg = type==='super-basra'?`${name} SUPER BASRA! +${pts}`:type==='basra'?`${name} BASRA! +${pts}`:`${name} captured!`
    setBonusEvent({type,message:msg,pts})
    setTimeout(()=>setBonusEvent(null),1800)
  }

  const playCardAction = useCallback((card: Card, playerIdx: 0|1, currentGs: GameState): GameState => {
    const newGs = JSON.parse(JSON.stringify(currentGs)) as GameState
    const player = newGs.players[playerIdx]
    const cardIdx = player.hand.findIndex(c=>c.id===card.id)
    if(cardIdx===-1) return currentGs
    player.hand.splice(cardIdx,1)

    let captured: Card[]|null = null
    if(isAce(card)||isJack(card)){
      if(newGs.table.length>0) captured=[...newGs.table]
    } else if(isFaceCard(card)){
      const m=newGs.table.filter(c=>c.rank===card.rank)
      if(m.length>0) captured=m
    } else {
      const cap = bestCapture(card, newGs.table)
      if(cap&&cap.length>0) captured=cap
    }

    if(captured&&captured.length>0){
      const wasBasra=newGs.table.length===captured.length
      const capIds=new Set(captured.map(c=>c.id))
      newGs.table=newGs.table.filter(c=>!capIds.has(c.id))
      player.captured.push(card,...captured)
      newGs.lastCapture=playerIdx
      const name=playerIdx===0?'You':'AI'

      if(isJack(card)&&wasBasra&&newGs.table.length===0){
        // Super basra (jack captures all and table was only those cards)
        player.basraBonus+=30
        setTimeout(()=>triggerBonus('super-basra',30,name),100)
      } else if(wasBasra&&newGs.table.length===0){
        // Basra
        player.basraBonus+=10
        setTimeout(()=>triggerBonus('basra',10,name),100)
      } else {
        setTimeout(()=>triggerBonus('capture',captured!.length,name),100)
      }
    } else {
      newGs.table.push(card)
    }

    // Check if both hands empty
    const bothEmpty=newGs.players[0].hand.length===0&&newGs.players[1].hand.length===0
    if(bothEmpty){
      if(newGs.deck.length>=8){
        // Deal 4 more each
        const p0New=newGs.deck.slice(0,4)
        const p1New=newGs.deck.slice(4,8)
        newGs.deck=newGs.deck.slice(8)
        newGs.players[0].hand=p0New
        newGs.players[1].hand=p1New
        newGs.dealCount++
        newGs.turn=playerIdx===0?1:0
        newGs.message=newGs.turn===0?'Your turn!':'AI thinking...'
      } else if(newGs.deck.length>0){
        // Odd remaining
        const half=Math.ceil(newGs.deck.length/2)
        newGs.players[0].hand=newGs.deck.slice(0,half)
        newGs.players[1].hand=newGs.deck.slice(half)
        newGs.deck=[]
        newGs.dealCount++
        newGs.turn=playerIdx===0?1:0
        newGs.message=newGs.turn===0?'Your turn!':'AI thinking...'
      } else {
        // Game round over
        // Remaining table cards go to last capturer
        if(newGs.lastCapture!==null&&newGs.table.length>0){
          newGs.players[newGs.lastCapture].captured.push(...newGs.table)
          newGs.table=[]
        }
        // Calculate scores
        const p0cap=newGs.players[0].captured.length
        const p1cap=newGs.players[1].captured.length
        const p0bonus=p0cap>=27?30:p1cap>=27?0:0
        const p1bonus=p1cap>=27?30:p0cap>=27?0:0
        const p0score=calcScore(newGs.players[0].captured)+newGs.players[0].basraBonus+(p0cap>=27?30:0)
        const p1score=calcScore(newGs.players[1].captured)+newGs.players[1].basraBonus+(p1cap>=27?30:0)
        newGs.roundScores=[p0score,p1score]
        newGs.totalScores=[newGs.totalScores[0]+p0score,newGs.totalScores[1]+p1score]
        if(newGs.totalScores[0]>=WIN_SCORE||newGs.totalScores[1]>=WIN_SCORE){
          newGs.phase='gameover'
          const winner=newGs.totalScores[0]>=newGs.totalScores[1]?'You':'AI'
          if (winner==='You') sfxVictory(); else sfxGameOver()
          newGs.message=`Game Over! ${winner} win${winner==='You'?'':'s'}!`
        } else {
          newGs.phase='round-deal'
          newGs.message=`Round over! You: +${p0score} pts, AI: +${p1score} pts`
        }
      }
    } else {
      newGs.turn=playerIdx===0?1:0
      newGs.message=newGs.turn===0?'Your turn!':'AI thinking...'
    }
    return newGs
  },[])

  const handlePlayCard = useCallback((card: Card)=>{
    sfxCardPlay()
    if(!gs||gs.turn!==0||gs.phase!=='playing') return
    setSelectedCard(null)
    setAnimCard(card.id)
    setTimeout(()=>setAnimCard(null),400)
    setGs(prev=>{
      if(!prev) return prev
      return playCardAction(card, 0, prev)
    })
  },[gs, playCardAction])

  // AI turn
  useEffect(()=>{
    if(!gs||gs.phase!=='playing'||gs.turn!==1) return
    const delay=800+Math.random()*500
    aiTimerRef.current=setTimeout(()=>{
      setGs(prev=>{
        if(!prev||prev.phase!=='playing'||prev.turn!==1) return prev
        if(prev.players[1].hand.length===0) return prev
        const card=getAICard(prev.players[1].hand,prev.table,difficulty!)
        return playCardAction(card,1,prev)
      })
    },delay)
    return ()=>{if(aiTimerRef.current)clearTimeout(aiTimerRef.current)}
  },[gs?.turn,gs?.phase,difficulty,playCardAction])

  // Handle round-deal
  useEffect(()=>{
    if(!gs||gs.phase!=='round-deal') return
    const timer=setTimeout(()=>{
      setGs(prev=>{
        if(!prev||prev.phase!=='round-deal') return prev
        const deck=makeDeck()
        const p0Hand=deck.slice(0,4)
        const p1Hand=deck.slice(4,8)
        const tableCards=deck.slice(8,12)
        const remaining=deck.slice(12)
        const newGs: GameState = {
          deck:remaining,
          players:[
            {hand:p0Hand,captured:[],basraBonus:0,score:0},
            {hand:p1Hand,captured:[],basraBonus:0,score:0},
          ],
          table:tableCards,
          turn:0,
          phase:'playing',
          dealCount:1,
          lastCapture:null,
          message:'New round! Your turn.',
          roundScores:[0,0],
          totalScores:prev.totalScores,
        }
        return newGs
      })
    },3000)
    return ()=>clearTimeout(timer)
  },[gs?.phase])

  const restartGame=()=>{setDifficulty(null);setGs(null)}

  if(!difficulty){
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1a2e1a)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:64,marginBottom:8}}>🎴</div>
          <h1 style={{fontSize:42,fontWeight:900,margin:0,background:'linear-gradient(90deg,#4ade80,#22d3ee)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>BASRA</h1>
          <p style={{color:'#94a3b8',marginTop:8,fontSize:18}}>The Classic Middle Eastern Fishing Card Game</p>
        </div>
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:16,padding:'32px 40px',border:'1px solid rgba(255,255,255,0.1)',maxWidth:500,width:'100%'}}>
          <h2 style={{margin:'0 0 12px',fontSize:20,color:'#e2e8f0'}}>How to Play</h2>
          <ul style={{color:'#94a3b8',fontSize:14,margin:'0 0 20px',paddingLeft:18,lineHeight:2.2}}>
            <li>Play cards from hand to capture table cards</li>
            <li>Match rank OR sum to card value to capture</li>
            <li><strong style={{color:'#4ade80'}}>Basra</strong>: clear the table = +10 bonus points</li>
            <li><strong style={{color:'#22d3ee'}}>Jack Basra</strong>: Jack clears table = +30 bonus!</li>
            <li>Jack & Ace capture ALL table cards</li>
            <li>Most cards (+30), 7♦ (+10), 2♣ (+3), Aces (+1 each)</li>
            <li>First to {WIN_SCORE} points wins!</li>
          </ul>
          <h3 style={{margin:'0 0 12px',color:'#e2e8f0',fontSize:16}}>Select Difficulty</h3>
          <div style={{display:'flex',gap:10}}>
            {(['easy','medium','hard'] as Diff[]).map(d=>(
              <button key={d} onClick={()=>initGame(d)} style={{
                flex:1,padding:'14px 0',borderRadius:10,border:'none',cursor:'pointer',fontWeight:700,fontSize:16,
                background:d==='easy'?'linear-gradient(135deg,#22c55e,#16a34a)':d==='medium'?'linear-gradient(135deg,#f59e0b,#d97706)':'linear-gradient(135deg,#ef4444,#dc2626)',
                color:'white',
              }}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if(!gs) return null

  const {players,table,turn,phase,totalScores,roundScores,message,deck} = gs
  const myHand = players[0].hand
  const aiHand = players[1].hand
  const myScore = totalScores[0]
  const aiScore = totalScores[1]

  if(phase==='gameover'){
    const won = myScore>=aiScore
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1a2e1a)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'system-ui,sans-serif',padding:20}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:72}}>{won?'🏆':'😔'}</div>
          <h1 style={{fontSize:36,fontWeight:900,margin:'8px 0',color:won?'#4ade80':'#f87171'}}>{won?'You Win!':'AI Wins!'}</h1>
          <p style={{color:'#94a3b8',fontSize:16}}>{message}</p>
        </div>
        <div style={{background:'rgba(255,255,255,0.06)',borderRadius:16,padding:28,minWidth:300,border:'1px solid rgba(255,255,255,0.1)',marginBottom:24}}>
          <h3 style={{margin:'0 0 16px',color:'#e2e8f0',textAlign:'center'}}>Final Score</h3>
          {[{name:'You',score:myScore,w:won},{name:'AI',score:aiScore,w:!won}].map((p,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i===0?'1px solid rgba(255,255,255,0.08)':'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:20}}>{i===0?'🧑':'🤖'}</span>
                <span style={{fontWeight:600,color:p.w?'#facc15':'#e2e8f0'}}>{p.name}</span>
                {p.w&&<span style={{fontSize:12,background:'#facc1533',color:'#facc15',padding:'2px 8px',borderRadius:999}}>Winner</span>}
              </div>
              <span style={{fontWeight:700,fontSize:24,color:p.score<0?'#f87171':'#4ade80'}}>{p.score}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:12}}>
          <button onClick={()=>initGame(difficulty!)} style={{background:'linear-gradient(135deg,#4ade80,#22c55e)',color:'#0f172a',border:'none',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:15}}>Play Again</button>
          <button onClick={restartGame} style={{background:'rgba(255,255,255,0.08)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.15)',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontSize:15}}>Menu</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1a2e1a 50%,#0f172a 100%)',display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif',color:'white',overflow:'hidden'}}>
      <style>{`
        .card-hover:hover{transform:translateY(-8px) scale(1.06);box-shadow:0 10px 28px rgba(74,222,128,0.4)!important;}
        @keyframes slideIn{from{opacity:0;transform:scale(0.3) translateY(-20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes basraFlash{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(0.8)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      {/* Top bar */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px',background:'rgba(0,0,0,0.3)',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>

          <div style={{fontWeight:800,fontSize:18,color:'#4ade80'}}>BASRA</div>
          <div style={{fontSize:12,color:'#64748b',background:'rgba(255,255,255,0.04)',padding:'3px 10px',borderRadius:6}}>Deck: {deck.length} cards</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          {[{label:'You',score:myScore,cards:players[0].captured.length},{label:'AI',score:aiScore,cards:players[1].captured.length}].map((p,i)=>(
            <div key={i} style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'6px 16px',border:`1px solid ${turn===i?'rgba(74,222,128,0.4)':'rgba(255,255,255,0.08)'}`}}>
              <div style={{fontSize:11,color:'#64748b'}}>{p.label}</div>
              <div style={{fontWeight:700,fontSize:20,color:'#4ade80'}}>{p.score}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{p.cards} cards</div>
            </div>
          ))}
        </div>
      </div>

      {/* Round-over banner */}
      {phase==='round-deal'&&<div style={{background:'rgba(74,222,128,0.15)',border:'1px solid rgba(74,222,128,0.3)',padding:'12px 20px',textAlign:'center',color:'#4ade80',fontWeight:600}}>
        Round over! You: +{roundScores[0]} | AI: +{roundScores[1]} — Dealing new round...
      </div>}

      {/* Main area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 16px',gap:10}}>

        {/* AI hand */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
          <div style={{fontSize:11,color:turn===1?'#facc15':'#64748b',fontWeight:600}}>AI {turn===1&&<span style={{animation:'pulse 1s infinite',display:'inline'}}>thinking...</span>}</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
            {aiHand.map((_,i)=><div key={i} style={{width:40,height:58,borderRadius:7,background:'linear-gradient(135deg,#3730a3,#1e1b4b)',border:'1.5px solid rgba(255,255,255,0.08)',boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}/>)}
          </div>
          <div style={{fontSize:11,color:'#64748b'}}>{aiHand.length} cards in hand | {players[1].captured.length} captured | Bonus: +{players[1].basraBonus}</div>
        </div>

        {/* Scores strip */}
        <div style={{display:'flex',justifyContent:'center',gap:20,padding:'4px 0'}}>
          <div style={{fontSize:12,color:'#94a3b8'}}>Total — You: <strong style={{color:'#4ade80'}}>{myScore}</strong> | AI: <strong style={{color:'#f87171'}}>{aiScore}</strong></div>
          <div style={{fontSize:12,color:'#64748b'}}>First to {WIN_SCORE} wins</div>
        </div>

        {/* Table / Center area */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'radial-gradient(ellipse,rgba(30,60,30,0.6),rgba(15,23,42,0.3))',borderRadius:20,border:'1px solid rgba(255,255,255,0.05)',position:'relative',minHeight:180,padding:16}}>

          {/* Bonus flash */}
          {bonusEvent&&<div style={{
            position:'absolute',top:'50%',left:'50%',
            background:bonusEvent.type==='super-basra'?'rgba(250,204,21,0.9)':bonusEvent.type==='basra'?'rgba(74,222,128,0.9)':'rgba(99,102,241,0.7)',
            borderRadius:16,padding:'14px 28px',fontSize:bonusEvent.type==='super-basra'?22:18,fontWeight:900,
            color:'#0f172a',zIndex:20,
            animation:'basraFlash 1.8s ease forwards',
            whiteSpace:'nowrap',boxShadow:'0 0 40px rgba(255,255,255,0.5)',
          }}>
            {bonusEvent.message}
          </div>}

          {/* Table label */}
          <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',fontSize:11,color:'#64748b',background:'rgba(0,0,0,0.3)',padding:'2px 12px',borderRadius:20}}>Table ({table.length} cards)</div>

          {/* Table cards */}
          {table.length===0?(
            <div style={{color:'#374151',fontSize:13,border:'2px dashed rgba(255,255,255,0.08)',borderRadius:12,padding:'24px 40px'}}>Table is empty</div>
          ):(
            <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center',maxWidth:'90%'}}>
              {table.map(card=>{
                const canCap = turn===0&&phase==='playing'&&selectedCard ? (() => {
                  const sel=myHand.find(c=>c.id===selectedCard)
                  if(!sel) return false
                  const caps=findCaptures(sel,table)
                  return caps.some(cap=>cap.some(c=>c.id===card.id))
                })() : false
                return <div key={card.id} style={{animation:'slideIn 0.4s ease'}}>
                  <CardFace card={card} glowing={canCap}/>
                </div>
              })}
            </div>
          )}

          {/* Message */}
          <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',fontSize:13,color:turn===0?'#4ade80':'#94a3b8',background:'rgba(0,0,0,0.4)',padding:'4px 14px',borderRadius:20,whiteSpace:'nowrap'}}>
            {message}
          </div>
        </div>

        {/* Your hand */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,paddingBottom:8}}>
          <div style={{fontSize:11,color:'#64748b'}}>{myHand.length} cards in hand | {players[0].captured.length} captured | Bonus: +{players[0].basraBonus}</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
            {myHand.map(card=>{
              const canPlay=turn===0&&phase==='playing'
              const hasCapture=canPlay&&bestCapture(card,table)!==null
              const isSelected=selectedCard===card.id
              return (
                <div key={card.id} style={{transform:isSelected?'translateY(-10px)':'none',transition:'transform 0.15s'}}>
                  <CardFace
                    card={card}
                    highlight={isSelected||hasCapture}
                    onClick={canPlay?(()=>handlePlayCard(card)):undefined}
                  />
                </div>
              )
            })}
          </div>
          {turn===0&&phase==='playing'&&<div style={{fontSize:12,color:'#22d3ee',textAlign:'center',marginTop:2}}>
            {myHand.filter(c=>bestCapture(c,table)!==null).length>0
              ?`${myHand.filter(c=>bestCapture(c,table)!==null).length} card(s) can capture — click to play!`
              :'No captures available — play any card to add to table'}
          </div>}
        </div>
      </div>
    </div>
  )
}
