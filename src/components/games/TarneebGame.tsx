"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type Card = { suit: Suit; rank: Rank }
type Diff = 'easy' | 'medium' | 'hard'
type Phase = 'start' | 'bidding' | 'playing' | 'trick-end' | 'round-end' | 'gameover'
type Team = 0 | 1 // 0 = You+North (players 0,2), 1 = West+East (players 1,3)

const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const SUITS: Suit[] = ['S','H','D','C']
const RANK_VAL: Record<Rank,number> = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14}
const SUIT_DISP: Record<Suit,string> = {S:'♠',H:'♥',D:'♦',C:'♣'}
const SUIT_LABELS: Record<Suit,string> = {S:'Spades',H:'Hearts',D:'Diamonds',C:'Clubs'}
const SUIT_COLOR: Record<Suit,string> = {S:'#c7d2fe',H:'#fca5a5',D:'#fca5a5',C:'#c7d2fe'}
const PLAYER_NAMES = ['You','West','North','East']
const TEAM_NAMES = ['You & North','West & East']
const WIN_SCORE = 31

function makeDeck(): Card[] {
  const d: Card[] = []
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r})
  return d.sort(()=>Math.random()-0.5)
}

function dealHands(deck: Card[]): Card[][] {
  return [deck.slice(0,13),deck.slice(13,26),deck.slice(26,39),deck.slice(39,52)]
}

function sortCards(cards: Card[], trump: Suit|null): Card[] {
  return [...cards].sort((a,b)=>{
    const aT = a.suit===trump?1:0, bT = b.suit===trump?1:0
    if(aT!==bT) return bT-aT
    const si = SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)
    if(si!==0) return si
    return RANK_VAL[a.rank]-RANK_VAL[b.rank]
  })
}

function countHighCards(hand: Card[], trump: Suit|null): number {
  return hand.filter(c=>{
    if(trump&&c.suit===trump&&(c.rank==='A'||c.rank==='K'||c.rank==='Q')) return true
    if(c.rank==='A') return true
    return false
  }).length
}

function estimateTricks(hand: Card[], trump: Suit|null): number {
  let tricks = 0
  const bySuit: Record<Suit,Card[]> = {S:[],H:[],D:[],C:[]}
  hand.forEach(c=>bySuit[c.suit].push(c))
  for(const s of SUITS){
    const cards = bySuit[s].sort((a,b)=>RANK_VAL[b.rank]-RANK_VAL[a.rank])
    if(s===trump){
      // Trump tricks
      tricks += Math.min(cards.length, cards.filter(c=>RANK_VAL[c.rank]>=11).length + (cards.length>=4?1:0))
    } else {
      if(cards[0]?.rank==='A') tricks++
      if(cards[0]?.rank==='A'&&cards[1]?.rank==='K') tricks++
    }
  }
  return Math.max(0, Math.min(13, tricks))
}

function getAIBid(hand: Card[], bids: (number|'pass')[], playerIdx: number, difficulty: Diff): number|'pass' {
  if(difficulty==='easy') {
    if(Math.random()<0.4) return 'pass'
    return 7+Math.floor(Math.random()*4)
  }
  // Medium/Hard: estimate tricks
  let bestTrump: Suit = 'S'
  let bestEst = 0
  for(const s of SUITS){
    const est = estimateTricks(hand, s)
    if(est>bestEst){bestEst=est;bestTrump=s}
  }
  const maxPrevBid = Math.max(...bids.filter(b=>typeof b==='number').map(b=>b as number), 6)
  if(bestEst < 7) return 'pass'
  const bid = Math.max(7, Math.min(13, bestEst+(difficulty==='hard'?0:-1)))
  if(bid<=maxPrevBid) return 'pass'
  return bid
}

function getAICard(hand: Card[], led: Suit|null, trump: Suit|null, trickCards: (Card|null)[], difficulty: Diff): Card {
  const followable = led ? hand.filter(c=>c.suit===led) : hand
  const playable = followable.length>0 ? followable : hand
  if(difficulty==='easy') return playable[Math.floor(Math.random()*playable.length)]
  // Medium: try to win trick if it's winning, else play low
  const sorted = [...playable].sort((a,b)=>RANK_VAL[a.rank]-RANK_VAL[b.rank])
  if(difficulty==='medium') return sorted[Math.floor(Math.random()<0.5?0:sorted.length-1)]
  // Hard: play highest card in suit if following, else trump if possible
  if(led&&hand.some(c=>c.suit===led)){
    return playable.sort((a,b)=>RANK_VAL[b.rank]-RANK_VAL[a.rank])[0]
  }
  if(trump){
    const trumpCards = hand.filter(c=>c.suit===trump)
    if(trumpCards.length>0) return trumpCards.sort((a,b)=>RANK_VAL[a.rank]-RANK_VAL[b.rank])[0]
  }
  return sorted[0]
}

function winnerIndex(trick: Card[], led: Suit, trump: Suit|null): number {
  let best = 0
  for(let i=1;i<trick.length;i++){
    const curr = trick[i], prev = trick[best]
    const currTrump = trump&&curr.suit===trump
    const prevTrump = trump&&prev.suit===trump
    if(currTrump&&!prevTrump){best=i;continue}
    if(!currTrump&&prevTrump) continue
    if(curr.suit===led&&prev.suit!==led&&!prevTrump){best=i;continue}
    if(curr.suit===prev.suit&&RANK_VAL[curr.rank]>RANK_VAL[prev.rank]) best=i
  }
  return best
}

function getTeam(player: number): Team { return (player===0||player===2)?0:1 }

function CardFace({card,small=false,highlight=false,faded=false,onClick,trump}:{card:Card,small?:boolean,highlight?:boolean,faded?:boolean,onClick?:()=>void,trump?:Suit|null}){
  const color = SUIT_COLOR[card.suit]
  const isTrump = trump&&card.suit===trump
  const bg = highlight?'rgba(250,204,21,0.15)':isTrump?'rgba(99,102,241,0.15)':'rgba(255,255,255,0.07)'
  const border = highlight?'2px solid #facc15':isTrump?'1.5px solid rgba(99,102,241,0.5)':'1.5px solid rgba(255,255,255,0.15)'
  const size = small?{w:36,h:52,fs:'9px',fs2:'13px'}:{w:54,h:76,fs:'12px',fs2:'19px'}
  return (
    <div onClick={onClick} style={{
      width:size.w,height:size.h,borderRadius:7,background:bg,border,
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      cursor:onClick?'pointer':'default',opacity:faded?0.4:1,
      boxShadow:highlight?'0 0 12px 2px #facc1566':isTrump?'0 0 8px rgba(99,102,241,0.3)':'0 2px 8px rgba(0,0,0,0.3)',
      transition:'transform 0.15s',userSelect:'none',
    }} className={onClick?'card-hover':''}>
      <div style={{fontSize:size.fs,fontWeight:700,color,lineHeight:1}}>{card.rank}</div>
      <div style={{fontSize:size.fs2,color,lineHeight:1}}>{SUIT_DISP[card.suit]}</div>
    </div>
  )
}

function CardBack({small=false}:{small?:boolean}){
  const size = small?{w:36,h:52}:{w:54,h:76}
  return <div style={{width:size.w,height:size.h,borderRadius:7,background:'linear-gradient(135deg,#3730a3,#1e1b4b)',border:'1.5px solid rgba(255,255,255,0.1)',boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}/>
}

interface GameState {
  hands: Card[][]
  scores: number[]
  trickCards: (Card|null)[]
  currentPlayer: number
  leadSuit: Suit|null
  trump: Suit|null
  phase: Phase
  bids: (number|'pass')[]
  highBid: number
  highBidder: number
  bidder: number
  trickCount: number[]
  roundTrickCount: number[]
  playedOrder: number[]
  trickWinner: number|null
  message: string
  roundNum: number
  firstBidder: number
  bidPhasePlayer: number
  passCount: number
}

export default function TarneebGame({ onScoreUpdate, onGameOver, onGameStart }:GameComponentProps){
  const [difficulty, setDifficulty] = useState<Diff|null>(null)
  const [gameState, setGameState] = useState<GameState|null>(null)
  const aiTimerRef = useRef<NodeJS.Timeout|null>(null)
  const [trickFlash, setTrickFlash] = useState<{winner:number,team:Team}|null>(null)
  const [bidFlash, setBidFlash] = useState<string|null>(null)
  const [selectTrump, setSelectTrump] = useState(false)

  const initGame = useCallback((diff: Diff)=>{
    const deck = makeDeck()
    const hands = dealHands(deck)
    const gs: GameState = {
      hands,scores:[0,0],
      trickCards:[null,null,null,null],
      currentPlayer:0,leadSuit:null,trump:null,
      phase:'bidding',
      bids:[],highBid:6,highBidder:-1,bidder:-1,
      trickCount:[0,0,0,0],roundTrickCount:[0,0,0,0],
      playedOrder:[],trickWinner:null,
      message:'Bidding: Your turn! (bid 7-13 or pass)',
      roundNum:0,firstBidder:0,bidPhasePlayer:0,passCount:0,
    }
    setGameState(gs)
    setDifficulty(diff)
    setSelectTrump(false)
  },[])

  const placeBid = useCallback((bid: number|'pass')=>{
    if(!gameState||gameState.phase!=='bidding') return
    if(gameState.bidPhasePlayer!==0) return
    setGameState(prev=>{
      if(!prev) return prev
      const gs = JSON.parse(JSON.stringify(prev)) as GameState
      const newBids = [...gs.bids, bid]
      gs.bids = newBids
      if(bid!=='pass'){
        gs.highBid=bid as number
        gs.highBidder=0
        setBidFlash(`You bid ${bid}`)
      } else {
        setBidFlash('You passed')
      }
      setTimeout(()=>setBidFlash(null),1200)
      gs.bidPhasePlayer=1
      gs.passCount = bid==='pass' ? gs.passCount+1 : 0
      // Check if bidding done (3 passes or all 4 bid)
      const nonPass = newBids.filter(b=>b!=='pass')
      const passes = newBids.filter(b=>b==='pass').length
      if(passes===3&&nonPass.length===1 || newBids.length===4){
        if(gs.highBidder===-1){
          // All passed - redeal
          gs.message='All passed! Redealing...'
          gs.phase='round-end'
          return gs
        }
        gs.bidder=gs.highBidder
        gs.message=`${PLAYER_NAMES[gs.highBidder]} won bid at ${gs.highBid}! `+(gs.highBidder===0?'Choose trump suit!':'AI choosing trump...')
        if(gs.highBidder===0){
          gs.phase='bidding'
          setSelectTrump(true)
        } else {
          // AI picks trump
          const trumpSuit: Suit = SUITS.reduce((best,s)=>{
            const est = estimateTricks(gs.hands[gs.highBidder],s)
            const bestEst = estimateTricks(gs.hands[gs.highBidder],best)
            return est>bestEst?s:best
          },'S' as Suit)
          gs.trump=trumpSuit
          gs.phase='playing'
          gs.currentPlayer=gs.bidder
          gs.leadSuit=null
          gs.message=`Trump: ${SUIT_DISP[trumpSuit]} ${SUIT_LABELS[trumpSuit]}. ${PLAYER_NAMES[gs.bidder]}'s turn.`
        }
      } else {
        gs.message=`Bidding: Player ${PLAYER_NAMES[gs.bidPhasePlayer]}'s turn`
      }
      return gs
    })
  },[gameState])

  const chooseTrump = useCallback((s: Suit)=>{
    setSelectTrump(false)
    setGameState(prev=>{
      if(!prev) return prev
      const gs = JSON.parse(JSON.stringify(prev)) as GameState
      gs.trump=s
      gs.phase='playing'
      gs.currentPlayer=gs.bidder
      gs.leadSuit=null
      gs.message=`Trump: ${SUIT_DISP[s]} ${SUIT_LABELS[s]}. ${PLAYER_NAMES[gs.bidder]}'s turn!`
      return gs
    })
  },[])

  // AI bidding
  useEffect(()=>{
    if(!gameState||gameState.phase!=='bidding') return
    if(selectTrump) return
    const p = gameState.bidPhasePlayer
    if(p===0) return
    // Check if bidding phase is actually still going
    const nonPass = gameState.bids.filter(b=>b!=='pass')
    const passes = gameState.bids.filter(b=>b==='pass').length
    if(passes===3&&nonPass.length>=1) return
    if(gameState.bids.length>=4) return

    aiTimerRef.current = setTimeout(()=>{
      setGameState(prev=>{
        if(!prev||prev.phase!=='bidding'||selectTrump) return prev
        if(prev.bidPhasePlayer!==p) return prev
        const gs = JSON.parse(JSON.stringify(prev)) as GameState
        const bid = getAIBid(gs.hands[p], gs.bids, p, difficulty!)
        const newBids = [...gs.bids, bid]
        gs.bids=newBids
        if(bid!=='pass'&&typeof bid==='number'){
          gs.highBid=bid
          gs.highBidder=p
          setBidFlash(`${PLAYER_NAMES[p]} bids ${bid}`)
        } else {
          setBidFlash(`${PLAYER_NAMES[p]} passes`)
        }
        setTimeout(()=>setBidFlash(null),1200)
        gs.passCount = bid==='pass'?gs.passCount+1:0
        // Determine next bidder
        const nextP=(p+1)%4
        gs.bidPhasePlayer=nextP

        const curNonPass=newBids.filter(b=>b!=='pass')
        const curPasses=newBids.filter(b=>b==='pass').length
        const done=(curPasses===3&&curNonPass.length>=1)||newBids.length>=4
        if(done){
          if(gs.highBidder===-1){
            gs.message='All passed! Redealing...'
            gs.phase='round-end'
            return gs
          }
          gs.bidder=gs.highBidder
          if(gs.highBidder===0){
            gs.message=`You won the bid at ${gs.highBid}! Choose trump suit.`
            setSelectTrump(true)
          } else {
            const trumpSuit: Suit = SUITS.reduce((best,s)=>{
              const est=estimateTricks(gs.hands[gs.highBidder],s)
              const bestEst=estimateTricks(gs.hands[gs.highBidder],best)
              return est>bestEst?s:best
            },'S' as Suit)
            gs.trump=trumpSuit
            gs.phase='playing'
            gs.currentPlayer=gs.bidder
            gs.leadSuit=null
            gs.message=`Trump: ${SUIT_DISP[trumpSuit]} ${SUIT_LABELS[trumpSuit]}. ${PLAYER_NAMES[gs.bidder]}'s turn.`
          }
        } else {
          gs.message=nextP===0?`Bidding: Your turn! Current high bid: ${gs.highBid}`:`Bidding: ${PLAYER_NAMES[nextP]}'s turn...`
        }
        return gs
      })
    },800+Math.random()*400)

    return ()=>{if(aiTimerRef.current)clearTimeout(aiTimerRef.current)}
  },[gameState?.bidPhasePlayer, gameState?.phase, selectTrump, difficulty])

  // AI card playing
  useEffect(()=>{
    if(!gameState||gameState.phase!=='playing') return
    const p = gameState.currentPlayer
    if(p===0) return

    aiTimerRef.current = setTimeout(()=>{
      setGameState(prev=>{
        if(!prev||prev.phase!=='playing'||prev.currentPlayer!==p) return prev
        const gs = JSON.parse(JSON.stringify(prev)) as GameState
        const hand=gs.hands[p]
        if(hand.length===0) return prev
        const card=getAICard(hand,gs.leadSuit,gs.trump,gs.trickCards,difficulty!)
        const idx=hand.findIndex(c=>c.suit===card.suit&&c.rank===card.rank)
        gs.hands[p]=hand.filter((_,i)=>i!==idx)
        gs.trickCards[p]=card
        gs.playedOrder=[...gs.playedOrder,p]
        if(!gs.leadSuit) gs.leadSuit=card.suit
        const allPlayed=gs.trickCards.every(c=>c!==null)
        if(allPlayed){
          const trick=gs.playedOrder.map(pi=>gs.trickCards[pi]!)
          const relWin=winnerIndex(trick,gs.leadSuit!,gs.trump)
          const absWin=gs.playedOrder[relWin]
          const team=getTeam(absWin)
          gs.roundTrickCount[absWin]++
          gs.trickCount[absWin]++
          gs.trickWinner=absWin
          gs.phase='trick-end'
          gs.message=`${PLAYER_NAMES[absWin]} wins the trick!`
          if (absWin === 0) sfxWin()
    setTimeout(()=>{setTrickFlash({winner:absWin,team});setTimeout(()=>setTrickFlash(null),900)},100)
        } else {
          gs.currentPlayer=(p+1)%4
        }
        return gs
      })
    },700+Math.random()*300)
    return ()=>{if(aiTimerRef.current)clearTimeout(aiTimerRef.current)}
  },[gameState?.currentPlayer,gameState?.phase,difficulty])

  const playCard = useCallback((cardIndex:number)=>{
  sfxCardPlay()
    if(!gameState||gameState.phase!=='playing'||gameState.currentPlayer!==0) return
    const hand=gameState.hands[0]
    const led=gameState.leadSuit
    const followable=led?hand.filter(c=>c.suit===led):hand
    const playable=followable.length>0?followable:hand
    const card=sortCards(hand,gameState.trump)[cardIndex]
    if(!playable.find(c=>c.suit===card.suit&&c.rank===card.rank)) return

    setGameState(prev=>{
      if(!prev) return prev
      const gs=JSON.parse(JSON.stringify(prev)) as GameState
      const origIdx=gs.hands[0].findIndex(c=>c.suit===card.suit&&c.rank===card.rank)
      gs.hands[0]=gs.hands[0].filter((_,i)=>i!==origIdx)
      gs.trickCards[0]=card
      gs.playedOrder=[...gs.playedOrder,0]
      if(!gs.leadSuit) gs.leadSuit=card.suit
      const allPlayed=gs.trickCards.every(c=>c!==null)
      if(allPlayed){
        const trick=gs.playedOrder.map(pi=>gs.trickCards[pi]!)
        const relWin=winnerIndex(trick,gs.leadSuit!,gs.trump)
        const absWin=gs.playedOrder[relWin]
        const team=getTeam(absWin)
        gs.roundTrickCount[absWin]++
        gs.trickCount[absWin]++
        gs.trickWinner=absWin
        gs.phase='trick-end'
        gs.message=`${PLAYER_NAMES[absWin]} wins the trick!`
        setTimeout(()=>{setTrickFlash({winner:absWin,team});setTimeout(()=>setTrickFlash(null),900)},100)
      } else {
        gs.currentPlayer=1
      }
      return gs
    })
  },[gameState])

  // Handle trick-end
  useEffect(()=>{
    if(!gameState||gameState.phase!=='trick-end') return
    const timer=setTimeout(()=>{
      setGameState(prev=>{
        if(!prev) return prev
        const gs=JSON.parse(JSON.stringify(prev)) as GameState
        const winner=gs.trickWinner!
        gs.trickCards=[null,null,null,null]
        gs.playedOrder=[]
        gs.leadSuit=null
        gs.trickWinner=null

        if(gs.hands.every(h=>h.length===0)){
          // Round over - calculate scores
          const team0Tricks=gs.roundTrickCount[0]+gs.roundTrickCount[2]
          const team1Tricks=gs.roundTrickCount[1]+gs.roundTrickCount[3]
          const bidTeam=getTeam(gs.bidder)
          const bidTeamTricks=bidTeam===0?team0Tricks:team1Tricks
          const oppTricks=bidTeam===0?team1Tricks:team0Tricks
          if(bidTeamTricks>=gs.highBid){
            gs.scores[bidTeam]+=gs.highBid
          } else {
            gs.scores[bidTeam]-=gs.highBid
          }
          gs.scores[1-bidTeam]+=oppTricks
          gs.message=`Round over! ${TEAM_NAMES[bidTeam]} got ${bidTeamTricks}/${gs.highBid} tricks.`
          gs.phase='round-end'
          // Check win
          if(gs.scores[0]>=WIN_SCORE||gs.scores[1]>=WIN_SCORE){
            gs.phase='gameover'
            const w=gs.scores[0]>=WIN_SCORE?0:1
            if (w===0) sfxVictory(); else sfxGameOver()
            gs.message=`${TEAM_NAMES[w]} wins the game with ${gs.scores[w]} points!`
          }
        } else {
          gs.currentPlayer=winner
          gs.phase='playing'
          gs.message=winner===0?'Your turn!':(`${PLAYER_NAMES[winner]}'s turn.`)
        }
        return gs
      })
    },1200)
    return ()=>clearTimeout(timer)
  },[gameState?.phase])

  // Handle round-end -> new round
  useEffect(()=>{
    if(!gameState||gameState.phase!=='round-end') return
    const timer=setTimeout(()=>{
      setGameState(prev=>{
        if(!prev||prev.phase==='gameover') return prev
        const gs=JSON.parse(JSON.stringify(prev)) as GameState
        const deck=makeDeck()
        gs.hands=dealHands(deck)
        gs.trickCards=[null,null,null,null]
        gs.roundTrickCount=[0,0,0,0]
        gs.leadSuit=null
        gs.playedOrder=[]
        gs.trickWinner=null
        gs.bids=[]
        gs.highBid=6
        gs.highBidder=-1
        gs.bidder=-1
        gs.trump=null
        gs.passCount=0
        gs.roundNum++
        gs.firstBidder=(gs.firstBidder+1)%4
        gs.bidPhasePlayer=gs.firstBidder
        gs.phase='bidding'
        gs.message=gs.firstBidder===0?'New round! Your turn to bid.':(`New round! ${PLAYER_NAMES[gs.firstBidder]} bids first.`)
        setSelectTrump(false)
        return gs
      })
    },2500)
    return ()=>clearTimeout(timer)
  },[gameState?.phase])

  const restartGame=()=>{setDifficulty(null);setGameState(null);setSelectTrump(false)}

  if(!difficulty){
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e3a5f)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:64,marginBottom:8}}>🃏</div>
          <h1 style={{fontSize:42,fontWeight:900,margin:0,background:'linear-gradient(90deg,#38bdf8,#818cf8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>TARNEEB</h1>
          <p style={{color:'#94a3b8',marginTop:8,fontSize:18}}>Classic Middle Eastern Trick-Taking Card Game</p>
        </div>
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:16,padding:'32px 40px',border:'1px solid rgba(255,255,255,0.1)',maxWidth:520,width:'100%'}}>
          <h2 style={{margin:'0 0 12px',fontSize:20,color:'#e2e8f0'}}>How to Play</h2>
          <ul style={{color:'#94a3b8',fontSize:14,margin:'0 0 20px',paddingLeft:18,lineHeight:2}}>
            <li>Teams: You + North vs West + East</li>
            <li>Bid 7-13 tricks. Highest bidder picks trump suit</li>
            <li>Bid team wins: +bid points. Fails: -bid points</li>
            <li>Opponents get +1 per trick taken</li>
            <li>First team to {WIN_SCORE} points wins!</li>
          </ul>
          <div style={{background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.2)',borderRadius:10,padding:'10px 16px',marginBottom:24,fontSize:13,color:'#7dd3fc'}}>
            Teams: <strong>You+North</strong> (indices 0,2) vs <strong>West+East</strong> (indices 1,3)
          </div>
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

  if(!gameState) return null
  const {hands,scores,trickCards,currentPlayer,leadSuit,trump,phase,bids,highBid,highBidder,bidder,trickCount,roundTrickCount,message,bidPhasePlayer} = gameState
  const myHand = sortCards(hands[0], trump)
  const led = leadSuit
  const followable = led ? hands[0].filter(c=>c.suit===led) : hands[0]
  const playable = followable.length>0 ? followable : hands[0]
  const team0Tricks = roundTrickCount[0]+roundTrickCount[2]
  const team1Tricks = roundTrickCount[1]+roundTrickCount[3]

  if(phase==='gameover'){
    const winner = scores[0]>=WIN_SCORE?0:1
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e3a5f)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'system-ui,sans-serif',padding:20}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:72}}>{winner===0?'🏆':'😔'}</div>
          <h1 style={{fontSize:36,fontWeight:900,margin:'8px 0',color:winner===0?'#facc15':'#f87171'}}>{winner===0?'Your Team Wins!':'Opponents Win!'}</h1>
          <p style={{color:'#94a3b8',fontSize:16}}>{message}</p>
        </div>
        <div style={{background:'rgba(255,255,255,0.06)',borderRadius:16,padding:28,minWidth:320,border:'1px solid rgba(255,255,255,0.1)',marginBottom:24}}>
          <h3 style={{margin:'0 0 16px',color:'#e2e8f0',textAlign:'center'}}>Final Scores</h3>
          {[0,1].map(t=>(
            <div key={t} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:t===0?'1px solid rgba(255,255,255,0.08)':'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontWeight:600,color:t===winner?'#facc15':'#e2e8f0'}}>{TEAM_NAMES[t]}</span>
                {t===winner&&<span style={{fontSize:12,background:'#facc1533',color:'#facc15',padding:'2px 8px',borderRadius:999}}>Winner</span>}
              </div>
              <span style={{fontWeight:700,fontSize:24,color:scores[t]<0?'#f87171':'#4ade80'}}>{scores[t]}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:12}}>
          <button onClick={()=>initGame(difficulty!)} style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)',color:'white',border:'none',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:15}}>Play Again</button>
          <button onClick={restartGame} style={{background:'rgba(255,255,255,0.08)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.15)',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontSize:15}}>Menu</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e3a5f)',display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif',color:'white',overflow:'hidden'}}>
      <style>{`
        .card-hover:hover{transform:translateY(-6px) scale(1.05);box-shadow:0 8px 24px rgba(56,189,248,0.4)!important;}
        @keyframes slideIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      {/* Top bar */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px',background:'rgba(0,0,0,0.3)',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontWeight:800,fontSize:18,color:'#38bdf8'}}>TARNEEB</div>
          {trump&&<div style={{background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.4)',borderRadius:20,padding:'4px 14px',fontSize:14,color:SUIT_COLOR[trump],fontWeight:700}}>Trump: {SUIT_DISP[trump]} {SUIT_LABELS[trump]}</div>}
          {bidder>=0&&phase==='playing'&&<div style={{background:'rgba(250,204,21,0.1)',border:'1px solid rgba(250,204,21,0.3)',borderRadius:20,padding:'4px 14px',fontSize:13,color:'#fbbf24'}}>Bid: {highBid} by {PLAYER_NAMES[bidder]}</div>}
        </div>
        <div style={{display:'flex',gap:12}}>
          {[0,1].map(t=>(
            <div key={t} style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'6px 16px',border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontSize:11,color:'#64748b'}}>{TEAM_NAMES[t]}</div>
              <div style={{fontWeight:700,fontSize:20,color:scores[t]<0?'#f87171':'#4ade80'}}>{scores[t]}</div>
              {phase==='playing'&&<div style={{fontSize:11,color:'#94a3b8'}}>{t===0?team0Tricks:team1Tricks} tricks</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Bidding overlay */}
      {phase==='bidding'&&!selectTrump&&(
        <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:20,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'linear-gradient(135deg,#1e2a4a,#0f172a)',borderRadius:20,padding:32,border:'1px solid rgba(56,189,248,0.2)',maxWidth:500,width:'90%',textAlign:'center'}}>
            <h2 style={{margin:'0 0 8px',fontSize:24,color:'#38bdf8'}}>Bidding Phase</h2>
            <p style={{color:'#94a3b8',margin:'0 0 20px',fontSize:14}}>{message}</p>
            {bidFlash&&<div style={{background:'rgba(250,204,21,0.15)',border:'1px solid rgba(250,204,21,0.3)',borderRadius:10,padding:'8px 20px',marginBottom:16,color:'#facc15',fontWeight:700,animation:'pulse 0.5s ease'}}>{bidFlash}</div>}
            {/* Show current bids */}
            <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:20}}>
              {bids.map((b,i)=>(
                <div key={i} style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'6px 12px',border:'1px solid rgba(255,255,255,0.08)'}}>
                  <div style={{fontSize:10,color:'#64748b'}}>{PLAYER_NAMES[i]}</div>
                  <div style={{fontWeight:700,color:b==='pass'?'#f87171':'#4ade80'}}>{b==='pass'?'Pass':b}</div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:16}}>
              <p style={{color:'#94a3b8',fontSize:13,margin:'0 0 10px'}}>Your hand strength:</p>
              <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap'}}>
                {sortCards(hands[0],null).map((card,i)=><CardFace key={i} card={card} small/>)}
              </div>
            </div>
            {bidPhasePlayer===0&&(
              <>
                <p style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Your turn! Current high bid: <strong style={{color:'#facc15'}}>{highBid===6?'None':highBid}</strong></p>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginBottom:12}}>
                  {[7,8,9,10,11,12,13].map(n=>(
                    <button key={n} onClick={()=>placeBid(n)} disabled={n<=highBid} style={{
                      padding:'10px 16px',borderRadius:8,border:'none',cursor:n<=highBid?'not-allowed':'pointer',
                      background:n<=highBid?'rgba(255,255,255,0.05)':'linear-gradient(135deg,#38bdf8,#0284c7)',
                      color:n<=highBid?'#374151':'white',fontWeight:700,fontSize:16,opacity:n<=highBid?0.4:1,
                    }}>{n}</button>
                  ))}
                </div>
                <button onClick={()=>placeBid('pass')} style={{padding:'10px 24px',borderRadius:8,border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.1)',color:'#f87171',cursor:'pointer',fontWeight:700,fontSize:15}}>Pass</button>
              </>
            )}
            {bidPhasePlayer!==0&&<div style={{color:'#94a3b8',animation:'pulse 1s infinite'}}>Waiting for {PLAYER_NAMES[bidPhasePlayer]}...</div>}
          </div>
        </div>
      )}

      {/* Trump selection overlay */}
      {selectTrump&&(
        <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.75)',zIndex:20,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'linear-gradient(135deg,#1e2a4a,#0f172a)',borderRadius:20,padding:36,border:'1px solid rgba(250,204,21,0.3)',maxWidth:400,width:'90%',textAlign:'center'}}>
            <h2 style={{margin:'0 0 8px',fontSize:24,color:'#facc15'}}>Choose Trump Suit</h2>
            <p style={{color:'#94a3b8',margin:'0 0 24px',fontSize:14}}>You won the bid at {highBid}! Select trump suit.</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {SUITS.map(s=>(
                <button key={s} onClick={()=>chooseTrump(s)} style={{
                  padding:'20px 0',borderRadius:12,border:`2px solid ${SUIT_COLOR[s]}33`,
                  background:`${SUIT_COLOR[s]}11`,cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                  transition:'background 0.2s',
                }}
                  onMouseEnter={e=>(e.currentTarget.style.background=`${SUIT_COLOR[s]}22`)}
                  onMouseLeave={e=>(e.currentTarget.style.background=`${SUIT_COLOR[s]}11`)}
                >
                  <span style={{fontSize:36,color:SUIT_COLOR[s]}}>{SUIT_DISP[s]}</span>
                  <span style={{color:SUIT_COLOR[s],fontWeight:700,fontSize:15}}>{SUIT_LABELS[s]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game table */}
      <div style={{flex:1,display:'grid',gridTemplateRows:'auto 1fr auto',gridTemplateColumns:'auto 1fr auto',padding:'8px',position:'relative'}}>

        {/* Top - North (player 2) */}
        <div style={{gridColumn:'1/4',gridRow:'1',display:'flex',flexDirection:'column',alignItems:'center',padding:'6px 0'}}>
          <div style={{fontSize:11,color:currentPlayer===2?'#facc15':'#64748b',marginBottom:4,fontWeight:600}}>North (Your Partner) {currentPlayer===2&&'▾'}</div>
          <div style={{display:'flex',gap:3}}>
            {hands[2].map((_,i)=><CardBack key={i} small/>)}
          </div>
        </div>

        {/* Left - West (player 1) */}
        <div style={{gridColumn:'1',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 6px',gap:3}}>
          <div style={{fontSize:10,color:currentPlayer===1?'#facc15':'#64748b',writingMode:'vertical-lr',transform:'rotate(180deg)',marginBottom:4,fontWeight:600}}>West</div>
          {hands[1].map((_,i)=><CardBack key={i} small/>)}
        </div>

        {/* Center */}
        <div style={{gridColumn:'2',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',background:'radial-gradient(ellipse,rgba(14,30,60,0.7),rgba(10,20,40,0.4))',borderRadius:20,margin:6,border:'1px solid rgba(255,255,255,0.04)'}}>
          {trump&&<div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',fontSize:12,color:SUIT_COLOR[trump],background:'rgba(0,0,0,0.4)',padding:'3px 12px',borderRadius:20,border:`1px solid ${SUIT_COLOR[trump]}44`,whiteSpace:'nowrap'}}>
            Trump: {SUIT_DISP[trump]} {SUIT_LABELS[trump]}
          </div>}

          {trickFlash&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:trickFlash.team===0?'rgba(56,189,248,0.3)':'rgba(239,68,68,0.3)',borderRadius:12,padding:'10px 20px',fontSize:16,fontWeight:700,color:trickFlash.team===0?'#38bdf8':'#f87171',border:`1px solid ${trickFlash.team===0?'rgba(56,189,248,0.5)':'rgba(239,68,68,0.5)'}`,zIndex:10,animation:'slideIn 0.3s ease',whiteSpace:'nowrap'}}>
            {PLAYER_NAMES[trickFlash.winner]} wins!
          </div>}

          <div style={{display:'grid',gridTemplateColumns:'80px 80px',gridTemplateRows:'80px 80px',gap:10,alignItems:'center',justifyItems:'center'}}>
            <div style={{gridColumn:'1/3',display:'flex',justifyContent:'center'}}>
              {trickCards[2]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[2]} trump={trump}/></div>:<div style={{width:54,height:76,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              {trickCards[1]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[1]} trump={trump}/></div>:<div style={{width:54,height:76,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              {trickCards[3]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[3]} trump={trump}/></div>:<div style={{width:54,height:76,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
            <div style={{gridColumn:'1/3',display:'flex',justifyContent:'center'}}>
              {trickCards[0]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={trickCards[0]} trump={trump}/></div>:<div style={{width:54,height:76,borderRadius:7,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
          </div>

          {leadSuit&&<div style={{position:'absolute',bottom:8,right:12,fontSize:12,color:'#94a3b8'}}>Lead: <span style={{color:SUIT_COLOR[leadSuit],fontWeight:700}}>{SUIT_DISP[leadSuit]}</span></div>}

          {/* Trick counts */}
          <div style={{position:'absolute',bottom:8,left:8,display:'flex',gap:6}}>
            {[0,1].map(t=>(
              <div key={t} style={{fontSize:11,color:'#64748b',textAlign:'center',background:'rgba(0,0,0,0.3)',borderRadius:6,padding:'2px 8px'}}>
                <div style={{fontSize:9}}>{TEAM_NAMES[t].split('&')[0]}</div>
                <div style={{color:t===getTeam(bidder)?'#facc15':'#94a3b8',fontWeight:600}}>{t===0?team0Tricks:team1Tricks}/{t===getTeam(bidder)?highBid:'—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - East (player 3) */}
        <div style={{gridColumn:'3',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 6px',gap:3}}>
          <div style={{fontSize:10,color:currentPlayer===3?'#facc15':'#64748b',writingMode:'vertical-lr',marginBottom:4,fontWeight:600}}>East</div>
          {hands[3].map((_,i)=><CardBack key={i} small/>)}
        </div>

        {/* Bottom - You */}
        <div style={{gridColumn:'1/4',gridRow:'3',padding:'6px 0 4px'}}>
          <div style={{textAlign:'center',marginBottom:8,fontSize:14,color:'#94a3b8',minHeight:20}}>
            <span style={{background:'rgba(255,255,255,0.05)',borderRadius:20,padding:'4px 14px'}}>{message}</span>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap',padding:'0 12px'}}>
            {myHand.map((card,i)=>{
              const isPlayable = phase==='playing'&&currentPlayer===0&&playable.some(c=>c.suit===card.suit&&c.rank===card.rank)
              return <CardFace key={`${card.suit}${card.rank}`} card={card} trump={trump} highlight={isPlayable} faded={phase==='playing'&&currentPlayer===0&&!isPlayable} onClick={isPlayable?()=>playCard(i):undefined}/>
            })}
          </div>
          {phase==='playing'&&currentPlayer===0&&<div style={{textAlign:'center',marginTop:6,fontSize:12,color:'#38bdf8'}}>
            {leadSuit?`Must follow ${SUIT_DISP[leadSuit]} if possible`:'Lead any card'}
          </div>}
        </div>
      </div>
    </div>
  )
}
