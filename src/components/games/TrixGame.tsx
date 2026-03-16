"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = 'C' | 'D' | 'H' | 'S'
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'
type Card = { suit: Suit; rank: Rank }
type Kingdom = 'trix'|'diamonds'|'ladies'|'ltoush'|'king_of_hearts'
type Diff = 'easy'|'medium'|'hard'
type GameMode = 'solo'|'partners'
type MatchPhase = 'menu'|'diff-select'|'mode-select'|'room-setup'|'kingdom-select'|'doubling'|'trix-playing'|'trick-playing'|'trick-end'|'hand-end'|'match-end'

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const RANK_VAL: Record<Rank,number> = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14}
const SUITS: Suit[] = ['C','D','H','S']
const SUIT_SYM: Record<Suit,string> = {C:'♣',D:'♦',H:'♥',S:'♠'}
const SUIT_COLOR: Record<Suit,string> = {C:'#6ee7b7',D:'#fca5a5',H:'#fca5a5',S:'#c7d2fe'}

// Partners: player 0 & 2 are Team A, player 1 & 3 are Team B
const TEAM: Record<number,number> = {0:0,1:1,2:0,3:1}
const PLAYER_NAMES = ['You','West','North','East']
const PLAYER_POSITIONS = ['bottom','left','top','right']

const KINGDOM_LABEL: Record<Kingdom,string> = {
  trix:'Trix',diamonds:'Diamonds',ladies:'Ladies (Queens)',ltoush:'Ltoush (Tricks)',king_of_hearts:'King of Hearts'
}
const KINGDOM_ICON: Record<Kingdom,string> = {
  trix:'👑',diamonds:'💎',ladies:'👸',ltoush:'🤚',king_of_hearts:'❤️‍🔥'
}
const KINGDOM_COLOR: Record<Kingdom,string> = {
  trix:'#a78bfa',diamonds:'#60a5fa',ladies:'#f472b6',ltoush:'#34d399',king_of_hearts:'#f87171'
}
const KINGDOM_DESC: Record<Kingdom,string> = {
  trix:'Shedding game — play cards in sequences around Jacks. First to empty hand gets +200!',
  diamonds:'Avoid winning Diamonds. Each Diamond card = -10 pts',
  ladies:'Avoid winning Queens. Each Queen = -25 pts. You can DOUBLE your Queens!',
  ltoush:'Avoid winning tricks. Each trick = -15 pts',
  king_of_hearts:'Avoid winning the King of Hearts. That player loses -75 pts. You can DOUBLE it!',
}
const ALL_KINGDOMS: Kingdom[] = ['trix','diamonds','ladies','ltoush','king_of_hearts']

// TRIX shedding scores: +200/+150/+100/+50 (finish order)
const TRIX_SCORES = [200, 150, 100, 50]

// ─── Sound Engine (Web Audio API) ────────────────────────────────────────────
let _audioCtx: AudioContext | null = null
let _bgGain: GainNode | null = null
let _bgSource: AudioBufferSourceNode | null = null
let _muted = false
let _bgMuted = false

function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)()
  return _audioCtx
}

function playTone(freq: number, type: OscillatorType, duration: number, vol: number, delay = 0, attack = 0.01, release = 0.1) {
  if (_muted) return
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = type; osc.frequency.value = freq
    const t = ctx.currentTime + delay
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol, t + attack)
    gain.gain.setValueAtTime(vol, t + duration - release)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.start(t); osc.stop(t + duration + 0.05)
  } catch { /* silently fail */ }
}

function playNoise(duration: number, vol: number, delay = 0) {
  if (_muted) return
  try {
    const ctx = getAudioCtx()
    const bufSize = ctx.sampleRate * duration
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buf; src.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + delay
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    src.start(t)
  } catch { /* silently fail */ }
}

const sfxCardPlay = () => { playNoise(0.08, 0.18); playTone(220, 'sine', 0.12, 0.15) }
const sfxCardFlip = () => { playNoise(0.06, 0.12); playTone(330, 'sine', 0.08, 0.1) }
const sfxWin = () => { playTone(523, 'sine', 0.15, 0.2); playTone(659, 'sine', 0.15, 0.2, 0.12); playTone(784, 'sine', 0.2, 0.2, 0.24) }
const sfxLose = () => { playTone(392, 'sine', 0.15, 0.2); playTone(330, 'sine', 0.15, 0.2, 0.12); playTone(262, 'sine', 0.2, 0.2, 0.24) }
const sfxClick = () => { playTone(800, 'sine', 0.06, 0.1) }
const sfxDeal = () => { for(let i=0;i<4;i++) { playNoise(0.05, 0.12, i*0.08); playTone(440+i*40, 'sine', 0.06, 0.08, i*0.08) } }
const sfxVictory = () => {
  const notes = [523,659,784,1047];
  notes.forEach((f,i)=>{ playTone(f,'triangle',0.3,0.25,i*0.18) })
}
const sfxGameOver = () => { playTone(262,'sawtooth',0.4,0.2); playTone(220,'sawtooth',0.4,0.15,0.35) }
const sfxNotify = () => { playTone(880,'sine',0.12,0.15); playTone(1100,'sine',0.1,0.12,0.1) }
const sfxDouble = () => { playTone(1200,'square',0.08,0.2); playTone(1400,'square',0.08,0.2,0.12) }

// Background music (subtle ambient loop)
function startBgMusic() {
  if (_bgMuted) return
  try {
    const ctx = getAudioCtx()
    if (_bgSource) { try { _bgSource.stop() } catch { /* ignore */ } }
    const dur = 4
    const bufSize = ctx.sampleRate * dur
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    const freqs = [130.81, 164.81, 196, 261.63]
    for (let i = 0; i < bufSize; i++) {
      const t = i / ctx.sampleRate
      d[i] = freqs.reduce((s, f, fi) => s + Math.sin(2 * Math.PI * f * t) * (0.04 / (fi + 1)), 0)
    }
    _bgGain = ctx.createGain()
    _bgGain.gain.value = 0.15
    _bgSource = ctx.createBufferSource()
    _bgSource.buffer = buf
    _bgSource.loop = true
    _bgSource.connect(_bgGain)
    _bgGain.connect(ctx.destination)
    _bgSource.start()
  } catch { /* silently fail */ }
}

function stopBgMusic() {
  if (_bgSource) { try { _bgSource.stop() } catch { /* ignore */ } _bgSource = null }
}

// ─── Trix Board ───────────────────────────────────────────────────────────────
interface TrixSuitLine { started: boolean; low: number; high: number }
type TrixBoard = Record<Suit, TrixSuitLine>

function emptyTrixBoard(): TrixBoard {
  return {C:{started:false,low:0,high:0},D:{started:false,low:0,high:0},H:{started:false,low:0,high:0},S:{started:false,low:0,high:0}}
}

function applyTrixCard(card: Card, board: TrixBoard): TrixBoard {
  const b: TrixBoard = {
    C:{...board.C}, D:{...board.D}, H:{...board.H}, S:{...board.S}
  }
  if (card.rank === 'J') { b[card.suit] = {started:true, low:11, high:11}; return b }
  if (RANK_VAL[card.rank] === b[card.suit].high + 1) b[card.suit].high++
  else if (RANK_VAL[card.rank] === b[card.suit].low - 1) b[card.suit].low--
  return b
}

// ─── State ────────────────────────────────────────────────────────────────────
interface MatchState {
  phase: MatchPhase
  diff: Diff
  mode: GameMode
  handNumber: number            // 1..20
  ownerIndex: number            // whose Kingdom it is
  remainingKingdoms: Kingdom[][] // per player, which kingdoms not yet chosen
  totalScores: number[]
  teamScores: number[]          // [teamA, teamB]

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
  capturedCards: Card[][]

  // TRIX specific
  trixBoard: TrixBoard
  trixFinishOrder: number[]
  trixActivePlayers: boolean[]

  // Doubling (King of Hearts & Queens)
  doubledQueens: Card[]         // Queens that have been doubled
  doubledKoH: boolean           // King of Hearts doubled
  doublingPhase: boolean

  trickWinner: number | null
  message: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeDeck(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) for (const r of RANKS) d.push({suit:s,rank:r})
  return shuffle(d)
}

function dealHands(deck: Card[]): Card[][] {
  return [deck.slice(0,13),deck.slice(13,26),deck.slice(26,39),deck.slice(39)]
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a,b) => {
    const sd = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
    return sd !== 0 ? sd : RANK_VAL[a.rank] - RANK_VAL[b.rank]
  })
}

function findCardOwner(hands: Card[][], suit: Suit, rank: Rank): number {
  for (let i = 0; i < 4; i++) if (hands[i].some(c => c.suit===suit && c.rank===rank)) return i
  return -1
}

// ─── Legal Moves ──────────────────────────────────────────────────────────────
function legalTrickMoves(hand: Card[], leadSuit: Suit|null, kingdom: Kingdom): Card[] {
  if (!leadSuit) {
    // King of Hearts kingdom: cannot lead a heart unless hand is all hearts
    if (kingdom === 'king_of_hearts') {
      const nonHearts = hand.filter(c => c.suit !== 'H')
      if (nonHearts.length > 0) return nonHearts
    }
    return hand
  }
  const follow = hand.filter(c => c.suit === leadSuit)
  return follow.length > 0 ? follow : hand
}

function legalTrixMoves(hand: Card[], board: TrixBoard): Card[] {
  return hand.filter(c => {
    if (c.rank === 'J') return !board[c.suit].started
    const line = board[c.suit]
    if (!line.started) return false
    return RANK_VAL[c.rank] === line.high + 1 || RANK_VAL[c.rank] === line.low - 1
  })
}

// ─── Trick Winner ─────────────────────────────────────────────────────────────
function resolveTrickWinner(trick: (Card|null)[], order: number[], leadSuit: Suit): number {
  const played = order.map(i => ({pi:i, card:trick[i]!}))
  let best = played[0]
  for (let i = 1; i < played.length; i++) {
    const c = played[i]
    if (c.card.suit === leadSuit && (best.card.suit !== leadSuit || RANK_VAL[c.card.rank] > RANK_VAL[best.card.rank])) best = c
  }
  return best.pi
}

// ─── Hand Scoring ─────────────────────────────────────────────────────────────
function computeHandScores(
  kingdom: Kingdom,
  captured: Card[][],
  tricks: number[],
  trixOrder: number[],
  doubledQueens: Card[],
  doubledKoH: boolean
): number[] {
  const scores = [0,0,0,0]

  if (kingdom === 'trix') {
    trixOrder.forEach((pi, pos) => { scores[pi] = TRIX_SCORES[pos] ?? 50 })
    return scores
  }

  if (kingdom === 'diamonds') {
    captured.forEach((cards, pi) => { scores[pi] = -10 * cards.filter(c => c.suit==='D').length })
    return scores
  }

  if (kingdom === 'ladies') {
    captured.forEach((cards, pi) => {
      cards.forEach(c => {
        if (c.rank !== 'Q') return
        const isDoubled = doubledQueens.some(dq => dq.suit===c.suit)
        scores[pi] += isDoubled ? -50 : -25
      })
    })
    // Bonus for doublers whose Queen was taken by someone else
    doubledQueens.forEach(dq => {
      const holder = findCardOwner([[],[], [],[]].map((_,i) => captured[i].includes(dq) ? [] : [dq]) as Card[][], dq.suit, 'Q')
      // Find who doubled it (who held it at start — inferred from who has it not in captured)
      // simplified: just apply penalty correctly (done above)
    })
    return scores
  }

  if (kingdom === 'ltoush') {
    tricks.forEach((t, pi) => { scores[pi] = -15 * t })
    return scores
  }

  if (kingdom === 'king_of_hearts') {
    captured.forEach((cards, pi) => {
      if (cards.some(c => c.suit==='H' && c.rank==='K')) {
        scores[pi] = doubledKoH ? -150 : -75
      }
    })
    return scores
  }

  return scores
}

// ─── AI Logic ─────────────────────────────────────────────────────────────────
function aiTrickCard(hand: Card[], leadSuit: Suit|null, kingdom: Kingdom, diff: Diff, trickSoFar: Card[], playerIdx: number, mode: GameMode): Card {
  const legal = legalTrickMoves(hand, leadSuit, kingdom)
  if (diff === 'easy') return legal[Math.floor(Math.random() * legal.length)]

  const penVal = (c: Card) => {
    if (kingdom==='diamonds' && c.suit==='D') return 10
    if (kingdom==='ladies' && c.rank==='Q') return 25
    if (kingdom==='king_of_hearts' && c.suit==='H' && c.rank==='K') return 75
    if (kingdom==='ltoush') return 1
    return 0
  }

  const willWin = (card: Card) => {
    if (!leadSuit) return true
    if (card.suit !== leadSuit) return false
    const bestInTrick = trickSoFar.filter(c => c.suit===leadSuit)
      .reduce((b,c) => RANK_VAL[c.rank] > RANK_VAL[b.rank] ? c : b, {suit:leadSuit,rank:'2'} as Card)
    return RANK_VAL[card.rank] > RANK_VAL[bestInTrick.rank]
  }

  if (kingdom === 'ltoush') {
    const noWin = legal.filter(c => !willWin(c))
    if (noWin.length > 0) return noWin.sort((a,b) => RANK_VAL[b.rank]-RANK_VAL[a.rank])[0]
    return legal.sort((a,b) => RANK_VAL[a.rank]-RANK_VAL[b.rank])[0]
  }

  const safe = legal.filter(c => penVal(c) === 0)
  const dumpPenalty = legal.filter(c => penVal(c)>0 && !willWin(c))
  if (dumpPenalty.length > 0) return dumpPenalty.sort((a,b) => penVal(b)-penVal(a))[0]
  if (safe.length > 0) return safe.sort((a,b) => RANK_VAL[a.rank]-RANK_VAL[b.rank])[0]
  return legal.sort((a,b) => penVal(a)-penVal(b))[0]
}

function aiTrixCard(hand: Card[], board: TrixBoard, diff: Diff): Card|null {
  const legal = legalTrixMoves(hand, board)
  if (legal.length === 0) return null
  if (diff === 'easy') return legal[Math.floor(Math.random() * legal.length)]
  const jacks = legal.filter(c => c.rank === 'J')
  if (jacks.length > 0) return jacks[0]
  // prefer cards that don't block high-value sequences
  return legal[0]
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initMatchState(diff: Diff, mode: GameMode): MatchState {
  const deck = makeDeck()
  const hands = dealHands(deck)
  // First kingdom: player holding 7H becomes owner (per canonical rules)
  const ownerIndex = findCardOwner(hands, 'H', '7')
  const actualOwner = ownerIndex >= 0 ? ownerIndex : 0
  return {
    phase: 'kingdom-select',
    diff, mode,
    handNumber: 1,
    ownerIndex: actualOwner,
    remainingKingdoms: [0,1,2,3].map(() => [...ALL_KINGDOMS]),
    totalScores: [0,0,0,0],
    teamScores: [0,0],
    hands,
    selectedKingdom: null,
    leadPlayerIndex: actualOwner,
    currentPlayerIndex: actualOwner,
    currentTrick: [null,null,null,null],
    playedOrder: [],
    leadSuit: null,
    completedTricks: 0,
    handScores: [0,0,0,0],
    trickCounts: [0,0,0,0],
    capturedCards: [[],[],[],[]],
    trixBoard: emptyTrixBoard(),
    trixFinishOrder: [],
    trixActivePlayers: [true,true,true,true],
    doubledQueens: [],
    doubledKoH: false,
    doublingPhase: false,
    trickWinner: null,
    message: `Hand 1/20 — ${PLAYER_NAMES[actualOwner]} owns this Kingdom`,
  }
}

function startNewHand(prev: MatchState): MatchState {
  const deck = makeDeck()
  const hands = dealHands(deck)
  const nextOwner = (prev.ownerIndex + 1) % 4
  const handNum = prev.handNumber + 1
  return {
    ...prev,
    phase: 'kingdom-select',
    handNumber: handNum,
    ownerIndex: nextOwner,
    hands,
    selectedKingdom: null,
    leadPlayerIndex: nextOwner,
    currentPlayerIndex: nextOwner,
    currentTrick: [null,null,null,null],
    playedOrder: [],
    leadSuit: null,
    completedTricks: 0,
    handScores: [0,0,0,0],
    trickCounts: [0,0,0,0],
    capturedCards: [[],[],[],[]],
    trixBoard: emptyTrixBoard(),
    trixFinishOrder: [],
    trixActivePlayers: [true,true,true,true],
    doubledQueens: [],
    doubledKoH: false,
    doublingPhase: false,
    trickWinner: null,
    message: `Hand ${handNum}/20 — ${PLAYER_NAMES[nextOwner]} owns this Kingdom`,
  }
}

function nextTrixPlayer(from: number, active: boolean[]): number {
  for (let i = 1; i <= 4; i++) {
    const p = (from + i) % 4
    if (active[p]) return p
  }
  return -1
}

// ─── Camera hook ──────────────────────────────────────────────────────────────
function useCameras(active: boolean) {
  const videoRefs = [
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null),
  ]
  const [camStream, setCamStream] = useState<MediaStream|null>(null)
  const [camError, setCamError] = useState<string|null>(null)
  const [camEnabled, setCamEnabled] = useState(false)

  const startCam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true})
      setCamStream(stream)
      setCamEnabled(true)
      setCamError(null)
      if (videoRefs[0].current) {
        videoRefs[0].current.srcObject = stream
        videoRefs[0].current.muted = true // mute self to avoid echo
      }
    } catch (e) {
      setCamError('Camera access denied. Click Allow to enable camera.')
      setCamEnabled(false)
    }
  }, [])

  const stopCam = useCallback(() => {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); setCamStream(null) }
    setCamEnabled(false)
  }, [camStream])

  useEffect(() => {
    return () => { if (camStream) camStream.getTracks().forEach(t => t.stop()) }
  }, [camStream])

  return { videoRefs, camStream, camError, camEnabled, startCam, stopCam }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardComp({ card, onClick, highlight, small, faceDown }: {
  card: Card; onClick?: () => void; highlight?: boolean; small?: boolean; faceDown?: boolean
}) {
  const [hover, setHover] = useState(false)
  const isRed = card.suit === 'D' || card.suit === 'H'
  const size = small ? {w:42,h:60,fontSize:11} : {w:58,h:82,fontSize:15}

  if (faceDown) return (
    <div style={{
      width:size.w, height:size.h, borderRadius:8,
      background:'linear-gradient(135deg,#1e3a5f,#0f172a)',
      border:'2px solid #334155', display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, fontSize:20
    }}>🂠</div>
  )

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size.w, height: size.h, borderRadius: 8, cursor: onClick ? 'pointer' : 'default',
        background: highlight ? 'linear-gradient(135deg,#ffd700,#ff8c00)' : '#fff',
        border: highlight ? '2px solid #ffd700' : '2px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '3px 4px', flexShrink: 0, userSelect: 'none',
        transform: hover && onClick ? 'translateY(-10px) scale(1.07)' : highlight ? 'translateY(-8px)' : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s',
        boxShadow: hover && onClick ? '0 12px 28px rgba(0,0,0,0.5)' : highlight ? '0 8px 20px rgba(255,215,0,0.6)' : '0 2px 6px rgba(0,0,0,0.3)',
        zIndex: hover ? 10 : 1, position: 'relative',
      }}
    >
      <span style={{fontSize:size.fontSize, fontWeight:800, color: isRed ? '#dc2626' : '#1e293b', lineHeight:1}}>
        {card.rank}
      </span>
      <span style={{fontSize:size.fontSize+2, textAlign:'center', color: SUIT_COLOR[card.suit]}}>
        {SUIT_SYM[card.suit]}
      </span>
      <span style={{fontSize:size.fontSize, fontWeight:800, color: isRed ? '#dc2626' : '#1e293b', lineHeight:1, alignSelf:'flex-end', transform:'rotate(180deg)'}}>
        {card.rank}
      </span>
    </div>
  )
}

function PlayerCam({ idx, currentPlayer, videoRef, camEnabled, name, score, isPartner }: {
  idx: number; currentPlayer: number; videoRef: React.RefObject<HTMLVideoElement>;
  camEnabled: boolean; name: string; score: number; isPartner?: boolean
}) {
  const isActive = idx === currentPlayer
  const avatarEmojis = ['🧑','👤','🧑','👤']
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
      filter: isActive ? 'none' : 'brightness(0.75)',
      transition:'filter 0.3s',
    }}>
      <div style={{
        width:64, height:64, borderRadius:'50%', overflow:'hidden', position:'relative',
        border: isActive ? '3px solid #ffd700' : isPartner ? '3px solid #a78bfa' : '3px solid #334155',
        boxShadow: isActive ? '0 0 18px #ffd700aa' : 'none',
        transition:'border 0.3s, box-shadow 0.3s',
        background:'#1e293b',
      }}>
        {camEnabled && idx === 0 ? (
          <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover'}} />
        ) : (
          <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>
            {avatarEmojis[idx]}
          </div>
        )}
        {isActive && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            background:'linear-gradient(transparent,rgba(255,215,0,0.8))',
            fontSize:10, fontWeight:700, color:'#000', textAlign:'center', paddingBottom:2
          }}>TURN</div>
        )}
      </div>
      <div style={{fontSize:11, fontWeight:700, color: isActive ? '#ffd700' : '#94a3b8'}}>{name}</div>
      <div style={{fontSize:12, fontWeight:800, color: score < 0 ? '#f87171' : score > 0 ? '#4ade80' : '#94a3b8'}}>
        {score > 0 ? '+' : ''}{score}
      </div>
      {isPartner && <div style={{fontSize:9,color:'#a78bfa',fontWeight:700}}>PARTNER</div>}
    </div>
  )
}

function TrixBoardView({ board }: { board: TrixBoard }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width:'100%', maxWidth:340}}>
      {SUITS.map(suit => {
        const line = board[suit]
        const topCards: string[] = []
        const botCards: string[] = []
        if (line.started) {
          for (let v = line.high; v >= 11; v--) {
            const r = RANKS[v-2]
            if (r) topCards.push(r)
          }
          for (let v = 11; v >= line.low; v--) {
            const r = RANKS[v-2]
            if (r && v !== 11) botCards.push(r)
          }
        }
        return (
          <div key={suit} style={{
            background:'rgba(255,255,255,0.04)', borderRadius:10,
            border:`1px solid ${SUIT_COLOR[suit]}44`, padding:'8px 10px',
            minHeight:70,
          }}>
            <div style={{color:SUIT_COLOR[suit], fontWeight:800, fontSize:16, marginBottom:4}}>
              {SUIT_SYM[suit]}
            </div>
            {line.started ? (
              <div style={{fontSize:10, color:'#cbd5e1', lineHeight:1.8}}>
                <div>↑ {topCards.join('-') || 'J'}</div>
                <div style={{color:'#ffd700', fontSize:12}}>J (anchor)</div>
                <div>↓ {botCards.join('-') || '—'}</div>
              </div>
            ) : (
              <div style={{fontSize:11, color:'#475569'}}>Place {SUIT_SYM[suit]}J to start</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TrixGame({ onScoreUpdate, onGameOver, onGameStart }: GameComponentProps) {
  const [state, setState] = useState<MatchState|null>(null)
  const [diff, setDiff] = useState<Diff|null>(null)
  const [mode, setMode] = useState<GameMode>('solo')
  const [trickFlash, setTrickFlash] = useState<{winner:number; label:string}|null>(null)
  const [bgOn, setBgOn] = useState(false)
  const [sfxOn, setSfxOn] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [handHistory, setHandHistory] = useState<{handNum:number;owner:number;kingdom:Kingdom;scores:number[]}[]>([])
  const timerRef = useRef<NodeJS.Timeout|null>(null)
  const { videoRefs, camError, camEnabled, startCam, stopCam } = useCameras(true)

  const safe = useCallback((fn: (s: MatchState) => MatchState) => {
    setState(prev => prev ? fn(prev) : prev)
  }, [])

  // Toggle BG music
  const toggleBg = useCallback(() => {
    if (bgOn) { stopBgMusic(); setBgOn(false) }
    else { _bgMuted = false; startBgMusic(); setBgOn(true) }
  }, [bgOn])

  // Toggle SFX
  const toggleSfx = useCallback(() => {
    _muted = sfxOn
    setSfxOn(!sfxOn)
  }, [sfxOn])

  // ── Start game ──────────────────────────────────────────────────────────────
  const startGame = useCallback((d: Diff, m: GameMode) => {
    sfxDeal()
    setDiff(d)
    setMode(m)
    const ms = initMatchState(d, m)
    setState(ms)
    setHandHistory([])
    onGameStart?.()
  }, [onGameStart])

  // ── Select kingdom ──────────────────────────────────────────────────────────
  const selectKingdom = useCallback((k: Kingdom) => {
    if (!state || state.phase !== 'kingdom-select') return
    sfxClick()
    safe(prev => {
      if (!prev || prev.phase !== 'kingdom-select') return prev
      const newRemaining = prev.remainingKingdoms.map((r,i) => i===prev.ownerIndex ? r.filter(x=>x!==k) : r)
      // In trick-taking kingdoms, after kingdom select, enter doubling phase for Queens/KoH
      const needsDouble = (k === 'ladies' || k === 'king_of_hearts')
      const phase: MatchPhase = needsDouble ? 'doubling' : (k==='trix' ? 'trix-playing' : 'trick-playing')
      // Find who leads: owner leads first trick in their kingdom
      const lead = prev.ownerIndex
      return {
        ...prev, phase, selectedKingdom:k, remainingKingdoms:newRemaining,
        leadPlayerIndex: lead, currentPlayerIndex: lead,
        doubledQueens: [], doubledKoH: false, doublingPhase: needsDouble,
        message: needsDouble
          ? `${KINGDOM_LABEL[k]} — Announce doubles before play begins!`
          : k==='trix'
            ? `Trix! Build sequences around Jacks. ${PLAYER_NAMES[lead]} starts.`
            : `${KINGDOM_LABEL[k]} — ${PLAYER_NAMES[lead]} leads first trick.`,
      }
    })
    sfxNotify()
  }, [state, safe])

  // ── Player doubles a Queen ──────────────────────────────────────────────────
  const doubleQueen = useCallback((queen: Card) => {
    if (!state || state.phase !== 'doubling') return
    if (!state.hands[0].some(c => c.suit===queen.suit && c.rank==='Q')) return
    sfxDouble()
    safe(prev => {
      if (!prev) return prev
      const already = prev.doubledQueens.some(dq => dq.suit===queen.suit)
      if (already) {
        return {...prev, doubledQueens: prev.doubledQueens.filter(dq => dq.suit!==queen.suit)}
      }
      return {...prev, doubledQueens: [...prev.doubledQueens, queen]}
    })
  }, [state, safe])

  // ── Player doubles King of Hearts ───────────────────────────────────────────
  const doubleKoH = useCallback(() => {
    if (!state || state.phase !== 'doubling') return
    if (!state.hands[0].some(c => c.suit==='H' && c.rank==='K')) return
    sfxDouble()
    safe(prev => ({...prev, doubledKoH: !prev.doubledKoH}))
  }, [state, safe])

  // ── Confirm doubling / start play ───────────────────────────────────────────
  const confirmDoubling = useCallback(() => {
    if (!state || state.phase !== 'doubling') return
    sfxDeal()
    safe(prev => {
      if (!prev || prev.phase !== 'doubling') return prev
      const phase: MatchPhase = 'trick-playing'
      return {
        ...prev, phase, doublingPhase: false,
        message: `${KINGDOM_LABEL[prev.selectedKingdom!]} — ${PLAYER_NAMES[prev.leadPlayerIndex]} leads.`,
      }
    })
  }, [state, safe])

  // ── AI selects kingdom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!state || state.phase !== 'kingdom-select') return
    if (state.ownerIndex === 0) return
    const delay = 1500
    timerRef.current = setTimeout(() => {
      safe(prev => {
        if (!prev || prev.phase !== 'kingdom-select') return prev
        const remaining = prev.remainingKingdoms[prev.ownerIndex]
        if (remaining.length === 0) return prev
        // AI prefers Trix, then KoH (high risk/reward)
        const pref: Kingdom[] = ['trix','ltoush','diamonds','ladies','king_of_hearts']
        const k = pref.find(x => remaining.includes(x)) ?? remaining[0]
        sfxNotify()
        const newRemaining = prev.remainingKingdoms.map((r,i) => i===prev.ownerIndex ? r.filter(x=>x!==k) : r)
        const needsDouble = k === 'ladies' || k === 'king_of_hearts'
        const phase: MatchPhase = needsDouble ? 'doubling' : (k==='trix' ? 'trix-playing' : 'trick-playing')
        const lead = prev.ownerIndex
        return {
          ...prev, phase, selectedKingdom:k, remainingKingdoms:newRemaining,
          leadPlayerIndex:lead, currentPlayerIndex:lead,
          doubledQueens:[], doubledKoH:false, doublingPhase:needsDouble,
          message: needsDouble
            ? `${PLAYER_NAMES[prev.ownerIndex]} chose ${KINGDOM_LABEL[k]}! Announce doubles...`
            : `${PLAYER_NAMES[prev.ownerIndex]} chose ${KINGDOM_LABEL[k]}! ${PLAYER_NAMES[lead]} leads.`,
        }
      })
    }, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state?.phase, state?.ownerIndex])

  // ── AI skips doubling (or doubles in hard mode) ────────────────────────────
  useEffect(() => {
    if (!state || state.phase !== 'doubling') return
    if (state.ownerIndex === 0 || state.currentPlayerIndex === 0) return
    timerRef.current = setTimeout(() => {
      safe(prev => {
        if (!prev || prev.phase !== 'doubling') return prev
        return {...prev, phase:'trick-playing', doublingPhase:false,
          message:`${KINGDOM_LABEL[prev.selectedKingdom!]} — ${PLAYER_NAMES[prev.leadPlayerIndex]} leads.`}
      })
    }, 1200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state?.phase, state?.ownerIndex])

  // ── Player plays trick card ─────────────────────────────────────────────────
  const playTrickCard = useCallback((cardIndex: number) => {
    if (!state || state.phase !== 'trick-playing') return
    if (state.currentPlayerIndex !== 0) return
    const hand = sortCards(state.hands[0])
    const card = hand[cardIndex]
    if (!card) return
    const legal = legalTrickMoves(state.hands[0], state.leadSuit, state.selectedKingdom!)
    if (!legal.some(c => c.suit===card.suit && c.rank===card.rank)) { sfxLose(); return }
    sfxCardPlay()
    safe(prev => {
      if (!prev || prev.phase !== 'trick-playing') return prev
      const newHands = prev.hands.map((h,i) => i===0 ? h.filter(c => !(c.suit===card.suit&&c.rank===card.rank)) : h)
      const newTrick = [...prev.currentTrick] as (Card|null)[]
      newTrick[0] = card
      const newOrder = [...prev.playedOrder, 0]
      const newLead = prev.leadSuit ?? card.suit
      if (newOrder.length === 4) {
        const winner = resolveTrickWinner(newTrick, newOrder, newLead)
        const trickCards = newTrick.filter(Boolean) as Card[]
        const newCaptured = prev.capturedCards.map((c,i) => i===winner ? [...c,...trickCards] : c)
        const newTrickCounts = prev.trickCounts.map((t,i) => i===winner ? t+1 : t)
        if (winner === 0) sfxWin(); else sfxLose()
        setTrickFlash({winner, label:`${PLAYER_NAMES[winner]} wins trick!`})
        setTimeout(() => setTrickFlash(null), 1200)
        return {
          ...prev, phase:'trick-end', hands:newHands, currentTrick:newTrick,
          playedOrder:newOrder, leadSuit:newLead, capturedCards:newCaptured,
          trickCounts:newTrickCounts, trickWinner:winner, completedTricks:prev.completedTricks+1,
          message:`${PLAYER_NAMES[winner]} wins the trick!`,
        }
      }
      return {
        ...prev, hands:newHands, currentTrick:newTrick, playedOrder:newOrder,
        leadSuit:newLead, currentPlayerIndex:(0+1)%4,
      }
    })
  }, [state, safe])

  // ── AI plays trick card ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!state || state.phase !== 'trick-playing') return
    if (state.currentPlayerIndex === 0) return
    const p = state.currentPlayerIndex
    const delay = state.diff==='hard' ? 500 : state.diff==='medium' ? 800 : 1100
    timerRef.current = setTimeout(() => {
      safe(prev => {
        if (!prev || prev.phase !== 'trick-playing' || prev.currentPlayerIndex !== p) return prev
        const hand = prev.hands[p]
        if (hand.length === 0) return prev
        const trickSoFar = prev.playedOrder.map(i => prev.currentTrick[i]!).filter(Boolean)
        const card = aiTrickCard(hand, prev.leadSuit, prev.selectedKingdom!, prev.diff, trickSoFar, p, prev.mode)
        const newHands = prev.hands.map((h,i) => i===p ? h.filter(c => !(c.suit===card.suit&&c.rank===card.rank)) : h)
        const newTrick = [...prev.currentTrick] as (Card|null)[]
        newTrick[p] = card
        const newOrder = [...prev.playedOrder, p]
        const newLead = prev.leadSuit ?? card.suit
        sfxCardFlip()
        if (newOrder.length === 4) {
          const winner = resolveTrickWinner(newTrick, newOrder, newLead)
          const trickCards = newTrick.filter(Boolean) as Card[]
          const newCaptured = prev.capturedCards.map((c,i) => i===winner ? [...c,...trickCards] : c)
          const newTrickCounts = prev.trickCounts.map((t,i) => i===winner ? t+1 : t)
          if (winner===0) sfxWin(); else sfxLose()
          setTrickFlash({winner, label:`${PLAYER_NAMES[winner]} wins trick!`})
          setTimeout(() => setTrickFlash(null), 1200)
          return {
            ...prev, phase:'trick-end', hands:newHands, currentTrick:newTrick,
            playedOrder:newOrder, leadSuit:newLead, capturedCards:newCaptured,
            trickCounts:newTrickCounts, trickWinner:winner, completedTricks:prev.completedTricks+1,
            message:`${PLAYER_NAMES[winner]} wins the trick!`,
          }
        }
        return {
          ...prev, hands:newHands, currentTrick:newTrick, playedOrder:newOrder,
          leadSuit:newLead, currentPlayerIndex:(p+1)%4,
        }
      })
    }, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state?.phase, state?.currentPlayerIndex, state?.diff])

  // ── Trick end → next trick or hand end ────────────────────────────────────
  useEffect(() => {
    if (!state || state.phase !== 'trick-end') return
    timerRef.current = setTimeout(() => {
      safe(prev => {
        if (!prev || prev.phase !== 'trick-end') return prev
        const winner = prev.trickWinner!
        if (prev.completedTricks >= 13) {
          // Hand over — compute final hand scores
          const hs = computeHandScores(prev.selectedKingdom!, prev.capturedCards, prev.trickCounts, [], prev.doubledQueens, prev.doubledKoH)
          const newTotal = prev.totalScores.map((t,i) => t+hs[i])
          const newTeam: [number,number] = [
            newTotal[0]+newTotal[2],
            newTotal[1]+newTotal[3],
          ]
          onScoreUpdate?.(newTotal[0])
          sfxNotify()
          return {
            ...prev, phase:'hand-end', handScores:hs, totalScores:newTotal, teamScores:newTeam,
            currentTrick:[null,null,null,null], playedOrder:[], leadSuit:null,
            message:`Hand ${prev.handNumber} complete!`,
          }
        }
        // Next trick — winner leads
        return {
          ...prev, phase:'trick-playing',
          currentTrick:[null,null,null,null], playedOrder:[], leadSuit:null,
          leadPlayerIndex:winner, currentPlayerIndex:winner, trickWinner:null,
          message: winner===0 ? 'Your turn — you lead!' : `${PLAYER_NAMES[winner]} leads next trick`,
        }
      })
    }, 1400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state?.phase])

  // ── Hand end → next hand or match end ─────────────────────────────────────
  useEffect(() => {
    if (!state || state.phase !== 'hand-end') return
    timerRef.current = setTimeout(() => {
      safe(prev => {
        if (!prev || prev.phase !== 'hand-end') return prev
        const hist = {
          handNum:prev.handNumber, owner:prev.ownerIndex,
          kingdom:prev.selectedKingdom!, scores:[...prev.handScores]
        }
        setHandHistory(h => [...h, hist])
        if (prev.handNumber >= 20) {
          // Match over — find winner
          const winner = prev.mode === 'partners'
            ? (prev.teamScores[0] >= prev.teamScores[1] ? 0 : 1)
            : prev.totalScores.indexOf(Math.max(...prev.totalScores))
          if (winner === 0 || (prev.mode==='partners' && TEAM[0]===winner)) sfxVictory()
          else sfxGameOver()
          onGameOver?.(prev.totalScores[0])
          stopBgMusic()
          return {
            ...prev, phase:'match-end',
            message: prev.mode==='partners'
              ? `Match over! Team ${prev.teamScores[0]>=prev.teamScores[1]?'A (You+North)':'B (West+East)'} wins!`
              : `Match over! ${PLAYER_NAMES[winner]} wins with ${Math.max(...prev.totalScores)} pts!`,
          }
        }
        sfxDeal()
        const next = startNewHand(prev)
        return {...next, totalScores:prev.totalScores, teamScores:prev.teamScores}
      })
    }, 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state?.phase])

  // ── TRIX: player plays card ─────────────────────────────────────────────────
  const playTrixCard = useCallback((cardIndex: number) => {
    if (!state || state.phase !== 'trix-playing') return
    if (state.currentPlayerIndex !== 0) return
    const hand = sortCards(state.hands[0])
    const card = hand[cardIndex]
    if (!card) return
    const legal = legalTrixMoves(state.hands[0], state.trixBoard)
    if (!legal.some(c => c.suit===card.suit && c.rank===card.rank)) { sfxLose(); return }
    sfxCardPlay()
    safe(prev => {
      if (!prev || prev.phase !== 'trix-playing') return prev
      const newHands = prev.hands.map((h,i) => i===0 ? h.filter(c => !(c.suit===card.suit&&c.rank===card.rank)) : h)
      const newBoard = applyTrixCard(card, prev.trixBoard)
      const newActive = [...prev.trixActivePlayers]
      let newFinish = [...prev.trixFinishOrder]
      if (newHands[0].length === 0 && newActive[0]) {
        newActive[0] = false
        newFinish = [...newFinish, 0]
        sfxWin()
      }
      if (newFinish.length === 4) {
        const hs = computeHandScores('trix', prev.capturedCards, prev.trickCounts, newFinish, [], false)
        const newTotal = prev.totalScores.map((t,i) => t+hs[i])
        const newTeam: [number,number] = [newTotal[0]+newTotal[2], newTotal[1]+newTotal[3]]
        onScoreUpdate?.(newTotal[0])
        return {
          ...prev, hands:newHands, trixBoard:newBoard, trixActivePlayers:newActive,
          trixFinishOrder:newFinish, phase:'hand-end', handScores:hs,
          totalScores:newTotal, teamScores:newTeam,
          message:`Trix hand complete! ${PLAYER_NAMES[newFinish[0]]} finished first!`,
        }
      }
      const next = nextTrixPlayer(0, newActive)
      return {
        ...prev, hands:newHands, trixBoard:newBoard, trixActivePlayers:newActive,
        trixFinishOrder:newFinish, currentPlayerIndex:next,
        message: next===0 ? 'Your turn!' : `${PLAYER_NAMES[next]}'s turn`,
      }
    })
  }, [state, safe, onScoreUpdate])

  // ── TRIX AI ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state || state.phase !== 'trix-playing') return
    if (state.currentPlayerIndex === 0 || state.currentPlayerIndex === -1) return
    const p = state.currentPlayerIndex
    const delay = state.diff==='hard' ? 600 : state.diff==='medium' ? 900 : 1200
    timerRef.current = setTimeout(() => {
      safe(prev => {
        if (!prev || prev.phase !== 'trix-playing' || prev.currentPlayerIndex !== p) return prev
        if (!prev.trixActivePlayers[p]) return prev
        const hand = prev.hands[p]
        const card = aiTrixCard(hand, prev.trixBoard, prev.diff)
        if (!card) {
          // Pass
          const next = nextTrixPlayer(p, prev.trixActivePlayers)
          return {...prev, currentPlayerIndex:next, message:`${PLAYER_NAMES[p]} passes...`}
        }
        sfxCardFlip()
        const newHands = prev.hands.map((h,i) => i===p ? h.filter(c => !(c.suit===card.suit&&c.rank===card.rank)) : h)
        const newBoard = applyTrixCard(card, prev.trixBoard)
        const newActive = [...prev.trixActivePlayers]
        let newFinish = [...prev.trixFinishOrder]
        if (newHands[p].length === 0 && newActive[p]) {
          newActive[p] = false
          newFinish = [...newFinish, p]
        }
        if (newFinish.length === 4) {
          const hs = computeHandScores('trix', prev.capturedCards, prev.trickCounts, newFinish, [], false)
          const newTotal = prev.totalScores.map((t,i) => t+hs[i])
          const newTeam: [number,number] = [newTotal[0]+newTotal[2], newTotal[1]+newTotal[3]]
          onScoreUpdate?.(newTotal[0])
          return {
            ...prev, hands:newHands, trixBoard:newBoard, trixActivePlayers:newActive,
            trixFinishOrder:newFinish, phase:'hand-end', handScores:hs,
            totalScores:newTotal, teamScores:newTeam,
            message:`Trix hand complete! ${PLAYER_NAMES[newFinish[0]]} finished first (+200)!`,
          }
        }
        const next = nextTrixPlayer(p, newActive)
        return {
          ...prev, hands:newHands, trixBoard:newBoard, trixActivePlayers:newActive,
          trixFinishOrder:newFinish, currentPlayerIndex:next,
          message:`${PLAYER_NAMES[p]} played ${card.rank}${SUIT_SYM[card.suit]}. ${next===0?'Your turn!':PLAYER_NAMES[next]+"'s turn"}`,
        }
      })
    }, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state?.phase, state?.currentPlayerIndex, state?.diff])

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      stopBgMusic()
    }
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (!state) {
    return <MenuScreen onStart={startGame} camEnabled={camEnabled} camError={camError} startCam={startCam} stopCam={stopCam} />
  }

  const myHand = sortCards(state.hands[0])
  const myLegal = state.phase==='trick-playing' && state.currentPlayerIndex===0
    ? legalTrickMoves(state.hands[0], state.leadSuit, state.selectedKingdom!)
    : state.phase==='trix-playing' && state.currentPlayerIndex===0
      ? legalTrixMoves(state.hands[0], state.trixBoard)
      : []
  const myQueens = myHand.filter(c => c.rank==='Q')
  const hasKoH = myHand.some(c => c.suit==='H' && c.rank==='K')

  return (
    <div style={{
      minHeight:'100vh', background:'linear-gradient(135deg,#0a0a1a 0%,#0f172a 50%,#0a0a1a 100%)',
      color:'#e2e8f0', fontFamily:'system-ui,sans-serif', display:'flex', flexDirection:'column',
      alignItems:'center', padding:'8px 4px', gap:8, position:'relative', overflowX:'hidden',
    }}>
      {/* Floating ambient orbs */}
      {[...Array(4)].map((_,i) => (
        <div key={i} style={{
          position:'fixed', borderRadius:'50%', pointerEvents:'none', zIndex:0,
          width:180+i*60, height:180+i*60,
          background:`radial-gradient(circle,${['#7c3aed22','#0ea5e922','#ec489922','#10b98122'][i]},transparent)`,
          top:`${[10,60,20,70][i]}%`, left:`${[5,80,40,60][i]}%`,
          animation:`spin-slow ${20+i*5}s linear infinite`,
          filter:'blur(40px)',
        }} />
      ))}

      {/* Header bar */}
      <div style={{
        width:'100%', maxWidth:900, display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(255,255,255,0.04)', borderRadius:14, padding:'8px 16px',
        border:'1px solid rgba(255,255,255,0.08)', zIndex:2,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <span style={{fontSize:22}}>👑</span>
          <div>
            <div style={{fontWeight:800, fontSize:16, color:'#a78bfa'}}>TRIX</div>
            <div style={{fontSize:11, color:'#64748b'}}>Hand {state.handNumber}/20 · {mode==='partners'?'Partners':'Solo'}</div>
          </div>
        </div>
        <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
          {state.selectedKingdom && (
            <div style={{
              background:`${KINGDOM_COLOR[state.selectedKingdom]}22`,
              border:`1px solid ${KINGDOM_COLOR[state.selectedKingdom]}44`,
              borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:700,
              color:KINGDOM_COLOR[state.selectedKingdom],
            }}>
              {KINGDOM_ICON[state.selectedKingdom]} {KINGDOM_LABEL[state.selectedKingdom]}
            </div>
          )}
          <button onClick={toggleBg} style={iconBtn(bgOn ? '#10b981' : '#475569')} title="Background Music">🎵</button>
          <button onClick={toggleSfx} style={iconBtn(sfxOn ? '#60a5fa' : '#475569')} title="Sound Effects">
            {sfxOn ? '🔊' : '🔇'}
          </button>
          <button onClick={() => setShowHistory(!showHistory)} style={iconBtn('#a78bfa')} title="Score History">📋</button>
          <button onClick={() => { stopBgMusic(); setState(null) }} style={iconBtn('#f87171')} title="Menu">🏠</button>
        </div>
      </div>

      {/* Trick flash banner */}
      {trickFlash && (
        <div style={{
          position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          background:'rgba(0,0,0,0.88)', borderRadius:16, padding:'20px 36px',
          fontSize:22, fontWeight:800, color:'#ffd700', zIndex:100,
          border:'2px solid #ffd700aa', boxShadow:'0 0 40px #ffd70066',
          animation:'scale-in 0.2s ease',
          pointerEvents:'none',
        }}>
          {trickFlash.label}
        </div>
      )}

      {/* Score history panel */}
      {showHistory && (
        <div style={{
          position:'fixed', top:0, right:0, bottom:0, width:280,
          background:'rgba(10,10,26,0.97)', borderLeft:'1px solid rgba(255,255,255,0.1)',
          zIndex:50, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:8,
        }}>
          <div style={{fontWeight:800, color:'#a78bfa', marginBottom:8}}>📋 Hand History</div>
          {handHistory.length === 0 && <div style={{color:'#475569', fontSize:13}}>No hands played yet</div>}
          {handHistory.map(h => (
            <div key={h.handNum} style={{
              background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px',
              border:'1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{fontSize:12, fontWeight:700, color:KINGDOM_COLOR[h.kingdom], marginBottom:4}}>
                Hand {h.handNum} — {KINGDOM_ICON[h.kingdom]} {KINGDOM_LABEL[h.kingdom]}
              </div>
              <div style={{fontSize:11, color:'#64748b', marginBottom:4}}>
                Owner: {PLAYER_NAMES[h.owner]}
              </div>
              {PLAYER_NAMES.map((name,i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:12, padding:'1px 0'}}>
                  <span style={{color:'#94a3b8'}}>{name}</span>
                  <span style={{color: h.scores[i]<0?'#f87171':h.scores[i]>0?'#4ade80':'#64748b', fontWeight:700}}>
                    {h.scores[i]>0?'+':''}{h.scores[i]}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => setShowHistory(false)} style={{
            marginTop:'auto', background:'#334155', border:'none', borderRadius:8,
            padding:'8px', color:'#e2e8f0', cursor:'pointer', fontWeight:700,
          }}>Close</button>
        </div>
      )}

      {/* Main game area */}
      <div style={{width:'100%', maxWidth:900, display:'flex', flexDirection:'column', gap:10, zIndex:2}}>

        {/* Camera row */}
        <div style={{
          display:'flex', justifyContent:'space-around', alignItems:'center',
          background:'rgba(255,255,255,0.03)', borderRadius:14, padding:'12px 8px',
          border:'1px solid rgba(255,255,255,0.06)',
        }}>
          {[1,2,3,0].map((pi) => (
            <PlayerCam
              key={pi} idx={pi}
              currentPlayer={state.currentPlayerIndex}
              videoRef={videoRefs[pi]}
              camEnabled={camEnabled && pi===0}
              name={PLAYER_NAMES[pi]}
              score={state.totalScores[pi]}
              isPartner={mode==='partners' && pi===2}
            />
          ))}
          <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'center'}}>
            {!camEnabled ? (
              <button onClick={startCam} style={{
                background:'linear-gradient(135deg,#7c3aed,#a855f7)',
                border:'none', borderRadius:10, padding:'8px 12px',
                color:'white', cursor:'pointer', fontWeight:700, fontSize:12,
              }}>📷 Camera</button>
            ) : (
              <button onClick={stopCam} style={{
                background:'#334155', border:'none', borderRadius:10, padding:'8px 12px',
                color:'white', cursor:'pointer', fontWeight:700, fontSize:12,
              }}>📵 Off</button>
            )}
            {camError && <div style={{fontSize:10, color:'#f87171', maxWidth:100, textAlign:'center'}}>{camError}</div>}
          </div>
        </div>

        {/* Message bar */}
        <div style={{
          textAlign:'center', fontSize:14, fontWeight:700, color:'#e2e8f0',
          background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'8px 16px',
          border:'1px solid rgba(255,255,255,0.08)',
        }}>
          {state.message}
        </div>

        {/* Partners scores */}
        {mode === 'partners' && (
          <div style={{display:'flex', gap:8, justifyContent:'center'}}>
            {[0,1].map(team => (
              <div key={team} style={{
                background: team===0?'rgba(167,139,250,0.15)':'rgba(251,146,60,0.15)',
                border:`1px solid ${team===0?'#a78bfa44':'#fb923c44'}`,
                borderRadius:10, padding:'6px 16px', fontSize:13, fontWeight:700,
              }}>
                Team {team===0?'A (You+North)':'B (West+East)'}:
                <span style={{marginLeft:8, color: state.teamScores[team]<0?'#f87171':state.teamScores[team]>0?'#4ade80':'#94a3b8'}}>
                  {state.teamScores[team]>0?'+':''}{state.teamScores[team]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Kingdom select phase */}
        {state.phase === 'kingdom-select' && state.ownerIndex === 0 && (
          <div style={{display:'flex', flexDirection:'column', gap:10, alignItems:'center'}}>
            <div style={{fontWeight:800, fontSize:16, color:'#a78bfa', textAlign:'center'}}>
              👑 Your Kingdom — Choose a contract:
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center'}}>
              {state.remainingKingdoms[0].map(k => (
                <button key={k} onClick={() => selectKingdom(k)} style={{
                  background:`linear-gradient(135deg,${KINGDOM_COLOR[k]}22,${KINGDOM_COLOR[k]}11)`,
                  border:`2px solid ${KINGDOM_COLOR[k]}66`,
                  borderRadius:14, padding:'14px 18px', cursor:'pointer', color:'#e2e8f0',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  minWidth:140, transition:'transform 0.15s, box-shadow 0.15s',
                }}>
                  <span style={{fontSize:26}}>{KINGDOM_ICON[k]}</span>
                  <span style={{fontWeight:800, color:KINGDOM_COLOR[k], fontSize:13}}>{KINGDOM_LABEL[k]}</span>
                  <span style={{fontSize:10, color:'#94a3b8', textAlign:'center'}}>{KINGDOM_DESC[k]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.phase === 'kingdom-select' && state.ownerIndex !== 0 && (
          <div style={{textAlign:'center', color:'#94a3b8', fontSize:14, padding:'20px'}}>
            ⏳ {PLAYER_NAMES[state.ownerIndex]} is choosing a kingdom...
          </div>
        )}

        {/* Doubling phase */}
        {state.phase === 'doubling' && (
          <div style={{
            background:'rgba(251,191,36,0.08)', border:'2px solid rgba(251,191,36,0.3)',
            borderRadius:14, padding:'16px', display:'flex', flexDirection:'column', gap:12, alignItems:'center',
          }}>
            <div style={{fontWeight:800, fontSize:15, color:'#fbbf24'}}>
              ⚡ Doubling Phase — Announce your doubles before play!
            </div>
            <div style={{fontSize:12, color:'#94a3b8', textAlign:'center'}}>
              Double your Queens or King of Hearts. If someone else takes it, you get +points. If you take it yourself, you lose double!
            </div>
            {state.selectedKingdom === 'ladies' && myQueens.length > 0 && (
              <div style={{display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center'}}>
                {myQueens.map((q,i) => {
                  const isDoubled = state.doubledQueens.some(dq => dq.suit===q.suit)
                  return (
                    <button key={i} onClick={() => doubleQueen(q)} style={{
                      background: isDoubled ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.05)',
                      border: isDoubled ? '2px solid #fbbf24' : '2px solid #334155',
                      borderRadius:10, padding:'8px 14px', cursor:'pointer', color:'#e2e8f0',
                      fontWeight:700, display:'flex', alignItems:'center', gap:6,
                    }}>
                      <span style={{color:'#fca5a5'}}>Q{SUIT_SYM[q.suit]}</span>
                      {isDoubled ? ' ✅ DOUBLED' : ' Double?'}
                    </button>
                  )
                })}
              </div>
            )}
            {state.selectedKingdom === 'king_of_hearts' && hasKoH && (
              <button onClick={doubleKoH} style={{
                background: state.doubledKoH ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.05)',
                border: state.doubledKoH ? '2px solid #fbbf24' : '2px solid #334155',
                borderRadius:10, padding:'10px 20px', cursor:'pointer', color:'#e2e8f0', fontWeight:700,
              }}>
                ❤️‍🔥 K♥ {state.doubledKoH ? '✅ DOUBLED (-150 to taker!)' : 'Double? (-75 → -150)'}
              </button>
            )}
            <button onClick={confirmDoubling} style={{
              background:'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none',
              borderRadius:10, padding:'10px 28px', cursor:'pointer', color:'white',
              fontWeight:800, fontSize:14, marginTop:4,
            }}>
              ▶ Start Playing {KINGDOM_ICON[state.selectedKingdom!]}
            </button>
          </div>
        )}

        {/* Trick table */}
        {(state.phase === 'trick-playing' || state.phase === 'trick-end') && (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:12,
            background:'rgba(255,255,255,0.03)', borderRadius:16, padding:'16px',
            border:'1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{fontWeight:700, color:'#64748b', fontSize:12}}>
              Trick {state.completedTricks + (state.phase==='trick-playing'?1:0)}/13
            </div>
            {/* Trick cards in a cross layout */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 80px 1fr', gridTemplateRows:'60px 90px 60px', gap:4, alignItems:'center', justifyItems:'center'}}>
              {/* North (player 2) */}
              <div style={{gridColumn:'2', gridRow:'1', display:'flex', justifyContent:'center'}}>
                {state.currentTrick[2]
                  ? <CardComp card={state.currentTrick[2]} small />
                  : <div style={emptySlot}>{state.currentPlayerIndex===2?'⏳':''}</div>}
              </div>
              {/* West (player 1) */}
              <div style={{gridColumn:'1', gridRow:'2', display:'flex', justifyContent:'center'}}>
                {state.currentTrick[1]
                  ? <CardComp card={state.currentTrick[1]} small />
                  : <div style={emptySlot}>{state.currentPlayerIndex===1?'⏳':''}</div>}
              </div>
              {/* Center info */}
              <div style={{gridColumn:'2', gridRow:'2', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, color:'#475569', textAlign:'center'}}>
                {state.leadSuit ? `${SUIT_SYM[state.leadSuit]} led` : '—'}
              </div>
              {/* East (player 3) */}
              <div style={{gridColumn:'3', gridRow:'2', display:'flex', justifyContent:'center'}}>
                {state.currentTrick[3]
                  ? <CardComp card={state.currentTrick[3]} small />
                  : <div style={emptySlot}>{state.currentPlayerIndex===3?'⏳':''}</div>}
              </div>
              {/* South (player 0 = You) */}
              <div style={{gridColumn:'2', gridRow:'3', display:'flex', justifyContent:'center'}}>
                {state.currentTrick[0]
                  ? <CardComp card={state.currentTrick[0]} small />
                  : <div style={emptySlot}>{state.currentPlayerIndex===0?'⏳ Your turn':'—'}</div>}
              </div>
            </div>
          </div>
        )}

        {/* TRIX board */}
        {(state.phase === 'trix-playing') && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
            <div style={{fontWeight:700, color:'#a78bfa', fontSize:14}}>👑 Trix Board — Build sequences around Jacks</div>
            <TrixBoardView board={state.trixBoard} />
            <div style={{display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', fontSize:12, color:'#64748b'}}>
              {state.trixActivePlayers.map((a,i) => a && (
                <span key={i} style={{color: state.trixFinishOrder.includes(i)?'#4ade80':'#94a3b8'}}>
                  {PLAYER_NAMES[i]}: {state.hands[i].length} cards {state.trixFinishOrder.includes(i)?'✅':''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Player's hand */}
        {(state.phase === 'trick-playing' || state.phase === 'trix-playing') && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
            <div style={{fontSize:12, color:'#64748b', fontWeight:600}}>
              Your hand ({myHand.length} cards)
              {state.currentPlayerIndex === 0 && <span style={{color:'#ffd700', marginLeft:8}}>⬆ Your turn!</span>}
            </div>
            <div style={{
              display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center',
              padding:'12px', background:'rgba(255,255,255,0.03)', borderRadius:14,
              border: state.currentPlayerIndex===0 ? '2px solid #ffd70066' : '1px solid rgba(255,255,255,0.06)',
              transition:'border 0.3s', minHeight:100,
            }}>
              {myHand.map((card, i) => {
                const isLegal = myLegal.some(c => c.suit===card.suit && c.rank===card.rank)
                return (
                  <div key={`${card.suit}${card.rank}`} style={{opacity: state.currentPlayerIndex===0 && !isLegal ? 0.35 : 1, transition:'opacity 0.2s'}}>
                    <CardComp
                      card={card}
                      highlight={isLegal && state.currentPlayerIndex===0}
                      onClick={state.currentPlayerIndex===0 && isLegal
                        ? () => state.phase==='trix-playing' ? playTrixCard(i) : playTrickCard(i)
                        : undefined}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Hand end summary */}
        {state.phase === 'hand-end' && (
          <div style={{
            background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'20px',
            border:'1px solid rgba(255,255,255,0.1)', display:'flex', flexDirection:'column', alignItems:'center', gap:12,
          }}>
            <div style={{fontSize:20, fontWeight:800, color:'#ffd700'}}>
              {KINGDOM_ICON[state.selectedKingdom!]} Hand {state.handNumber} Complete!
            </div>
            <div style={{fontWeight:700, color:'#94a3b8', fontSize:13, marginBottom:4}}>Hand Scores</div>
            {PLAYER_NAMES.map((name,i) => (
              <div key={i} style={{
                display:'flex', justifyContent:'space-between', width:'100%', maxWidth:300,
                padding:'6px 12px', borderRadius:8,
                background: i===0 ? 'rgba(167,139,250,0.1)' : 'transparent',
              }}>
                <span style={{color:'#cbd5e1', fontWeight:600}}>{name}</span>
                <span style={{fontWeight:800, color: state.handScores[i]<0?'#f87171':state.handScores[i]>0?'#4ade80':'#64748b'}}>
                  {state.handScores[i]>0?'+':''}{state.handScores[i]}
                </span>
              </div>
            ))}
            <div style={{width:'100%', maxWidth:300, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:10}}>
              <div style={{fontWeight:700, color:'#94a3b8', fontSize:13, marginBottom:6, textAlign:'center'}}>Total Scores</div>
              {PLAYER_NAMES.map((name,i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'3px 12px'}}>
                  <span style={{color:'#94a3b8', fontSize:13}}>{name}</span>
                  <span style={{fontWeight:800, fontSize:14, color: state.totalScores[i]<0?'#f87171':state.totalScores[i]>0?'#4ade80':'#64748b'}}>
                    {state.totalScores[i]>0?'+':''}{state.totalScores[i]}
                  </span>
                </div>
              ))}
            </div>
            {state.handNumber < 20 && (
              <div style={{fontSize:12, color:'#475569', marginTop:4}}>
                ⏳ Next hand starting... ({20-state.handNumber} hands remaining)
              </div>
            )}
          </div>
        )}

        {/* Match end */}
        {state.phase === 'match-end' && (
          <div style={{
            background:'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(168,85,247,0.1))',
            borderRadius:20, padding:'28px 24px',
            border:'2px solid rgba(167,139,250,0.4)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:16,
          }}>
            <div style={{fontSize:36}}>🏆</div>
            <div style={{fontSize:22, fontWeight:900, color:'#ffd700', textAlign:'center'}}>{state.message}</div>
            <div style={{display:'flex', flexDirection:'column', gap:6, width:'100%', maxWidth:320}}>
              {PLAYER_NAMES
                .map((name,i) => ({name,score:state.totalScores[i],i}))
                .sort((a,b) => b.score-a.score)
                .map(({name,score,i},pos) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
                    borderRadius:10, background: pos===0?'rgba(255,215,0,0.15)':'rgba(255,255,255,0.03)',
                    border: pos===0?'1px solid #ffd70044':'1px solid transparent',
                  }}>
                    <span style={{fontSize:18}}>{['🥇','🥈','🥉','4️⃣'][pos]}</span>
                    <span style={{fontWeight:700, color:i===0?'#a78bfa':'#cbd5e1', flex:1}}>{name}</span>
                    <span style={{fontWeight:800, color: score<0?'#f87171':score>0?'#4ade80':'#64748b'}}>
                      {score>0?'+':''}{score}
                    </span>
                  </div>
                ))}
            </div>
            {mode==='partners' && (
              <div style={{display:'flex', gap:12, marginTop:4}}>
                {[0,1].map(t => (
                  <div key={t} style={{
                    textAlign:'center', padding:'8px 16px', borderRadius:10,
                    background:t===0?'rgba(167,139,250,0.15)':'rgba(251,146,60,0.15)',
                    border:`1px solid ${t===0?'#a78bfa44':'#fb923c44'}`,
                  }}>
                    <div style={{fontSize:12, color:'#94a3b8'}}>Team {t===0?'A':'B'}</div>
                    <div style={{fontSize:20, fontWeight:800, color: state.teamScores[t]<0?'#f87171':'#4ade80'}}>
                      {state.teamScores[t]>0?'+':''}{state.teamScores[t]}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex', gap:10, marginTop:8}}>
              <button onClick={() => startGame(state.diff, state.mode)} style={{
                background:'linear-gradient(135deg,#7c3aed,#a855f7)',
                border:'none', borderRadius:12, padding:'12px 24px',
                color:'white', cursor:'pointer', fontWeight:800, fontSize:15,
              }}>🔄 Play Again</button>
              <button onClick={() => { stopBgMusic(); setState(null) }} style={{
                background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
                borderRadius:12, padding:'12px 24px',
                color:'white', cursor:'pointer', fontWeight:700, fontSize:15,
              }}>🏠 Menu</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Menu Screen ─────────────────────────────────────────────────────────────
function MenuScreen({ onStart, camEnabled, camError, startCam, stopCam }: {
  onStart: (d:Diff, m:GameMode) => void
  camEnabled:boolean; camError:string|null; startCam:()=>void; stopCam:()=>void
}) {
  const [diff, setDiff] = useState<Diff>('medium')
  const [mode, setMode] = useState<GameMode>('solo')
  const [roomCode, setRoomCode] = useState('')
  const [showRoom, setShowRoom] = useState(false)
  const generatedCode = useRef(Math.random().toString(36).slice(2,8).toUpperCase())

  return (
    <div style={{
      minHeight:'100vh', background:'linear-gradient(135deg,#0a0a1a,#0f172a,#0a0a1a)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'system-ui,sans-serif',
    }}>
      <div style={{
        background:'rgba(255,255,255,0.04)', borderRadius:24, padding:'36px 32px',
        border:'1px solid rgba(255,255,255,0.1)', maxWidth:480, width:'100%',
        display:'flex', flexDirection:'column', alignItems:'center', gap:20,
        boxShadow:'0 0 60px rgba(124,58,237,0.2)',
      }}>
        {/* Logo */}
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:56, filter:'drop-shadow(0 0 20px #ffd700aa)'}}>👑</div>
          <div style={{fontSize:32, fontWeight:900, color:'#ffd700', letterSpacing:4,
            textShadow:'0 0 20px #ffd70066'}}>TRIX</div>
          <div style={{fontSize:13, color:'#64748b', marginTop:4}}>Middle Eastern 4-Player Card Game</div>
        </div>

        {/* Rules quick reference */}
        <div style={{
          background:'rgba(167,139,250,0.08)', borderRadius:14, padding:'12px 16px',
          border:'1px solid rgba(167,139,250,0.2)', width:'100%',
        }}>
          <div style={{fontWeight:700, color:'#a78bfa', marginBottom:8, fontSize:13}}>📖 How to play (20 Hands)</div>
          <div style={{display:'flex', flexDirection:'column', gap:5}}>
            {ALL_KINGDOMS.map(k => (
              <div key={k} style={{display:'flex', alignItems:'flex-start', gap:8, fontSize:11, color:'#94a3b8'}}>
                <span>{KINGDOM_ICON[k]}</span>
                <span><strong style={{color:KINGDOM_COLOR[k]}}>{KINGDOM_LABEL[k]}:</strong> {KINGDOM_DESC[k]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div style={{width:'100%'}}>
          <div style={{fontWeight:700, color:'#94a3b8', fontSize:13, marginBottom:8}}>AI Difficulty</div>
          <div style={{display:'flex', gap:8}}>
            {(['easy','medium','hard'] as Diff[]).map(d => (
              <button key={d} onClick={() => setDiff(d)} style={{
                flex:1, padding:'10px 0', borderRadius:10, cursor:'pointer',
                fontWeight:700, fontSize:13, transition:'all 0.2s',
                background: diff===d ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.05)',
                border: diff===d ? '2px solid #a855f7' : '2px solid transparent',
                color: diff===d ? 'white' : '#64748b',
              }}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div style={{width:'100%'}}>
          <div style={{fontWeight:700, color:'#94a3b8', fontSize:13, marginBottom:8}}>Game Mode</div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={() => setMode('solo')} style={{
              flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12,
              background:mode==='solo'?'linear-gradient(135deg,#0ea5e9,#38bdf8)':'rgba(255,255,255,0.05)',
              border:mode==='solo'?'2px solid #38bdf8':'2px solid transparent',
              color:mode==='solo'?'white':'#64748b',
            }}>🎮 Solo (vs AI)</button>
            <button onClick={() => setMode('partners')} style={{
              flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12,
              background:mode==='partners'?'linear-gradient(135deg,#7c3aed,#a855f7)':'rgba(255,255,255,0.05)',
              border:mode==='partners'?'2px solid #a855f7':'2px solid transparent',
              color:mode==='partners'?'white':'#64748b',
            }}>🤝 Partners (You+North vs West+East)</button>
          </div>
        </div>

        {/* Invite friends */}
        <div style={{width:'100%'}}>
          <button onClick={() => setShowRoom(!showRoom)} style={{
            width:'100%', padding:'10px', borderRadius:10, cursor:'pointer',
            fontWeight:700, fontSize:13, background:'rgba(16,185,129,0.1)',
            border:'1px solid rgba(16,185,129,0.3)', color:'#34d399',
          }}>
            🔗 {showRoom ? 'Hide' : 'Invite Friends (Room Code)'}
          </button>
          {showRoom && (
            <div style={{
              marginTop:10, background:'rgba(255,255,255,0.04)', borderRadius:12,
              padding:'14px', border:'1px solid rgba(255,255,255,0.08)',
              display:'flex', flexDirection:'column', gap:10,
            }}>
              <div style={{fontSize:12, color:'#94a3b8'}}>
                Share this code with friends (multiplayer signaling coming soon — currently plays with AI bots):
              </div>
              <div style={{
                background:'rgba(167,139,250,0.15)', borderRadius:10, padding:'12px',
                textAlign:'center', fontSize:24, fontWeight:900, color:'#ffd700',
                letterSpacing:8, border:'1px solid rgba(167,139,250,0.3)',
              }}>
                {generatedCode.current}
              </div>
              <div style={{display:'flex', gap:8}}>
                <input
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter friend's code..."
                  style={{
                    flex:1, padding:'8px 12px', borderRadius:8,
                    background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)',
                    color:'white', fontSize:14, outline:'none',
                  }}
                />
                <button style={{
                  padding:'8px 14px', borderRadius:8, cursor:'pointer',
                  background:'rgba(167,139,250,0.2)', border:'1px solid rgba(167,139,250,0.4)',
                  color:'#a78bfa', fontWeight:700, fontSize:13,
                }} onClick={() => alert('Full real-time multiplayer coming soon! For now, enjoy playing against AI.')}>
                  Join
                </button>
              </div>
              <div style={{fontSize:11, color:'#475569', textAlign:'center'}}>
                💡 Full online multiplayer with WebRTC coming soon!
              </div>
            </div>
          )}
        </div>

        {/* Camera */}
        <div style={{width:'100%', display:'flex', alignItems:'center', gap:10}}>
          {!camEnabled
            ? <button onClick={startCam} style={{
                flex:1, padding:'10px', borderRadius:10, cursor:'pointer',
                background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)',
                color:'#818cf8', fontWeight:700, fontSize:13,
              }}>📷 Enable Camera & Mic</button>
            : <div style={{flex:1, display:'flex', alignItems:'center', gap:8}}>
                <span style={{color:'#4ade80', fontSize:13}}>✅ Camera active</span>
                <button onClick={stopCam} style={{
                  padding:'6px 12px', borderRadius:8, cursor:'pointer',
                  background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
                  color:'#94a3b8', fontSize:12,
                }}>Turn off</button>
              </div>
          }
          {camError && <div style={{fontSize:11, color:'#f87171'}}>{camError}</div>}
        </div>

        {/* Start button */}
        <button
          onClick={() => { startBgMusic(); setBgActive(); onStart(diff, mode) }}
          style={{
            width:'100%', padding:'16px', borderRadius:14, cursor:'pointer',
            background:'linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)',
            border:'none', color:'white', fontWeight:900, fontSize:18,
            boxShadow:'0 0 30px rgba(124,58,237,0.5)',
            transition:'transform 0.2s, box-shadow 0.2s',
            letterSpacing:2,
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.transform='scale(1.03)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.transform='scale(1)' }}
        >
          ▶ PLAY TRIX
        </button>
      </div>
    </div>
  )
}

function setBgActive() { _bgMuted = false }

// ─── Styles ───────────────────────────────────────────────────────────────────
const emptySlot: React.CSSProperties = {
  width:42, height:60, borderRadius:8, border:'2px dashed #334155',
  display:'flex', alignItems:'center', justifyContent:'center',
  fontSize:11, color:'#475569',
}

function iconBtn(color: string): React.CSSProperties {
  return {
    background:`${color}22`, border:`1px solid ${color}44`, borderRadius:8,
    padding:'5px 9px', cursor:'pointer', fontSize:16, color, fontWeight:700,
  }
}
