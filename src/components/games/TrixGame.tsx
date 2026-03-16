"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxDeal, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = 'C' | 'D' | 'H' | 'S'
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'
type Card = { suit: Suit; rank: Rank }
type Kingdom = 'trix'|'diamonds'|'ladies'|'ltoush'|'king_of_hearts'
type Diff = 'easy'|'medium'|'hard'
type MatchPhase = 'diff-select'|'kingdom-select'|'trix-playing'|'trick-playing'|'trick-end'|'hand-end'|'match-end'

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const RANK_VAL: Record<Rank,number> = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14}
const SUITS: Suit[] = ['C','D','H','S']
const SUIT_SYM: Record<Suit,string> = {C:'♣',D:'♦',H:'♥',S:'♠'}
const SUIT_COLOR: Record<Suit,string> = {C:'#93c5fd',D:'#fca5a5',H:'#fca5a5',S:'#c7d2fe'}
const PLAYER_NAMES = ['You','West','North','East']

const KINGDOM_LABEL: Record<Kingdom,string> = {
  trix:'Trix',diamonds:'Diamonds',ladies:'Ladies',ltoush:'Ltoush',king_of_hearts:'King of Hearts'
}
const KINGDOM_ICON: Record<Kingdom,string> = {
  trix:'👑',diamonds:'💎',ladies:'👸',ltoush:'🤚',king_of_hearts:'🤴'
}
const KINGDOM_DESC: Record<Kingdom,string> = {
  trix:'Shedding game — play cards in sequences around Jacks. Finish first!',
  diamonds:'Avoid capturing Diamond cards. Each Diamond = -10 pts',
  ladies:'Avoid capturing Queens. Each Queen = -25 pts',
  ltoush:'Avoid winning tricks. Each trick = -15 pts',
  king_of_hearts:'Avoid capturing K♥. Whoever gets it = -75 pts',
}
const ALL_KINGDOMS: Kingdom[] = ['trix','diamonds','ladies','ltoush','king_of_hearts']

// TRIX scoring by finish position
const TRIX_SCORES = [0, -25, -50, -75]

// ─── Trix Board ───────────────────────────────────────────────────────────────
interface TrixSuitLine { started: boolean; low: number; high: number }
type TrixBoard = Record<Suit, TrixSuitLine>

function emptyTrixBoard(): TrixBoard {
  return {C:{started:false,low:0,high:0},D:{started:false,low:0,high:0},H:{started:false,low:0,high:0},S:{started:false,low:0,high:0}}
}

// ─── State ────────────────────────────────────────────────────────────────────
interface HandHistory { handNum:number; owner:number; kingdom:Kingdom; scores:number[] }

interface MatchState {
  phase: MatchPhase
  diff: Diff
  handNumber: number            // 1..20
  ownerIndex: number            // whose turn to own
  ownerHistory: number[]        // which player owned each hand
  remainingKingdoms: Kingdom[][] // per player, which kingdoms not yet chosen
  totalScores: number[]
  handHistory: HandHistory[]

  // current hand
  hands: Card[][]
  selectedKingdom: Kingdom | null
  leadPlayerIndex: number
  currentPlayerIndex: number
  currentTrick: (Card|null)[]
  playedOrder: number[]
  leadSuit: Suit | null
  completedTricks: number
  handScores: number[]
  trickCounts: number[]
  capturedCards: Card[][]       // per player

  // TRIX specific
  trixBoard: TrixBoard
  trixFinishOrder: number[]     // order players finished
  trixPassCount: number
  trixActivePlayers: boolean[]

  // trick-taking
  trickWinner: number | null

  message: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]] }
  return a
}

function makeDeck(): Card[] {
  const d: Card[] = []
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r})
  return shuffle(d)
}

function dealHands(deck: Card[]): Card[][] {
  return [deck.slice(0,13),deck.slice(13,26),deck.slice(26,39),deck.slice(39)]
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a,b)=>{
    const sd = SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)
    return sd!==0 ? sd : RANK_VAL[a.rank]-RANK_VAL[b.rank]
  })
}

function findCard(hands: Card[][], suit: Suit, rank: Rank): number {
  for(let i=0;i<4;i++) if(hands[i].some(c=>c.suit===suit&&c.rank===rank)) return i
  return -1
}

// ─── Legal Moves ──────────────────────────────────────────────────────────────
function legalTrickMoves(hand: Card[], leadSuit: Suit|null): Card[] {
  if(!leadSuit) return hand
  const follow = hand.filter(c=>c.suit===leadSuit)
  return follow.length>0 ? follow : hand
}

function legalTrixMoves(hand: Card[], board: TrixBoard): Card[] {
  return hand.filter(c=>{
    if(c.rank==='J') return !board[c.suit].started // place jack to start suit
    const line = board[c.suit]
    if(!line.started) return false
    return RANK_VAL[c.rank]===line.high+1 || RANK_VAL[c.rank]===line.low-1
  })
}

// ─── AI Logic ──────────────────────────────────────────────────────────────────
function aiTrickCard(hand: Card[], leadSuit: Suit|null, kingdom: Kingdom, diff: Diff, trickSoFar: Card[]): Card {
  const legal = legalTrickMoves(hand, leadSuit)
  if(diff==='easy') return legal[Math.floor(Math.random()*legal.length)]

  // penalty card values
  const penVal = (c:Card) => {
    if(kingdom==='diamonds'&&c.suit==='D') return 10
    if(kingdom==='ladies'&&c.rank==='Q') return 25
    if(kingdom==='king_of_hearts'&&c.suit==='H'&&c.rank==='K') return 75
    if(kingdom==='ltoush') return 1
    return 0
  }

  // Is current trick winner going to have penalty?
  const willWin = (card: Card) => {
    if(!leadSuit) return true
    const inLead = card.suit===leadSuit
    const bestInTrick = trickSoFar.filter(c=>c.suit===leadSuit).reduce((b,c)=>RANK_VAL[c.rank]>RANK_VAL[b.rank]?c:b, {suit:leadSuit,rank:'2'} as Card)
    return inLead && RANK_VAL[card.rank]>RANK_VAL[bestInTrick.rank]
  }

  if(kingdom==='ltoush') {
    // prefer losing tricks: play high non-lead to discard, or low in lead
    const noWin = legal.filter(c=>!willWin(c))
    if(noWin.length>0) return noWin.sort((a,b)=>penVal(b)-penVal(a))[0]
    return legal.sort((a,b)=>RANK_VAL[a.rank]-RANK_VAL[b.rank])[0]
  }

  // avoid playing penalty cards unless no choice
  const safe = legal.filter(c=>penVal(c)===0)
  if(safe.length>0){
    if(kingdom==='diamonds'||kingdom==='ladies'||kingdom==='king_of_hearts'){
      // dump penalty cards if not winning trick
      const dumpPenalty = legal.filter(c=>penVal(c)>0&&!willWin(c))
      if(dumpPenalty.length>0) return dumpPenalty.sort((a,b)=>penVal(b)-penVal(a))[0]
    }
    return safe.sort((a,b)=>RANK_VAL[a.rank]-RANK_VAL[b.rank])[0]
  }
  return legal.sort((a,b)=>penVal(a)-penVal(b))[0]
}

function aiTrixCard(hand: Card[], board: TrixBoard, diff: Diff): Card|null {
  const legal = legalTrixMoves(hand, board)
  if(legal.length===0) return null
  if(diff==='easy') return legal[Math.floor(Math.random()*legal.length)]
  // prefer jacks first, then cards freeing most moves
  const jacks = legal.filter(c=>c.rank==='J')
  if(jacks.length>0) return jacks[0]
  return legal[0]
}

// ─── Trick winner ─────────────────────────────────────────────────────────────
function resolveTrickWinner(trickCards: (Card|null)[], playedOrder: number[], leadSuit: Suit): number {
  const played = playedOrder.map(i=>({pi:i,card:trickCards[i]!}))
  let best = played[0]
  for(let i=1;i<played.length;i++){
    const c = played[i]
    if(c.card.suit===leadSuit&&(best.card.suit!==leadSuit||RANK_VAL[c.card.rank]>RANK_VAL[best.card.rank])) best=c
  }
  return best.pi
}

// ─── Hand scoring ─────────────────────────────────────────────────────────────
function computeHandScores(kingdom: Kingdom, capturedCards: Card[][], trickCounts: number[], trixFinishOrder: number[]): number[] {
  const scores = [0,0,0,0]
  if(kingdom==='trix'){
    trixFinishOrder.forEach((pi,pos)=>{ scores[pi]=TRIX_SCORES[pos] })
    return scores
  }
  if(kingdom==='diamonds'){
    capturedCards.forEach((cards,pi)=>{
      scores[pi] = -10 * cards.filter(c=>c.suit==='D').length
    })
    return scores
  }
  if(kingdom==='ladies'){
    capturedCards.forEach((cards,pi)=>{
      scores[pi] = -25 * cards.filter(c=>c.rank==='Q').length
    })
    return scores
  }
  if(kingdom==='ltoush'){
    trickCounts.forEach((t,pi)=>{ scores[pi]=-15*t })
    return scores
  }
  if(kingdom==='king_of_hearts'){
    capturedCards.forEach((cards,pi)=>{
      if(cards.some(c=>c.suit==='H'&&c.rank==='K')) scores[pi]=-75
    })
    return scores
  }
  return scores
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initMatchState(diff: Diff): MatchState {
  const deck = makeDeck()
  const hands = dealHands(deck)
  const ownerIndex = Math.floor(Math.random()*4)
  // Find 2C or JC holder for lead
  const leadPlayer = findCard(hands, 'C', '2')
  return {
    phase:'kingdom-select',
    diff,
    handNumber:1,
    ownerIndex,
    ownerHistory:[ownerIndex],
    remainingKingdoms: ALL_KINGDOMS.map(()=>[...ALL_KINGDOMS]),
    totalScores:[0,0,0,0],
    handHistory:[],
    hands,
    selectedKingdom:null,
    leadPlayerIndex:leadPlayer>=0?leadPlayer:0,
    currentPlayerIndex:leadPlayer>=0?leadPlayer:0,
    currentTrick:[null,null,null,null],
    playedOrder:[],
    leadSuit:null,
    completedTricks:0,
    handScores:[0,0,0,0],
    trickCounts:[0,0,0,0],
    capturedCards:[[],[],[],[]],
    trixBoard:emptyTrixBoard(),
    trixFinishOrder:[],
    trixPassCount:0,
    trixActivePlayers:[true,true,true,true],
    trickWinner:null,
    message:`Hand 1/20 — ${PLAYER_NAMES[ownerIndex]} chooses the kingdom`,
  }
}

function startNewHand(prev: MatchState): MatchState {
  const deck = makeDeck()
  const hands = dealHands(deck)
  const nextOwner = (prev.ownerIndex+1)%4
  const handNum = prev.handNumber+1

  let lead = -1
  // find JC for TRIX, 2C for others (will be set after kingdom chosen)
  lead = findCard(hands,'C','2')
  if(lead<0) lead=0

  return {
    ...prev,
    phase:'kingdom-select',
    handNumber:handNum,
    ownerIndex:nextOwner,
    ownerHistory:[...prev.ownerHistory,nextOwner],
    hands,
    selectedKingdom:null,
    leadPlayerIndex:lead,
    currentPlayerIndex:nextOwner,
    currentTrick:[null,null,null,null],
    playedOrder:[],
    leadSuit:null,
    completedTricks:0,
    handScores:[0,0,0,0],
    trickCounts:[0,0,0,0],
    capturedCards:[[],[],[],[]],
    trixBoard:emptyTrixBoard(),
    trixFinishOrder:[],
    trixPassCount:0,
    trixActivePlayers:[true,true,true,true],
    trickWinner:null,
    message:`Hand ${handNum}/20 — ${PLAYER_NAMES[nextOwner]} chooses the kingdom`,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TrixGame({ onScoreUpdate, onGameOver, onGameStart }: GameComponentProps) {
  const [state, setState] = useState<MatchState|null>(null)
  const [diff, setDiff] = useState<Diff|null>(null)
  const timerRef = useRef<NodeJS.Timeout|null>(null)
  const [trickFlash, setTrickFlash] = useState<{winner:number;label:string}|null>(null)

  const safe = useCallback((fn:(s:MatchState)=>MatchState)=>{
    setState(prev=>prev?fn(prev):prev)
  },[])

  // ── Start game ──────────────────────────────────────────────────────────────
  const startGame = useCallback((d:Diff)=>{
    sfxDeal()
    setDiff(d)
    const ms = initMatchState(d)
    setState(ms)
    onGameStart?.()
  },[onGameStart])

  // ── Select kingdom (owner's choice) ────────────────────────────────────────
  const selectKingdom = useCallback((k:Kingdom)=>{
    if(!state) return
    if(state.phase!=='kingdom-select') return
    if(state.ownerIndex!==0 && state.currentPlayerIndex!==0) {
      // only player 0 (You) can click; AI owner handled in useEffect
    }
    sfxClick()
    safe(prev=>{
      const newRemaining = prev.remainingKingdoms.map((r,i)=>i===prev.ownerIndex?r.filter(x=>x!==k):r)
      let lead = -1
      if(k==='trix'){
        lead = findCard(prev.hands,'C','J')
        if(lead<0) lead = findCard(prev.hands,'S','J')
        if(lead<0) lead = findCard(prev.hands,'D','J')
        if(lead<0) lead = findCard(prev.hands,'H','J')
        if(lead<0) lead=0
      } else {
        lead = findCard(prev.hands,'C','2')
        if(lead<0) lead=0
      }
      const phase: MatchPhase = k==='trix' ? 'trix-playing' : 'trick-playing'
      return {
        ...prev,
        phase,
        selectedKingdom:k,
        remainingKingdoms:newRemaining,
        leadPlayerIndex:lead,
        currentPlayerIndex:lead,
        message: k==='trix'
          ? `Trix! Build suit sequences around Jacks. ${PLAYER_NAMES[lead]} starts.`
          : `${KINGDOM_LABEL[k]} — ${PLAYER_NAMES[lead]} leads first trick.`,
      }
    })
    sfxDeal()
  },[state,safe])

  // ── AI chooses kingdom ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(!state||state.phase!=='kingdom-select') return
    if(state.ownerIndex===0) return // human chooses
    const delay = 1200
    timerRef.current = setTimeout(()=>{
      const remaining = state.remainingKingdoms[state.ownerIndex]
      if(remaining.length===0) return
      const k = remaining[Math.floor(Math.random()*remaining.length)]
      sfxNotify()
      safe(prev=>{
        if(!prev||prev.phase!=='kingdom-select') return prev
        const newRemaining = prev.remainingKingdoms.map((r,i)=>i===prev.ownerIndex?r.filter(x=>x!==k):r)
        let lead = -1
        if(k==='trix'){
          lead = findCard(prev.hands,'C','J')
          if(lead<0) lead=0
        } else {
          lead = findCard(prev.hands,'C','2')
          if(lead<0) lead=0
        }
        const phase: MatchPhase = k==='trix'?'trix-playing':'trick-playing'
        return {
          ...prev,phase,selectedKingdom:k,remainingKingdoms:newRemaining,
          leadPlayerIndex:lead,currentPlayerIndex:lead,
          message:`${PLAYER_NAMES[prev.ownerIndex]} chose ${KINGDOM_LABEL[k]}! ${PLAYER_NAMES[lead]} leads.`,
        }
      })
    },delay)
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current) }
  },[state?.phase,state?.ownerIndex])

  // ── Player plays trick card ─────────────────────────────────────────────────
  const playTrickCard = useCallback((cardIndex:number)=>{
    if(!state||state.phase!=='trick-playing') return
    if(state.currentPlayerIndex!==0) return
    const hand = state.hands[0]
    const card = sortCards(hand)[cardIndex]
    const legal = legalTrickMoves(hand, state.leadSuit)
    if(!legal.some(c=>c.suit===card.suit&&c.rank===card.rank)) { sfxLose(); return }
    sfxCardPlay()
    safe(prev=>{
      if(!prev) return prev
      const newHands = prev.hands.map((h,i)=>i===0?h.filter(c=>!(c.suit===card.suit&&c.rank===card.rank)):h)
      const newTrick = [...prev.currentTrick] as (Card|null)[]
      newTrick[0]=card
      const newOrder = [...prev.playedOrder,0]
      const newLead = prev.leadSuit??card.suit
      const allPlayed = newOrder.length===4
      if(allPlayed){
        const winner = resolveTrickWinner(newTrick,newOrder,newLead)
        const trickCards = newTrick.filter(Boolean) as Card[]
        const newCaptured = prev.capturedCards.map((c,i)=>i===winner?[...c,...trickCards]:c)
        const newTrickCounts = prev.trickCounts.map((t,i)=>i===winner?t+1:t)
        const hs = computeHandScores(prev.selectedKingdom!,newCaptured,newTrickCounts,[])
        onScoreUpdate?.(prev.totalScores[0]+hs[0])
        if(winner===0) sfxWin(); else sfxLose()
        setTrickFlash({winner,label:`${PLAYER_NAMES[winner]} wins!`})
        setTimeout(()=>setTrickFlash(null),900)
        return {
          ...prev,phase:'trick-end',
          hands:newHands,currentTrick:newTrick,playedOrder:newOrder,leadSuit:newLead,
          capturedCards:newCaptured,trickCounts:newTrickCounts,trickWinner:winner,
          completedTricks:prev.completedTricks+1,
          message:`${PLAYER_NAMES[winner]} wins the trick!`,
        }
      }
      return {
        ...prev,hands:newHands,currentTrick:newTrick,playedOrder:newOrder,leadSuit:newLead,
        currentPlayerIndex:1,
      }
    })
  },[state,safe,onScoreUpdate])

  // ── AI trick card ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!state||state.phase!=='trick-playing') return
    if(state.currentPlayerIndex===0) return
    const p = state.currentPlayerIndex
    const delay = state.diff==='hard'?500:state.diff==='medium'?750:1000
    timerRef.current = setTimeout(()=>{
      safe(prev=>{
        if(!prev||prev.phase!=='trick-playing'||prev.currentPlayerIndex!==p) return prev
        const hand = prev.hands[p]
        if(hand.length===0) return prev
        const trickSoFar = prev.playedOrder.map(i=>prev.currentTrick[i]!).filter(Boolean)
        const card = aiTrickCard(hand,prev.leadSuit,prev.selectedKingdom!,prev.diff,trickSoFar)
        const newHands = prev.hands.map((h,i)=>i===p?h.filter(c=>!(c.suit===card.suit&&c.rank===card.rank)):h)
        const newTrick = [...prev.currentTrick] as (Card|null)[]
        newTrick[p]=card
        const newOrder = [...prev.playedOrder,p]
        const newLead = prev.leadSuit??card.suit
        sfxCardFlip()
        const allPlayed = newOrder.length===4
        if(allPlayed){
          const winner = resolveTrickWinner(newTrick,newOrder,newLead)
          const trickCards = newTrick.filter(Boolean) as Card[]
          const newCaptured = prev.capturedCards.map((c,i)=>i===winner?[...c,...trickCards]:c)
          const newTrickCounts = prev.trickCounts.map((t,i)=>i===winner?t+1:t)
          const hs = computeHandScores(prev.selectedKingdom!,newCaptured,newTrickCounts,[])
          onScoreUpdate?.(prev.totalScores[0]+hs[0])
          if(winner===0) sfxWin(); else sfxLose()
          setTrickFlash({winner,label:`${PLAYER_NAMES[winner]} wins!`})
          setTimeout(()=>setTrickFlash(null),900)
          return {
            ...prev,phase:'trick-end',
            hands:newHands,currentTrick:newTrick,playedOrder:newOrder,leadSuit:newLead,
            capturedCards:newCaptured,trickCounts:newTrickCounts,trickWinner:winner,
            completedTricks:prev.completedTricks+1,
            message:`${PLAYER_NAMES[winner]} wins the trick!`,
          }
        }
        const next = (p+1)%4
        return {...prev,hands:newHands,currentTrick:newTrick,playedOrder:newOrder,leadSuit:newLead,currentPlayerIndex:next}
      })
    },delay)
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current) }
  },[state?.phase,state?.currentPlayerIndex,state?.diff])

  // ── Trick end → next trick or hand end ───────────────────────────────────────
  useEffect(()=>{
    if(!state||state.phase!=='trick-end') return
    timerRef.current = setTimeout(()=>{
      safe(prev=>{
        if(!prev||prev.phase!=='trick-end') return prev
        const winner = prev.trickWinner!
        if(prev.completedTricks>=13){
          // Hand over
          const hs = computeHandScores(prev.selectedKingdom!,prev.capturedCards,prev.trickCounts,[])
          const newTotal = prev.totalScores.map((t,i)=>t+hs[i])
          sfxNotify()
          return {
            ...prev,phase:'hand-end',handScores:hs,totalScores:newTotal,
            currentTrick:[null,null,null,null],playedOrder:[],leadSuit:null,
            message:`Hand ${prev.handNumber} complete!`,
          }
        }
        return {
          ...prev,phase:'trick-playing',
          currentTrick:[null,null,null,null],playedOrder:[],leadSuit:null,
          leadPlayerIndex:winner,currentPlayerIndex:winner,trickWinner:null,
          message:winner===0?'Your turn — you won the trick!': `${PLAYER_NAMES[winner]}'s turn`,
        }
      })
    },1300)
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current) }
  },[state?.phase])

  // ── Hand end → next hand or match end ────────────────────────────────────────
  useEffect(()=>{
    if(!state||state.phase!=='hand-end') return
    timerRef.current = setTimeout(()=>{
      safe(prev=>{
        if(!prev||prev.phase!=='hand-end') return prev
        // Record in history
        const newHistory = [...prev.handHistory,{
          handNum:prev.handNumber,owner:prev.ownerIndex,
          kingdom:prev.selectedKingdom!,scores:[...prev.handScores]
        }]
        if(prev.handNumber>=20){
          const winner = prev.totalScores.indexOf(Math.max(...prev.totalScores))
          if(winner===0) sfxVictory(); else sfxGameOver()
          onGameOver?.(prev.totalScores[0])
          return {...prev,phase:'match-end',handHistory:newHistory,message:`Match complete! ${PLAYER_NAMES[winner]} wins!`}
        }
        sfxDeal()
        const next = startNewHand(prev)
        return {...next,handHistory:newHistory,totalScores:prev.totalScores}
      })
    },2500)
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current) }
  },[state?.phase])

  // ── TRIX: player plays card ─────────────────────────────────────────────────
  const playTrixCard = useCallback((cardIndex:number)=>{
    if(!state||state.phase!=='trix-playing') return
    if(state.currentPlayerIndex!==0) return
    const hand = sortCards(state.hands[0])
    const card = hand[cardIndex]
    const legal = legalTrixMoves(state.hands[0], state.trixBoard)
    if(!legal.some(c=>c.suit===card.suit&&c.rank===card.rank)){ sfxLose(); return }
    sfxCardPlay()
    safe(prev=>{
      if(!prev) return prev
      const newHands = prev.hands.map((h,i)=>i===0?h.filter(c=>!(c.suit===card.suit&&c.rank===card.rank)):h)
      const newBoard = applyTrixCard(card,prev.trixBoard)
      const newActive = [...prev.trixActivePlayers]
      let newFinish = [...prev.trixFinishOrder]
      if(newHands[0].length===0 && newActive[0]){
        newActive[0]=false; newFinish=[...newFinish,0]; sfxWin()
      }
      const next = nextTrixPlayer(0,newActive)
      return {
        ...prev,hands:newHands,trixBoard:newBoard,trixActivePlayers:newActive,
        trixFinishOrder:newFinish,trixPassCount:0,
        currentPlayerIndex:next,
        message:next===0?'Your turn!':next===-1?'Hand complete!`':`${PLAYER_NAMES[next]}'s turn`,
        phase:newFinish.length===4?'hand-end':prev.phase,
        ...(newFinish.length===4?{
          handScores:computeHandScores('trix',prev.capturedCards,prev.trickCounts,newFinish),
          totalScores:prev.totalScores.map((t,i)=>t+TRIX_SCORES[newFinish.indexOf(i)>=0?newFinish.indexOf(i):3])
        }:{})
      }
    })
  },[state,safe])

  function applyTrixCard(card: Card, board: TrixBoard): TrixBoard {
    const b: TrixBoard = JSON.parse(JSON.stringify(board))
    if(card.rank==='J'){ b[card.suit]={started:true,low:11,high:11}; return b }
    if(RANK_VAL[card.rank]===b[card.suit].high+1) b[card.suit].high++
    else if(RANK_VAL[card.rank]===b[card.suit].low-1) b[card.suit].low--
    return b
  }

  function nextTrixPlayer(from:number, active:boolean[]): number {
    for(let i=1;i<=4;i++){
      const p=(from+i)%4
      if(active[p]) return p
    }
    return -1
  }

  // ── TRIX AI ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!state||state.phase!=='trix-playing') return
    if(state.currentPlayerIndex===0||state.currentPlayerIndex===-1) return
    const p = state.currentPlayerIndex
    const delay = state.diff==='hard'?600:state.diff==='medium'?900:1200
    timerRef.current = setTimeout(()=>{
      safe(prev=>{
        if(!prev||prev.phase!=='trix-playing'||prev.currentPlayerIndex!==p) return prev
        if(!prev.trixActivePlayers[p]) return prev
        const hand = prev.hands[p]
        const card = aiTrixCard(hand,prev.trixBoard,prev.diff)
        if(!card){
          // pass
          const newPassCount = prev.trixPassCount+1
          const next = nextTrixPlayer(p,prev.trixActivePlayers)
          const allPassed = newPassCount >= prev.trixActivePlayers.filter(Boolean).length
          if(allPassed){
            // Deadlock — finish all remaining in current order
            const newFinish = [...prev.trixFinishOrder]
            prev.trixActivePlayers.forEach((_,i)=>{ if(prev.trixActivePlayers[i]&&!newFinish.includes(i)) newFinish.push(i) })
            const hs = computeHandScores('trix',prev.capturedCards,prev.trickCounts,newFinish)
            const newTotal = prev.totalScores.map((t,i)=>t+hs[i])
            sfxGameOver()
            return {...prev,phase:'hand-end',trixFinishOrder:newFinish,handScores:hs,totalScores:newTotal,message:'Deadlock! Hand over.'}
          }
          return {...prev,trixPassCount:newPassCount,currentPlayerIndex:next,message:`${PLAYER_NAMES[p]} passes`}
        }
        sfxCardFlip()
        const newHands = prev.hands.map((h,i)=>i===p?h.filter(c=>!(c.suit===card.suit&&c.rank===card.rank)):h)
        const newBoard = applyTrixCard(card,prev.trixBoard)
        const newActive = [...prev.trixActivePlayers]
        let newFinish = [...prev.trixFinishOrder]
        if(newHands[p].length===0&&newActive[p]){
          newActive[p]=false; newFinish=[...newFinish,p]
        }
        const next = nextTrixPlayer(p,newActive)
        if(newFinish.length===4||next===-1){
          const allFinish = [...newFinish]
          newActive.forEach((_,i)=>{ if(newActive[i]&&!allFinish.includes(i)) allFinish.push(i) })
          const hs = computeHandScores('trix',prev.capturedCards,prev.trickCounts,allFinish)
          const newTotal = prev.totalScores.map((t,i)=>t+hs[i])
          sfxNotify()
          return {...prev,phase:'hand-end',hands:newHands,trixBoard:newBoard,trixActivePlayers:newActive,
            trixFinishOrder:allFinish,handScores:hs,totalScores:newTotal,
            message:`Hand ${prev.handNumber} complete!`}
        }
        return {...prev,hands:newHands,trixBoard:newBoard,trixActivePlayers:newActive,
          trixFinishOrder:newFinish,trixPassCount:0,currentPlayerIndex:next,
          message:next===0?'Your turn!': `${PLAYER_NAMES[next]}'s turn`}
      })
    },delay)
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current) }
  },[state?.phase,state?.currentPlayerIndex,state?.diff])

  // ── Render ───────────────────────────────────────────────────────────────────
  if(!diff||!state){
    return <DiffSelect onSelect={startGame}/>
  }
  if(state.phase==='match-end'){
    return <MatchEnd state={state} onRestart={()=>{ sfxClick(); setDiff(null); setState(null) }}/>
  }
  if(state.phase==='kingdom-select'){
    return <KingdomSelect state={state} onChoose={selectKingdom}/>
  }
  if(state.phase==='hand-end'){
    return <HandEnd state={state}/>
  }
  if(state.phase==='trix-playing'){
    return <TrixTable state={state} onPlay={playTrixCard} trickFlash={trickFlash}/>
  }
  return <TrickTable state={state} onPlay={playTrickCard} trickFlash={trickFlash}/>
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const BG = 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)'
const cardW=52, cardH=74

function CardFace({card,highlight,grayed,onClick,penalty}:{card:Card;highlight?:boolean;grayed?:boolean;onClick?:()=>void;penalty?:number}){
  const col = SUIT_COLOR[card.suit]
  return (
    <div onClick={onClick} style={{
      width:cardW,height:cardH,borderRadius:8,cursor:onClick?'pointer':'default',
      background:highlight?'rgba(250,204,21,0.18)':grayed?'rgba(30,27,75,0.5)':'rgba(255,255,255,0.09)',
      border:highlight?'2px solid #facc15':'1.5px solid rgba(255,255,255,0.18)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,
      boxShadow:highlight?'0 0 14px 2px #facc1566':'0 2px 6px rgba(0,0,0,0.3)',
      transition:'transform 0.12s,box-shadow 0.12s',
      opacity:grayed?0.45:1,
      userSelect:'none',position:'relative',
    }}
    className={onClick?'card-hover':''}
    >
      <div style={{fontSize:11,fontWeight:700,color:col,lineHeight:1}}>{card.rank}</div>
      <div style={{fontSize:18,color:col,lineHeight:1}}>{SUIT_SYM[card.suit]}</div>
      {penalty!==undefined&&penalty<0&&<div style={{position:'absolute',bottom:2,right:3,fontSize:'8px',color:'#f87171',fontWeight:700}}>{penalty}</div>}
    </div>
  )
}

function CardBack({small}:{small?:boolean}){
  return <div style={{width:small?32:cardW,height:small?46:cardH,borderRadius:7,background:'linear-gradient(135deg,#312e81,#1e1b4b)',border:'1.5px solid rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,opacity:0.7}}>🂠</div>
}

function ScoreBar({state}:{state:MatchState}){
  return (
    <div style={{display:'flex',gap:8,padding:'8px 16px',background:'rgba(0,0,0,0.35)',borderBottom:'1px solid rgba(255,255,255,0.06)',alignItems:'center',flexWrap:'wrap'}}>
      <span style={{color:'#a78bfa',fontWeight:800,fontSize:16,marginRight:4}}>TRIX</span>
      <span style={{color:'#64748b',fontSize:12}}>Hand {state.handNumber}/20</span>
      {state.selectedKingdom&&<span style={{background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.4)',borderRadius:20,padding:'2px 10px',fontSize:12,color:'#a5b4fc'}}>{KINGDOM_ICON[state.selectedKingdom]} {KINGDOM_LABEL[state.selectedKingdom]}</span>}
      <div style={{flex:1}}/>
      {state.totalScores.map((s,i)=>(
        <div key={i} style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'3px 10px',border:`1px solid ${state.currentPlayerIndex===i&&(state.phase==='trick-playing'||state.phase==='trix-playing')?'rgba(250,204,21,0.5)':'rgba(255,255,255,0.07)'}`}}>
          <div style={{fontSize:9,color:'#64748b'}}>{PLAYER_NAMES[i]}</div>
          <div style={{fontWeight:700,fontSize:14,color:s<0?'#f87171':'#4ade80'}}>{s}</div>
        </div>
      ))}
    </div>
  )
}

function DiffSelect({onSelect}:{onSelect:(d:Diff)=>void}){
  return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20,gap:28}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:60,marginBottom:6}}>🃏</div>
        <h1 style={{fontSize:44,fontWeight:900,margin:0,background:'linear-gradient(90deg,#a78bfa,#818cf8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>TRIX</h1>
        <p style={{color:'#94a3b8',marginTop:6,fontSize:16}}>Classic Middle Eastern Card Game — 20 Hands</p>
      </div>
      <div style={{background:'rgba(255,255,255,0.04)',borderRadius:18,padding:28,maxWidth:520,width:'100%',border:'1px solid rgba(255,255,255,0.1)'}}>
        <h2 style={{margin:'0 0 12px',color:'#e2e8f0',fontSize:18}}>How TRIX Works</h2>
        <ul style={{color:'#94a3b8',fontSize:13,lineHeight:1.8,paddingLeft:18,margin:'0 0 20px'}}>
          <li>4 players, 52 cards, 13 cards each</li>
          <li>20 hands total (each player owns 5 hands, uses each kingdom once)</li>
          <li>Kingdom owner selects one of 5 kingdoms for that hand</li>
          <li>By match end, every player must have played all 5 kingdoms</li>
        </ul>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:24}}>
          {ALL_KINGDOMS.map(k=>(
            <div key={k} style={{background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'10px 12px',border:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{fontSize:20,marginBottom:2}}>{KINGDOM_ICON[k]}</div>
              <div style={{fontWeight:700,fontSize:13,color:'#e2e8f0'}}>{KINGDOM_LABEL[k]}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{KINGDOM_DESC[k]}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10}}>
          {(['easy','medium','hard'] as Diff[]).map(d=>(
            <button key={d} onClick={()=>onSelect(d)} style={{
              flex:1,padding:'13px 0',borderRadius:10,border:'none',cursor:'pointer',fontWeight:700,fontSize:15,color:'white',
              background:d==='easy'?'linear-gradient(135deg,#22c55e,#16a34a)':d==='medium'?'linear-gradient(135deg,#f59e0b,#d97706)':'linear-gradient(135deg,#ef4444,#dc2626)',
            }}>{d[0].toUpperCase()+d.slice(1)}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function KingdomSelect({state,onChoose}:{state:MatchState;onChoose:(k:Kingdom)=>void}){
  const owner = state.ownerIndex
  const available = state.remainingKingdoms[owner]
  const isYou = owner===0
  return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20,gap:20}}>
      <ScoreBar state={state}/>
      <div style={{textAlign:'center'}}>
        <div style={{color:'#64748b',fontSize:13}}>Hand {state.handNumber} / 20</div>
        <h2 style={{margin:'4px 0',fontSize:26,fontWeight:800,color:'#e2e8f0'}}>
          {isYou?'Your Turn — Choose Kingdom':'Waiting for AI to choose...'}
        </h2>
        <p style={{color:'#64748b',margin:0,fontSize:13}}>{PLAYER_NAMES[owner]} is the kingdom owner</p>
      </div>
      {/* Hand preview */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center',maxWidth:600}}>
        {sortCards(state.hands[0]).map((c,i)=><CardFace key={i} card={c} grayed={!isYou}/>)}
      </div>
      {isYou&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:500,width:'100%'}}>
          {available.map(k=>(
            <button key={k} onClick={()=>onChoose(k)} style={{
              background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.12)',
              borderRadius:14,padding:'18px 14px',cursor:'pointer',color:'white',textAlign:'left',
              transition:'all 0.18s',
            }}
              onMouseEnter={e=>{const b=e.currentTarget;b.style.background='rgba(99,102,241,0.2)';b.style.borderColor='#6366f1';b.style.transform='scale(1.03)'}}
              onMouseLeave={e=>{const b=e.currentTarget;b.style.background='rgba(255,255,255,0.05)';b.style.borderColor='rgba(255,255,255,0.12)';b.style.transform='scale(1)'}}>
              <div style={{fontSize:26,marginBottom:4}}>{KINGDOM_ICON[k]}</div>
              <div style={{fontWeight:700,fontSize:15,color:'#e2e8f0'}}>{KINGDOM_LABEL[k]}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:3}}>{KINGDOM_DESC[k]}</div>
            </button>
          ))}
        </div>
      )}
      {!isYou&&<div style={{display:'flex',alignItems:'center',gap:8,color:'#94a3b8'}}>
        <div style={{width:14,height:14,borderRadius:'50%',border:'2px solid #6366f1',borderTopColor:'transparent',animation:'spin 1s linear infinite'}}/>
        {PLAYER_NAMES[owner]} is thinking...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>}
      {/* Per-player remaining kingdoms */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        {PLAYER_NAMES.map((name,i)=>(
          <div key={i} style={{background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'8px 14px',border:`1px solid ${i===owner?'rgba(250,204,21,0.4)':'rgba(255,255,255,0.07)'}`}}>
            <div style={{fontSize:11,color:i===owner?'#facc15':'#64748b',fontWeight:600}}>{name}</div>
            <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
              {state.remainingKingdoms[i].map(k=><span key={k} style={{fontSize:14}}>{KINGDOM_ICON[k]}</span>)}
              {state.remainingKingdoms[i].length===0&&<span style={{fontSize:11,color:'#4ade80'}}>✓ done</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrickTable({state,onPlay,trickFlash}:{state:MatchState;onPlay:(i:number)=>void;trickFlash:{winner:number;label:string}|null}){
  const k = state.selectedKingdom!
  const myHand = sortCards(state.hands[0])
  const legal = state.currentPlayerIndex===0 ? legalTrickMoves(state.hands[0],state.leadSuit) : []

  const cardPenalty = (c:Card) => {
    if(k==='diamonds'&&c.suit==='D') return -10
    if(k==='ladies'&&c.rank==='Q') return -25
    if(k==='king_of_hearts'&&c.suit==='H'&&c.rank==='K') return -75
    return 0
  }

  return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif',color:'white',userSelect:'none'}}>
      <style>{`.card-hover:hover{transform:translateY(-8px) scale(1.06);box-shadow:0 10px 28px rgba(99,102,241,0.45)!important}@keyframes slideIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}`}</style>
      <ScoreBar state={state}/>
      <div style={{flex:1,display:'grid',gridTemplateRows:'auto 1fr auto',gridTemplateColumns:'auto 1fr auto',padding:8,gap:0}}>
        {/* North */}
        <div style={{gridColumn:'1/4',display:'flex',flexDirection:'column',alignItems:'center',padding:'6px 0'}}>
          <div style={{fontSize:11,color:state.currentPlayerIndex===2?'#facc15':'#64748b',marginBottom:4,fontWeight:600}}>
            {PLAYER_NAMES[2]} {state.currentPlayerIndex===2?'▾':''} ({state.hands[2].length} cards)
          </div>
          <div style={{display:'flex',gap:2}}>{state.hands[2].map((_,i)=><CardBack key={i} small/>)}</div>
        </div>
        {/* West */}
        <div style={{gridColumn:'1',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 6px'}}>
          <div style={{fontSize:11,color:state.currentPlayerIndex===1?'#facc15':'#64748b',writingMode:'vertical-lr',transform:'rotate(180deg)',marginBottom:4,fontWeight:600}}>
            {PLAYER_NAMES[1]}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>{state.hands[1].map((_,i)=><CardBack key={i} small/>)}</div>
        </div>
        {/* Center */}
        <div style={{gridColumn:'2',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',background:'radial-gradient(ellipse at center,rgba(30,27,75,0.55),rgba(15,23,42,0.25))',borderRadius:16,margin:6,border:'1px solid rgba(255,255,255,0.05)'}}>
          {trickFlash&&(
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:10,animation:'slideIn 0.3s ease',
              background:'rgba(30,27,75,0.92)',borderRadius:12,padding:'10px 22px',fontSize:16,fontWeight:700,
              color:trickFlash.winner===0?'#4ade80':'#a5b4fc',border:`1px solid ${trickFlash.winner===0?'rgba(74,222,128,0.5)':'rgba(165,180,252,0.4)'}`}}>
              {trickFlash.label}
            </div>
          )}
          {/* Cards on table */}
          <div style={{display:'grid',gridTemplateColumns:'70px 70px',gridTemplateRows:'80px 80px',gap:8,alignItems:'center',justifyItems:'center'}}>
            <div style={{gridColumn:'1/3',display:'flex',justifyContent:'center'}}>
              {state.currentTrick[2]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={state.currentTrick[2]} penalty={cardPenalty(state.currentTrick[2])}/></div>:<div style={{width:cardW,height:cardH,borderRadius:8,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              {state.currentTrick[1]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={state.currentTrick[1]} penalty={cardPenalty(state.currentTrick[1])}/></div>:<div style={{width:cardW,height:cardH,borderRadius:8,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              {state.currentTrick[3]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={state.currentTrick[3]} penalty={cardPenalty(state.currentTrick[3])}/></div>:<div style={{width:cardW,height:cardH,borderRadius:8,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
            <div style={{gridColumn:'1/3',display:'flex',justifyContent:'center'}}>
              {state.currentTrick[0]?<div style={{animation:'slideIn 0.3s ease'}}><CardFace card={state.currentTrick[0]} penalty={cardPenalty(state.currentTrick[0])}/></div>:<div style={{width:cardW,height:cardH,borderRadius:8,border:'1.5px dashed rgba(255,255,255,0.08)'}}/>}
            </div>
          </div>
          {state.leadSuit&&<div style={{position:'absolute',bottom:8,right:12,fontSize:12,color:'#94a3b8'}}>Lead: <span style={{color:SUIT_COLOR[state.leadSuit],fontWeight:700}}>{SUIT_SYM[state.leadSuit]}</span></div>}
          <div style={{position:'absolute',bottom:8,left:10,display:'flex',gap:6}}>
            {state.trickCounts.map((t,i)=>(
              <div key={i} style={{fontSize:10,color:'#64748b',textAlign:'center'}}>
                <div style={{fontSize:9}}>{PLAYER_NAMES[i][0]}</div>
                <div style={{color:'#94a3b8',fontWeight:600}}>{t}T</div>
              </div>
            ))}
          </div>
          <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',fontSize:11,color:'#6366f1',background:'rgba(99,102,241,0.1)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(99,102,241,0.2)',whiteSpace:'nowrap'}}>
            {KINGDOM_ICON[k]} {KINGDOM_DESC[k].split('.')[0]}
          </div>
        </div>
        {/* East */}
        <div style={{gridColumn:'3',gridRow:'2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 6px'}}>
          <div style={{fontSize:11,color:state.currentPlayerIndex===3?'#facc15':'#64748b',writingMode:'vertical-lr',marginBottom:4,fontWeight:600}}>
            {PLAYER_NAMES[3]}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>{state.hands[3].map((_,i)=><CardBack key={i} small/>)}</div>
        </div>
        {/* Your hand */}
        <div style={{gridColumn:'1/4',gridRow:'3',padding:'6px 0 4px'}}>
          <div style={{textAlign:'center',marginBottom:8,fontSize:13,color:'#94a3b8'}}>
            <span style={{background:'rgba(255,255,255,0.05)',borderRadius:20,padding:'3px 14px'}}>{state.message}</span>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:3,flexWrap:'wrap',padding:'0 12px'}}>
            {myHand.map((card,i)=>{
              const isLegal = legal.some(c=>c.suit===card.suit&&c.rank===card.rank)
              return (
                <CardFace key={`${card.suit}${card.rank}`} card={card}
                  highlight={isLegal&&state.currentPlayerIndex===0}
                  grayed={state.currentPlayerIndex===0&&!isLegal}
                  penalty={cardPenalty(card)}
                  onClick={isLegal&&state.currentPlayerIndex===0?()=>onPlay(i):undefined}
                />
              )
            })}
          </div>
          {state.currentPlayerIndex===0&&(
            <div style={{textAlign:'center',marginTop:5,fontSize:11,color:'#facc15'}}>
              {state.leadSuit?`Must follow ${SUIT_SYM[state.leadSuit]} if possible`:'Lead any card'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrixTable({state,onPlay,trickFlash}:{state:MatchState;onPlay:(i:number)=>void;trickFlash:{winner:number;label:string}|null}){
  const myHand = sortCards(state.hands[0])
  const legal = state.currentPlayerIndex===0 ? legalTrixMoves(state.hands[0],state.trixBoard) : []
  const board = state.trixBoard

  const rankLabel = (rv:number):string => RANKS[rv-2]??''

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1a0a2e,#0f172a)',display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif',color:'white',userSelect:'none'}}>
      <style>{`.card-hover:hover{transform:translateY(-8px) scale(1.06);box-shadow:0 10px 28px rgba(168,85,247,0.5)!important}@keyframes slideIn{from{opacity:0;transform:scale(0.4)}to{opacity:1;transform:scale(1)}}`}</style>
      <ScoreBar state={state}/>

      {/* Trix Board */}
      <div style={{padding:'10px 16px',background:'rgba(0,0,0,0.2)',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{fontSize:11,color:'#64748b',marginBottom:6,textAlign:'center',textTransform:'uppercase',letterSpacing:2}}>Trix Board — Build sequences around Jacks</div>
        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
          {SUITS.map(s=>{
            const line = board[s]
            const cells: string[] = []
            if(line.started){
              for(let rv=line.low;rv<=line.high;rv++) cells.push(rankLabel(rv))
            }
            return (
              <div key={s} style={{background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'8px 12px',border:'1px solid rgba(255,255,255,0.08)',minWidth:90,textAlign:'center'}}>
                <div style={{color:SUIT_COLOR[s],fontWeight:700,fontSize:16,marginBottom:4}}>{SUIT_SYM[s]}</div>
                {!line.started?<div style={{color:'#334155',fontSize:11}}>Not started</div>:(
                  <div>
                    <div style={{color:'#94a3b8',fontSize:10}}>↑ next: {line.high<14?rankLabel(line.high+1):'—'}</div>
                    <div style={{display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center',margin:'3px 0'}}>
                      {cells.map(r=><span key={r} style={{background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:4,padding:'1px 5px',fontSize:10,color:'#a5b4fc'}}>{r}</span>)}
                    </div>
                    <div style={{color:'#94a3b8',fontSize:10}}>↓ next: {line.low>2?rankLabel(line.low-1):'—'}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Players status */}
      <div style={{display:'flex',gap:8,padding:'8px 16px',justifyContent:'center',flexWrap:'wrap'}}>
        {PLAYER_NAMES.map((name,i)=>(
          <div key={i} style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'5px 12px',border:`1px solid ${state.currentPlayerIndex===i?'rgba(250,204,21,0.5)':state.trixActivePlayers[i]?'rgba(255,255,255,0.08)':'rgba(74,222,128,0.3)'}`,textAlign:'center'}}>
            <div style={{fontSize:11,color:state.currentPlayerIndex===i?'#facc15':state.trixActivePlayers[i]?'#64748b':'#4ade80'}}>{name}</div>
            <div style={{fontSize:12,color:'#94a3b8'}}>
              {!state.trixActivePlayers[i]?<span style={{color:'#4ade80'}}>#{state.trixFinishOrder.indexOf(i)+1} Done</span>:`${state.hands[i].length} cards`}
            </div>
          </div>
        ))}
      </div>

      {/* Message */}
      <div style={{textAlign:'center',padding:'4px 0',fontSize:13,color:'#94a3b8'}}>
        <span style={{background:'rgba(255,255,255,0.05)',borderRadius:20,padding:'3px 16px'}}>{state.message}</span>
      </div>

      {/* Other players hand counts */}
      <div style={{flex:1,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
        {/* Your hand */}
        <div style={{width:'100%',padding:'8px 12px 6px'}}>
          <div style={{display:'flex',justifyContent:'center',gap:3,flexWrap:'wrap'}}>
            {myHand.map((card,i)=>{
              const isLegal = legal.some(c=>c.suit===card.suit&&c.rank===card.rank)
              return (
                <CardFace key={`${card.suit}${card.rank}`} card={card}
                  highlight={isLegal&&state.currentPlayerIndex===0}
                  grayed={state.currentPlayerIndex===0&&!isLegal}
                  onClick={isLegal&&state.currentPlayerIndex===0?()=>onPlay(i):undefined}
                />
              )
            })}
          </div>
          {state.currentPlayerIndex===0&&legal.length===0&&state.trixActivePlayers[0]&&(
            <div style={{textAlign:'center',marginTop:6,fontSize:12,color:'#f87171'}}>No legal moves — you must pass this turn</div>
          )}
          {state.currentPlayerIndex===0&&legal.length>0&&(
            <div style={{textAlign:'center',marginTop:5,fontSize:11,color:'#facc15'}}>Play a highlighted card</div>
          )}
        </div>
      </div>
    </div>
  )
}

function HandEnd({state}:{state:MatchState}){
  const hs = state.handScores
  const k = state.selectedKingdom!
  return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20,gap:20}}>
      <ScoreBar state={state}/>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:4}}>{KINGDOM_ICON[k]}</div>
        <h2 style={{margin:0,fontSize:28,fontWeight:800}}>Hand {state.handNumber} Complete</h2>
        <p style={{color:'#64748b',margin:'4px 0 0'}}>{KINGDOM_LABEL[k]} — owned by {PLAYER_NAMES[state.ownerIndex]}</p>
      </div>
      {k==='trix'&&(
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:'16px 24px',border:'1px solid rgba(255,255,255,0.08)',width:'100%',maxWidth:380}}>
          <div style={{fontWeight:700,color:'#e2e8f0',marginBottom:10,textAlign:'center'}}>Trix Finish Order</div>
          {state.trixFinishOrder.map((pi,pos)=>(
            <div key={pi} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <span style={{color:pos===0?'#fbbf24':pos===1?'#94a3b8':pos===2?'#b45309':'#ef4444'}}>#{pos+1} {PLAYER_NAMES[pi]}</span>
              <span style={{fontWeight:700,color:TRIX_SCORES[pos]<0?'#f87171':'#4ade80'}}>{TRIX_SCORES[pos]} pts</span>
            </div>
          ))}
        </div>
      )}
      {k!=='trix'&&(
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:'16px 24px',border:'1px solid rgba(255,255,255,0.08)',width:'100%',maxWidth:380}}>
          <div style={{fontWeight:700,color:'#e2e8f0',marginBottom:10,textAlign:'center'}}>Hand Scores</div>
          {PLAYER_NAMES.map((name,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <span>{name}</span>
              <span style={{fontWeight:700,color:hs[i]<0?'#f87171':hs[i]===0?'#94a3b8':'#4ade80'}}>{hs[i]===0?'0':hs[i]}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{background:'rgba(255,255,255,0.03)',borderRadius:14,padding:'12px 24px',border:'1px solid rgba(255,255,255,0.07)',width:'100%',maxWidth:380}}>
        <div style={{fontWeight:700,color:'#e2e8f0',marginBottom:8,textAlign:'center'}}>Total Scores</div>
        {state.totalScores.map((s,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
            <span style={{color:'#94a3b8'}}>{PLAYER_NAMES[i]}</span>
            <span style={{fontWeight:700,color:s<0?'#f87171':s===0?'#94a3b8':'#4ade80'}}>{s}</span>
          </div>
        ))}
      </div>
      {state.handNumber<20&&<div style={{color:'#64748b',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
        <div style={{width:12,height:12,borderRadius:'50%',border:'2px solid #6366f1',borderTopColor:'transparent',animation:'spin 1s linear infinite'}}/>
        Next hand starting...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>}
    </div>
  )
}

function MatchEnd({state,onRestart}:{state:MatchState;onRestart:()=>void}){
  const maxScore = Math.max(...state.totalScores)
  const winner = state.totalScores.indexOf(maxScore)
  const sorted = state.totalScores.map((s,i)=>({i,s})).sort((a,b)=>b.s-a.s)
  return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',color:'white',padding:20,gap:24}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:72,marginBottom:6}}>{winner===0?'🏆':'🎴'}</div>
        <h1 style={{fontSize:40,fontWeight:900,margin:0,color:winner===0?'#facc15':'#e2e8f0'}}>{winner===0?'You Win!':'Game Over'}</h1>
        <p style={{color:'#94a3b8',marginTop:6}}>20 Hands Complete — Full Match Finished</p>
      </div>
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:18,padding:28,minWidth:340,border:'1px solid rgba(255,255,255,0.1)'}}>
        <h3 style={{margin:'0 0 16px',textAlign:'center',color:'#e2e8f0'}}>Final Scoreboard</h3>
        {sorted.map(({i,s},pos)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:pos<3?'1px solid rgba(255,255,255,0.06)':'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>{pos===0?'🥇':pos===1?'🥈':pos===2?'🥉':'4️⃣'}</span>
              <span style={{fontWeight:600,color:i===winner?'#facc15':'#e2e8f0'}}>{PLAYER_NAMES[i]}</span>
            </div>
            <span style={{fontWeight:800,fontSize:22,color:s<0?'#f87171':s===0?'#94a3b8':'#4ade80'}}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:12}}>
        <button onClick={onRestart} style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)',color:'white',border:'none',padding:'13px 32px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:15}}>Play Again</button>
      </div>
      {/* Hand history */}
      <div style={{width:'100%',maxWidth:560}}>
        <div style={{fontWeight:700,color:'#64748b',fontSize:12,textAlign:'center',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Match History</div>
        <div style={{display:'flex',flexDirection:'column',gap:3,maxHeight:200,overflowY:'auto'}}>
          {state.handHistory.map((h,i)=>(
            <div key={i} style={{display:'flex',gap:8,alignItems:'center',background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'5px 12px',fontSize:12}}>
              <span style={{color:'#64748b',minWidth:28}}>#{h.handNum}</span>
              <span style={{color:'#94a3b8',minWidth:60}}>{PLAYER_NAMES[h.owner]}</span>
              <span>{KINGDOM_ICON[h.kingdom]}</span>
              <span style={{color:'#a5b4fc',minWidth:70}}>{KINGDOM_LABEL[h.kingdom]}</span>
              <span style={{display:'flex',gap:6,flex:1,justifyContent:'flex-end'}}>
                {h.scores.map((s,pi)=><span key={pi} style={{color:s<0?'#f87171':s===0?'#64748b':'#4ade80',minWidth:28,textAlign:'right'}}>{s}</span>)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
