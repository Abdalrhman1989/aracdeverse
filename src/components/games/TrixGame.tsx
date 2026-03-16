"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type Card = { suit: Suit; rank: Rank }
type Kingdom = 'trix' | 'diamonds' | 'ladies' | 'ltoush'
type Diff = 'easy' | 'medium' | 'hard'
type Phase = 'start' | 'kingdom-select' | 'playing' | 'trick-end' | 'round-end' | 'gameover'

const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const SUITS: Suit[] = ['S','H','D','C']
const RANK_VAL: Record<Rank,number> = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14}
const SUIT_DISP: Record<Suit,string> = {S:'♠',H:'♥',D:'♦',C:'♣'}
const SUIT_COLOR: Record<Suit,string> = {S:'#c7d2fe',H:'#fca5a5',D:'#fca5a5',C:'#c7d2fe'}
const KINGDOM_LABELS: Record<Kingdom,string> = { trix:'Trix', diamonds:'Diamonds', ladies:'Ladies', ltoush:'Ltoush' }
const KINGDOM_ICONS: Record<Kingdom,string> = { trix:'👑', diamonds:'💎', ladies:'👸', ltoush:'🤚' }
const KINGDOM_DESC: Record<Kingdom,string> = {
  trix:'Avoid J♦(-80) J♣(-80) Q♠(-80) K♥(-160)',
  diamonds:'Each Diamond card = -20 pts',
  ladies:'Each Queen = -40 pts',
  ltoush:'Each trick taken = -40 pts'
}
const PLAYER_NAMES = ['You','West','North','East']
const PLAYER_POS = ['bottom','left','top','right']

function makeDeck(): Card[] {
  const d: Card[] = []
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r})
  return d.sort(()=>Math.random()-0.5)
}

function dealHands(deck: Card[]): Card[][] {
  return [deck.slice(0,13),deck.slice(13,26),deck.slice(26,39),deck.slice(39,52)]
}

function cardPenalty(card: Card, kingdom: Kingdom): number {
  if(kingdom==='trix'){
    if(card.rank==='J'&&card.suit==='D') return -80
    if(card.rank==='J'&&card.suit==='C') return -80
    if(card.rank==='Q'&&card.suit==='S') return -80
    if(card.rank==='K'&&card.suit==='H') return -160
  }
  if(kingdom==='diamonds'&&card.suit==='D') return -20
  if(kingdom==='ladies'&&card.rank==='Q') return -40
  return 0
}

function trickPenalty(tricks: Card[], kingdom: Kingdom): number {
  if(kingdom==='ltoush') return -40
  return tricks.reduce((sum,c)=>sum+cardPenalty(c,kingdom),0)
}

function hasPenaltyCard(hand: Card[], kingdom: Kingdom): boolean {
  return hand.some(c=>cardPenalty(c,kingdom)<0)
}

function getAICard(hand: Card[], led: Suit|null, trickCards: (Card|null)[], kingdom: Kingdom, difficulty: Diff): Card {
  const followable = led ? hand.filter(c=>c.suit===led) : hand
  const playable = followable.length > 0 ? followable : hand
  if(difficulty==='easy') return playable[Math.floor(Math.random()*playable.length)]
  const safe = playable.filter(c=>cardPenalty(c,kingdom)===0)
  if(safe.length>0){
    if(difficulty==='hard') return safe.sort((a,b)=>RANK_VAL[a.rank]-RANK_VAL[b.rank])[0]
    return safe[Math.floor(Math.random()*safe.length)]
  }
  return playable.sort((a,b)=>Math.abs(cardPenalty(a,kingdom))-Math.abs(cardPenalty(b,kingdom)))[0]
}

function winnerIndex(trick: Card[], led: Suit): number {
  let best = 0
  for(let i=1;i<trick.length;i++){
    if(trick[i].suit===led&&(trick[best].suit!==led||RANK_VAL[trick[i].rank]>RANK_VAL[trick[best].rank])) best=i
  }
  return best
}

function getValidCards(hand: Card[], led: Suit|null): Card[] {
  if(!led) return hand
  const follow = hand.filter(c=>c.suit===led)
  return follow.length>0 ? follow : hand
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a,b)=>{
    const si = SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)
    if(si!==0) return si
    return RANK_VAL[a.rank]-RANK_VAL[b.rank]
  })
}

function CardFace({card,small=false,highlight=false,penalty=0,onClick}:{card:Card,small?:boolean,highlight?:boolean,penalty?:number,onClick?:()=>void}){
  const color = SUIT_COLOR[card.suit]
  const bg = highlight ? 'rgba(250,204,21,0.18)' : 'rgba(255,255,255,0.07)'
  const border = highlight ? '2px solid #facc15' : '1.5px solid rgba(255,255,255,0.18)'
  const size = small ? {w:38,h:54,fs:'10px',fs2:'14px'} : {w:56,h:78,fs:'13px',fs2:'20px'}
  return (
    <div
      onClick={onClick}
      style={{
        width:size.w,height:size.h,borderRadius:7,background:bg,border,
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        cursor:onClick?'pointer':'default',position:'relative',
        boxShadow:highlight?'0 0 12px 2px #facc1566':'0 2px 8px rgba(0,0,0,0.3)',
        transition:'transform 0.15s,box-shadow 0.15s',
        userSelect:'none',
      }}
      className={onClick?'card-hover':''}
    >
      <div style={{fontSize:size.fs,fontWeight:700,color,lineHeight:1}}>{card.rank}</div>
      <div style={{fontSize:size.fs2,color,lineHeight:1}}>{SUIT_DISP[card.suit]}</div>
      {penalty<0&&<div style={{position:'absolute',bottom:2,right:3,fontSize:'9px',color:'#f87171',fontWeight:700}}>{penalty}</div>}
    </div>
  )
}

function CardBack({small=false}:{small?:boolean}){
  const size = small ? {w:38,h:54} : {w:56,h:78}
  return (
    <div style={{
      width:size.w,height:size.h,borderRadius:7,
      background:'linear-gradient(135deg,#3730a3 0%,#1e1b4b 100%)',
      border:'1.5px solid rgba(255,255,255,0.15)',
      boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
      display:'flex',alignItems:'center',justifyContent:'center',
    }}>
      <div style={{fontSize:18,opacity:0.5}}>🂠</div>
    </div>
  )
}

interface GameState {
  hands: Card[][]
  scores: number[]
  roundScores: number[]
  trickCards: (Card|null)[]
  currentPlayer: number
  leadSuit: Suit|null
  leadPlayer: number
  trickCount: number[]
  kingdom: Kingdom|null
  kingdoms: Kingdom[]
  kingdomChooser: number
  phase: Phase
  roundNum: number
  dealer: number
  message: string
  playedOrder: number[]
  trickWinner: number|null
  totalScores: number[]
}

export default function TrixGame({ onScoreUpdate, onGameOver, onGameStart }:GameComponentProps){
  const [difficulty, setDifficulty] = useState<Diff|null>(null)
  const [gameState, setGameState] = useState<GameState|null>(null)
  const aiTimerRef = useRef<NodeJS.Timeout|null>(null)
  const [animatingCard, setAnimatingCard] = useState<number|null>(null)
  const [trickFlash, setTrickFlash] = useState<{winner:number,penalty:number}|null>(null)

  const initGame = useCallback((diff: Diff)=>{
    const deck = makeDeck()
    const hands = dealHands(deck)
    const gs: GameState = {
      hands,
      scores:[0,0,0,0],
      roundScores:[0,0,0,0],
      trickCards:[null,null,null,null],
      currentPlayer:0,
      leadSuit:null,
      leadPlayer:0,
      trickCount:[0,0,0,0],
      kingdom:null,
      kingdoms:[],
      kingdomChooser:0,
      phase:'kingdom-select',
      roundNum:0,
      dealer:0,
      message:'Choose a kingdom to play!',
      playedOrder:[],
      trickWinner:null,
      totalScores:[0,0,0,0],
    }
    setGameState(gs)
    setDifficulty(diff)
  },[])

  const selectKingdom = useCallback((k: Kingdom)=>{
    if(!gameState) return
    const gs = {...gameState}
    const newKingdoms = [...gs.kingdoms, k]
    gs.kingdoms = newKingdoms
    if(newKingdoms.length===1){
      // Only player 0 selects, then start
      gs.kingdom = k
      gs.phase = 'playing'
      gs.currentPlayer = 0
      gs.leadPlayer = 0
      gs.leadSuit = null
      gs.trickCards = [null,null,null,null]
      gs.trickCount = [0,0,0,0]
      gs.roundScores = [0,0,0,0]
      gs.message = `${KINGDOM_ICONS[k]} ${KINGDOM_LABELS[k]} Kingdom — Your turn!`
    }
    setGameState(gs)
  },[gameState])

  const playCard = useCallback((cardIndex: number)=>{
  sfxCardPlay()
    if(!gameState||!gameState.kingdom) return
    if(gameState.phase!=='playing') return
    if(gameState.currentPlayer!==0) return
    const gs = JSON.parse(JSON.stringify(gameState)) as GameState
    const hand = gs.hands[0]
    const valid = getValidCards(hand, gs.leadSuit)
    const card = hand[cardIndex]
    if(!valid.find(c=>c.suit===card.suit&&c.rank===card.rank)) return

    gs.hands[0] = hand.filter((_,i)=>i!==cardIndex)
    gs.trickCards[0] = card
    gs.playedOrder = [...gs.playedOrder, 0]
    if(gs.leadSuit===null) gs.leadSuit = card.suit
    gs.currentPlayer = 1
    setAnimatingCard(0)
    setTimeout(()=>setAnimatingCard(null),400)
    setGameState(gs)
  },[gameState])

  // AI turns
  useEffect(()=>{
    if(!gameState||!difficulty) return
    if(gameState.phase!=='playing') return
    if(gameState.currentPlayer===0) return

    const p = gameState.currentPlayer
    const delay = 700 + Math.random()*300

    aiTimerRef.current = setTimeout(()=>{
      setGameState(prev=>{
        if(!prev||!prev.kingdom) return prev
        if(prev.currentPlayer!==p) return prev
        const gs = JSON.parse(JSON.stringify(prev)) as GameState
        const hand = gs.hands[p]
        if(hand.length===0) return prev
        const card = getAICard(hand, gs.leadSuit, gs.trickCards, gs.kingdom!, difficulty)
        const idx = hand.findIndex(c=>c.suit===card.suit&&c.rank===card.rank)
        gs.hands[p] = hand.filter((_,i)=>i!==idx)
        gs.trickCards[p] = card
        gs.playedOrder = [...gs.playedOrder, p]
        if(gs.leadSuit===null) gs.leadSuit = card.suit
        const nextP = (p+1)%4
        const allPlayed = gs.trickCards.every(c=>c!==null)
        if(allPlayed){
          // Resolve trick
          const trick = gs.playedOrder.map(pi=>gs.trickCards[pi]!) 
          const relWinner = winnerIndex(trick, gs.leadSuit!)
          const absWinner = gs.playedOrder[relWinner]
          const pen = trickPenalty(gs.trickCards.filter(Boolean) as Card[], gs.kingdom!)
          gs.roundScores[absWinner] += pen
          gs.trickCount[absWinner]++
          gs.trickWinner = absWinner
          gs.phase = 'trick-end'
          const pname = PLAYER_NAMES[absWinner]
          gs.message = `${pname} wins the trick! ${pen<0?`(${pen} pts)`:''}`
          setTimeout(()=>{
            if (absWinner === 0) sfxWin()
  setTrickFlash({winner:absWinner,penalty:pen})
            setTimeout(()=>setTrickFlash(null),900)
          },100)
        } else {
          gs.currentPlayer = nextP
        }
        return gs
      })
    }, delay)

    return ()=>{ if(aiTimerRef.current) clearTimeout(aiTimerRef.current) }
  },[gameState?.currentPlayer, gameState?.phase, difficulty])

  // Handle trick-end
  useEffect(()=>{
    if(!gameState||gameState.phase!=='trick-end') return
    const timer = setTimeout(()=>{
      setGameState(prev=>{
        if(!prev) return prev
        const gs = JSON.parse(JSON.stringify(prev)) as GameState
        const winner = gs.trickWinner!
        gs.trickCards = [null,null,null,null]
        gs.playedOrder = []
        gs.leadSuit = null
        gs.leadPlayer = winner
        gs.trickWinner = null
        // Check if round over
        if(gs.hands.every(h=>h.length===0)){
          gs.phase = 'round-end'
          // Apply round scores
          for(let i=0;i<4;i++) gs.totalScores[i] += gs.roundScores[i]
          // Check if any player lost (reached -200)
          const loser = gs.totalScores.findIndex(s=>s<=-200)
          if(loser>=0){
            gs.phase = 'gameover'
            if (loser !== 0) sfxVictory(); else sfxGameOver()
            gs.message = `${PLAYER_NAMES[loser]} is eliminated! Game Over!`
          } else {
            // Check if all 4 kingdoms played
            if(gs.roundNum>=3){
              gs.phase = 'gameover'
              const maxScore = Math.max(...gs.totalScores)
              const winner = gs.totalScores.indexOf(maxScore)
              if (winner === 0) sfxVictory(); else sfxGameOver()
              gs.message = `Game Over! ${PLAYER_NAMES[winner]} wins with ${maxScore} pts!`
            } else {
              gs.roundNum++
              gs.message = `Round ${gs.roundNum+1}: Choose a new kingdom!`
            }
          }
        } else {
          gs.currentPlayer = winner
          gs.phase = 'playing'
          gs.message = winner===0 ? 'Your turn! You won the trick.' : `${PLAYER_NAMES[winner]}'s turn.`
        }
        return gs
      })
    }, 1200)
    return ()=>clearTimeout(timer)
  },[gameState?.phase])

  // Handle round-end -> new round
  useEffect(()=>{
    if(!gameState||gameState.phase!=='round-end') return
    const timer = setTimeout(()=>{
      setGameState(prev=>{
        if(!prev) return prev
        const gs = JSON.parse(JSON.stringify(prev)) as GameState
        const deck = makeDeck()
        const newHands = dealHands(deck)
        gs.hands = newHands
        gs.kingdoms = []
        gs.kingdom = null
        gs.trickCards = [null,null,null,null]
        gs.roundScores = [0,0,0,0]
        gs.trickCount = [0,0,0,0]
        gs.leadSuit = null
        gs.playedOrder = []
        gs.trickWinner = null
        gs.phase = 'kingdom-select'
        gs.currentPlayer = 0
        gs.leadPlayer = 0
        gs.message = 'Choose a kingdom for this round!'
        return gs
      })
    }, 2500)
    return ()=>clearTimeout(timer)
  },[gameState?.phase])

  // When player plays, check if trick is done (after player 0 plays)
  useEffect(()=>{
    if(!gameState||gameState.phase!=='playing') return
    if(gameState.currentPlayer!==1) return
    // Check if all played (player 0 just played and it was last)
    if(gameState.trickCards.every(c=>c!==null)){
      const gs = JSON.parse(JSON.stringify(gameState)) as GameState
      const trick = gs.playedOrder.map(pi=>gs.trickCards[pi]!) 
      const relWinner = winnerIndex(trick, gs.leadSuit!)
      const absWinner = gs.playedOrder[relWinner]
      const pen = trickPenalty(gs.trickCards.filter(Boolean) as Card[], gs.kingdom!)
      gs.roundScores[absWinner] += pen
      gs.trickCount[absWinner]++
      gs.trickWinner = absWinner
      gs.phase = 'trick-end'
      gs.message = `${PLAYER_NAMES[absWinner]} wins the trick! ${pen<0?`(${pen} pts)`:''}`
      setGameState(gs)
    }
  },[gameState?.trickCards])

  const restartGame = ()=>{
    setDifficulty(null)
    setGameState(null)
  }

  // Start screen
  if(!difficulty){
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:64,marginBottom:8}}>🃏</div>
          <h1 style={{fontSize:42,fontWeight:900,margin:0,background:'linear-gradient(90deg,#a78bfa,#818cf8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>TRIX</h1>
          <p style={{color:'#94a3b8',marginTop:8,fontSize:18}}>The Classic Middle Eastern Card Game</p>
        </div>
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:16,padding:'32px 40px',border:'1px solid rgba(255,255,255,0.1)',maxWidth:480,width:'100%'}}>
          <h2 style={{margin:'0 0 8px',fontSize:20,color:'#e2e8f0'}}>How to Play</h2>
          <p style={{color:'#94a3b8',fontSize:14,margin:'0 0 20px'}}>4 players, 13 cards each. Choose a kingdom to play and avoid penalty cards!</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:28}}>
            {(Object.keys(KINGDOM_LABELS) as Kingdom[]).map(k=>(
              <div key={k} style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(255,255,255,0.08)'}}>
                <div style={{fontSize:18}}>{KINGDOM_ICONS[k]}</div>
                <div style={{fontWeight:700,fontSize:14,color:'#e2e8f0'}}>{KINGDOM_LABELS[k]}</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{KINGDOM_DESC[k]}</div>
              </div>
            ))}
          </div>
          <h3 style={{margin:'0 0 12px',color:'#e2e8f0',fontSize:16}}>Select Difficulty</h3>
          <div style={{display:'flex',gap:10}}>
            {(['easy','medium','hard'] as Diff[]).map(d=>(
              <button key={d} onClick={()=>initGame(d)} style={{
                flex:1,padding:'14px 0',borderRadius:10,border:'none',cursor:'pointer',fontWeight:700,fontSize:16,
                background:d==='easy'?'linear-gradient(135deg,#22c55e,#16a34a)':d==='medium'?'linear-gradient(135deg,#f59e0b,#d97706)':'linear-gradient(135deg,#ef4444,#dc2626)',
                color:'white',transition:'opacity 0.2s',
              }}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if(!gameState) return null

  const {hands,scores,trickCards,currentPlayer,leadSuit,kingdom,phase,roundScores,totalScores,trickCount,message,playedOrder} = gameState

  const myHand = sortCards(hands[0])
  const validCards = phase==='playing'&&currentPlayer===0 ? getValidCards(myHand, leadSuit) : []

  const penaltyCards = kingdom ? {
    trix:[{s:'D',r:'J'},{s:'C',r:'J'},{s:'S',r:'Q'},{s:'H',r:'K'}],
    diamonds:SUITS.flatMap(()=>[]),
    ladies:[],
    ltoush:[],
  } : {}

  // Game over screen
  if(phase==='gameover'){
    const maxS = Math.max(...totalScores)
    const winner = totalScores.indexOf(maxS)
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e1b4b)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'system-ui,sans-serif',padding:20}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:72}}>{winner===0?'🏆':'😔'}</div>
          <h1 style={{fontSize:36,fontWeight:900,margin:'8px 0',color:winner===0?'#facc15':'#f87171'}}>{winner===0?'You Win!':'Game Over'}</h1>
          <p style={{color:'#94a3b8',fontSize:18}}>{message}</p>
        </div>
        <div style={{background:'rgba(255,255,255,0.06)',borderRadius:16,padding:28,minWidth:320,border:'1px solid rgba(255,255,255,0.1)'}}>
          <h3 style={{margin:'0 0 16px',color:'#e2e8f0',textAlign:'center'}}>Final Scores</h3>
          {totalScores.map((s,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<3?'1px solid rgba(255,255,255,0.06)':'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>{i===0?'🧑':i===1?'🤖':i===2?'🤖':'🤖'}</span>
                <span style={{fontWeight:600,color:i===winner?'#facc15':'#e2e8f0'}}>{PLAYER_NAMES[i]}</span>
                {i===winner&&<span style={{fontSize:12,background:'#facc1533',color:'#facc15',padding:'2px 8px',borderRadius:999}}>Winner</span>}
              </div>
              <span style={{fontWeight:700,fontSize:20,color:s<0?'#f87171':'#4ade80'}}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:12,marginTop:24}}>
          <button onClick={()=>initGame(difficulty!)} style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)',color:'white',border:'none',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:15}}>Play Again</button>
          <button onClick={restartGame} style={{background:'rgba(255,255,255,0.08)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.15)',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontSize:15}}>Menu</button>
        </div>
      </div>
    )
  }

  // Kingdom selection screen
  if(phase==='kingdom-select'){
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e1b4b)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'system-ui,sans-serif',padding:20}}>
        <div style={{marginBottom:24,textAlign:'center'}}>
          <div style={{color:'#94a3b8',fontSize:14,marginBottom:4}}>Round {gameState.roundNum+1} / 4</div>
          <h2 style={{margin:0,fontSize:28,fontWeight:800,color:'#e2e8f0'}}>Choose Your Kingdom</h2>
          <p style={{color:'#64748b',marginTop:4,fontSize:14}}>Select the kingdom you want to play this round</p>
        </div>
        {/* Show hand preview */}
        <div style={{display:'flex',gap:6,marginBottom:28,flexWrap:'wrap',justifyContent:'center',maxWidth:520}}>
          {sortCards(hands[0]).map((card,i)=>(
            <CardFace key={i} card={card} small penalty={kingdom?cardPenalty(card,kingdom):0}/>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,maxWidth:480,width:'100%'}}>
          {(Object.keys(KINGDOM_LABELS) as Kingdom[]).map(k=>(
            <button key={k} onClick={()=>selectKingdom(k)} style={{
              background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.12)',
              borderRadius:14,padding:'20px 16px',cursor:'pointer',color:'white',
              transition:'background 0.2s,border-color 0.2s',textAlign:'left',
            }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(99,102,241,0.2)';(e.currentTarget as HTMLButtonElement).style.borderColor='#6366f1'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.05)';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.12)'}}
            >
              <div style={{fontSize:28,marginBottom:6}}>{KINGDOM_ICONS[k]}</div>
              <div style={{fontWeight:700,fontSize:17,color:'#e2e8f0',marginBottom:4}}>{KINGDOM_LABELS[k]}</div>
              <div style={{fontSize:12,color:'#64748b'}}>{KINGDOM_DESC[k]}</div>
            </button>
          ))}
        </div>
        {/* Scores summary */}
        <div style={{marginTop:28,display:'flex',gap:16}}>
          {totalScores.map((s,i)=>(
            <div key={i} style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'8px 16px',border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontSize:11,color:'#64748b'}}>{PLAYER_NAMES[i]}</div>
              <div style={{fontWeight:700,color:s<0?'#f87171':'#4ade80',fontSize:18}}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Main game table
  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(135deg,#0f172a 0%,#1a1040 50%,#0f172a 100%)',
      display:'flex',flexDirection:'column',
      fontFamily:'system-ui,sans-serif',color:'white',
      userSelect:'none',overflow:'hidden',
    }}>
      <style>{`
        .card-hover:hover { transform: translateY(-6px) scale(1.05); box-shadow: 0 8px 24px rgba(99,102,241,0.4) !important; }
        @keyframes slideIn { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        @keyframes flashWin { 0%{background:rgba(250,204,21,0.3)} 50%{background:rgba(250,204,21,0.6)} 100%{background:rgba(250,204,21,0.3)} }
      `}</style>

      {/* Top bar */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px',background:'rgba(0,0,0,0.3)',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontWeight:800,fontSize:18,color:'#a78bfa'}}>TRIX</div>
          {kingdom&&<div style={{background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.4)',borderRadius:20,padding:'4px 14px',fontSize:13,color:'#a5b4fc'}}>{KINGDOM_ICONS[kingdom]} {KINGDOM_LABELS[kingdom]}</div>}
        </div>
        <div style={{display:'flex',gap:10}}>
          {totalScores.map((s,i)=>(
            <div key={i} style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'4px 12px',border:`1px solid ${currentPlayer===i&&phase==='playing'?'rgba(250,204,21,0.5)':'rgba(255,255,255,0.08)'}`}}>
              <div style={{fontSize:10,color:'#64748b'}}>{PLAYER_NAMES[i]}</div>
              <div style={{fontWeight:700,fontSize:16,color:s<0?'#f87171':'#4ade80'}}>{s}</div>
              {roundScores[i]!==0&&<div style={{fontSize:10,color:'#94a3b8'}}>({roundScores[i]>0?'+':''}{roundScores[i]})</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Game table */}
      <div style={{flex:1,display:'grid',gridTemplateRows:'auto 1fr auto',gridTemplateColumns:'auto 1fr auto',gap:0,padding:'10px',position:'relative'}}>
        
        {/* Top player (North - index 2) */}
        <div style={{gridColumn:'1/4',gridRow:'1',display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0'}}>
          <div style={{fontSize:11,color:currentPlayer===2?'#facc15':'#64748b',marginBottom:6,fontWeight:600}}>{PLAYER_NAMES[2]} {currentPlayer===2&&phase==='playing'?'▾':''}</div>
          <div style={{display:'flex',gap:3}}>
            {hands[2].map((_,i)=><CardBack key={i} small/>)}
          </div>
        </div>

        {/* Left player (West - index 1) */}
        <div style={{gridColumn:'1',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,padding:'0 8px'}}>
          <div style={{fontSize:11,color:currentPlayer===1?'#facc15':'#64748b',marginBottom:4,fontWeight:600,writingMode:'vertical-lr',transform:'rotate(180deg)'}}>{PLAYER_NAMES[1]}</div>
          <div style={{display:'flex',flexDirection:'column',gap:3}}>
            {hands[1].map((_,i)=><CardBack key={i} small/>)}
          </div>
        </div>

        {/* Center play area */}
        <div style={{
          gridColumn:'2',gridRow:'2',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          position:'relative',
          background:'radial-gradient(ellipse at center,rgba(30,27,75,0.6) 0%,rgba(15,23,42,0.3) 100%)',
          borderRadius:20,margin:8,
          border:'1px solid rgba(255,255,255,0.05)',
        }}>
          {/* Kingdom info */}
          {kingdom&&<div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',fontSize:12,color:'#6366f1',background:'rgba(99,102,241,0.1)',padding:'4px 12px',borderRadius:20,border:'1px solid rgba(99,102,241,0.2)',whiteSpace:'nowrap'}}>
            {KINGDOM_ICONS[kingdom]} {KINGDOM_DESC[kingdom]}
          </div>}

          {/* Trick flash */}
          {trickFlash&&<div style={{
            position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
            background:trickFlash.penalty<0?'rgba(239,68,68,0.3)':'rgba(99,102,241,0.3)',
            borderRadius:12,padding:'12px 24px',fontSize:18,fontWeight:700,
            color:trickFlash.penalty<0?'#f87171':'#a5b4fc',
            border:`1px solid ${trickFlash.penalty<0?'rgba(239,68,68,0.5)':'rgba(99,102,241,0.5)'}`,
            zIndex:10,animation:'slideIn 0.3s ease',
          }}>
            {PLAYER_NAMES[trickFlash.winner]} wins! {trickFlash.penalty!==0&&`${trickFlash.penalty} pts`}
          </div>}

          {/* Cards on table - 4 positions */}
          <div style={{display:'grid',gridTemplateColumns:'80px 80px',gridTemplateRows:'80px 80px',gap:12,alignItems:'center',justifyItems:'center'}}>
            {/* North card (player 2) */}
            <div style={{gridColumn:'1/3',display:'flex',justifyContent:'center'}}>
              {trickCards[2] ? <div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[2]} penalty={kingdom?cardPenalty(trickCards[2],kingdom):0}/></div> : <div style={{width:56,height:78,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.1)'}}/>}
            </div>
            {/* West card (player 1) */}
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              {trickCards[1] ? <div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[1]} penalty={kingdom?cardPenalty(trickCards[1],kingdom):0}/></div> : <div style={{width:56,height:78,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.1)'}}/>}
            </div>
            {/* East card (player 3) */}
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              {trickCards[3] ? <div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[3]} penalty={kingdom?cardPenalty(trickCards[3],kingdom):0}/></div> : <div style={{width:56,height:78,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.1)'}}/>}
            </div>
            {/* South card (player 0 - You) */}
            <div style={{gridColumn:'1/3',display:'flex',justifyContent:'center'}}>
              {trickCards[0] ? <div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[0]} penalty={kingdom?cardPenalty(trickCards[0],kingdom):0}/></div> : <div style={{width:56,height:78,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.1)'}}/>}
            </div>
          </div>

          {/* Lead suit indicator */}
          {leadSuit&&<div style={{position:'absolute',bottom:10,right:14,fontSize:12,color:'#94a3b8'}}>
            Lead: <span style={{color:SUIT_COLOR[leadSuit],fontWeight:700}}>{SUIT_DISP[leadSuit]}</span>
          </div>}

          {/* Trick counts */}
          <div style={{position:'absolute',bottom:10,left:10,display:'flex',gap:6}}>
            {trickCount.map((t,i)=>(
              <div key={i} style={{fontSize:10,color:'#64748b',textAlign:'center'}}>
                <div>{PLAYER_NAMES[i]}</div>
                <div style={{color:'#94a3b8',fontWeight:600}}>{t}T</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right player (East - index 3) */}
        <div style={{gridColumn:'3',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,padding:'0 8px'}}>
          <div style={{fontSize:11,color:currentPlayer===3?'#facc15':'#64748b',marginBottom:4,fontWeight:600,writingMode:'vertical-lr'}}>{PLAYER_NAMES[3]}</div>
          <div style={{display:'flex',flexDirection:'column',gap:3}}>
            {hands[3].map((_,i)=><CardBack key={i} small/>)}
          </div>
        </div>

        {/* Bottom - Your hand */}
        <div style={{gridColumn:'1/4',gridRow:'3',padding:'8px 0 4px'}}>
          {/* Message */}
          <div style={{textAlign:'center',marginBottom:10,fontSize:14,color:'#94a3b8',minHeight:20}}>
            <span style={{background:'rgba(255,255,255,0.05)',borderRadius:20,padding:'4px 16px'}}>{message}</span>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap',padding:'0 16px'}}>
            {myHand.map((card,i)=>{
              const isValid = validCards.some(c=>c.suit===card.suit&&c.rank===card.rank)
              const pen = kingdom ? cardPenalty(card,kingdom) : 0
              const origIdx = hands[0].findIndex(c=>c.suit===card.suit&&c.rank===card.rank)
              return (
                <CardFace
                  key={`${card.suit}${card.rank}`}
                  card={card}
                  highlight={isValid&&currentPlayer===0&&phase==='playing'}
                  penalty={pen}
                  onClick={isValid&&currentPlayer===0&&phase==='playing' ? ()=>playCard(origIdx) : undefined}
                />
              )
            })}
          </div>
          {currentPlayer===0&&phase==='playing'&&<div style={{textAlign:'center',marginTop:6,fontSize:12,color:'#facc15'}}>
            {leadSuit ? `Must follow ${SUIT_DISP[leadSuit]} if possible` : 'Lead any card'}
          </div>}
        </div>
      </div>
    </div>
  )
}
