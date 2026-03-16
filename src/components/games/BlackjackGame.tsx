"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useCallback } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type Card = { suit: Suit; rank: Rank; hidden?: boolean }
type Diff = 'easy' | 'medium' | 'hard'
type Phase = 'betting' | 'playing' | 'dealer' | 'result'

const RANKS: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const SUITS: Suit[] = ['♠','♥','♦','♣']

const DIFF_CONFIG = {
  easy:   { dealerHitSoft: 16, decks: 2, chipBonus: 1.0 },
  medium: { dealerHitSoft: 17, decks: 2, chipBonus: 1.0 },
  hard:   { dealerHitSoft: 17, decks: 1, chipBonus: 1.5 },
}

function makeDeck(decks = 2): Card[] {
  const d: Card[] = []
  for (let i = 0; i < decks; i++)
    for (const suit of SUITS) for (const rank of RANKS) d.push({ suit, rank })
  return d.sort(() => Math.random() - 0.5)
}

function cardValue(rank: Rank): number {
  if (['J','Q','K'].includes(rank)) return 10
  if (rank === 'A') return 11
  return parseInt(rank)
}

function handTotal(hand: Card[]): number {
  let total = 0, aces = 0
  for (const c of hand) {
    if (c.hidden) continue
    total += cardValue(c.rank)
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function isBust(hand: Card[]): boolean { return handTotal(hand) > 21 }
function isBlackjack(hand: Card[]): boolean { return hand.length === 2 && handTotal(hand) === 21 }

function CardUI({ card, small }: { card: Card; small?: boolean }) {
  const red = card.suit === '♥' || card.suit === '♦'
  if (card.hidden) return (
    <div
      className={`${small ? 'w-10 h-14' : 'w-14 h-20'} rounded-lg flex items-center justify-center font-bold`}
      style={{
        background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
        border: '2px solid rgba(139,92,246,0.4)',
      }}
    >
      <span className="text-2xl select-none">🂠</span>
    </div>
  )
  return (
    <div
      className={`${small ? 'w-10 h-14 text-xs' : 'w-14 h-20 text-sm'} rounded-lg flex flex-col justify-between p-1 font-bold select-none`}
      style={{
        background: 'linear-gradient(135deg,#f8fafc,#e2e8f0)',
        border: '2px solid rgba(0,0,0,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ color: red ? '#dc2626' : '#1e1b4b' }}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
      <div style={{ color: red ? '#dc2626' : '#1e1b4b', transform: 'rotate(180deg)' }}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
    </div>
  )
}

export default function BlackjackGame({ onScoreUpdate, onGameOver, onGameStart }: GameComponentProps) {
  const [diff, setDiff] = useState<Diff>('medium')
  const [phase, setPhase] = useState<Phase | 'start' | 'gameover'>('start')
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [chips, setChips] = useState(1000)
  const [bet, setBet] = useState(50)
  const [result, setResult] = useState('')
  const [totalScore, setTotalScore] = useState(0)
  const [streak, setStreak] = useState(0)

  const deal = useCallback((amount: number, currentDiff: Diff) => {
    const d = makeDeck(DIFF_CONFIG[currentDiff].decks)
    const ph: Card[] = [d[0], d[2]]
    const dh: Card[] = [d[1], { ...d[3], hidden: true }]
    setDeck(d.slice(4))
    setPlayerHand(ph)
    setDealerHand(dh)
    setBet(amount)
    sfxDeal()
    setPhase('playing')
  }, [])

  const startBetting = useCallback(() => {
    setPhase('betting')
    setResult('')
    onGameStart()
  }, [onGameStart])

  const placeBet = useCallback((amount: number) => {
    if (amount > chips) return
    deal(amount, diff)
  }, [chips, deal, diff])

  const hit = useCallback(() => {
    if (phase !== 'playing') return
    setDeck(prevDeck => {
      const newCard = prevDeck[0]
      const remaining = prevDeck.slice(1)
      sfxCardFlip()
      setPlayerHand(prevHand => {
        const newHand = [...prevHand, newCard]
        if (isBust(newHand)) {
          sfxLose()
          setPhase('result')
          setResult('BUST! Dealer wins')
          setChips(c => c - bet)
          setStreak(0)
        }
        return newHand
      })
      return remaining
    })
  }, [phase, bet])

  const runDealerLogic = useCallback((
    currentPlayerHand: Card[],
    currentDealerHand: Card[],
    currentDeck: Card[],
    currentBet: number,
    currentDiff: Diff,
    currentTotalScore: number
  ) => {
    const revealed: Card[] = currentDealerHand.map(c => ({ ...c, hidden: false }))
    let dh: Card[] = revealed
    const newDeck = [...currentDeck]
    const cfg = DIFF_CONFIG[currentDiff]
    while (handTotal(dh) < cfg.dealerHitSoft) {
      if (newDeck.length === 0) break
      dh = [...dh, newDeck.shift()!]
    }
    setDeck(newDeck)
    setDealerHand(dh)
    const pTotal = handTotal(currentPlayerHand)
    const dTotal = handTotal(dh)
    let msg = ''
    let won = false
    let push = false
    if (isBust(dh)) {
      msg = 'Dealer busts! You win!'
      won = true
    } else if (isBlackjack(currentPlayerHand) && !isBlackjack(dh)) {
      msg = 'BLACKJACK! You win 1.5x!'
      won = true
    } else if (dTotal > pTotal) {
      msg = `Dealer wins (${dTotal} vs ${pTotal})`
    } else if (pTotal > dTotal) {
      msg = `You win! (${pTotal} vs ${dTotal})`
      won = true
    } else {
      msg = `Push - it's a tie!`
      push = true
    }
    const winAmt = isBlackjack(currentPlayerHand) ? Math.floor(currentBet * 1.5) : currentBet
    if (won) {
      setChips(c => c + winAmt)
      setStreak(s => s + 1)
      const sc = currentTotalScore + winAmt
      setTotalScore(sc)
      onScoreUpdate(sc)
    } else if (!push) {
      setChips(c => c - currentBet)
      setStreak(0)
    }
    setResult(msg)
    if (msg.includes('win') || msg.includes('WIN') || msg.includes('JACK')) sfxVictory(); else sfxLose()
    setPhase('result')
  }, [onScoreUpdate])

  const stand = useCallback(() => {
    if (phase !== 'playing') return
    runDealerLogic(playerHand, dealerHand, deck, bet, diff, totalScore)
  }, [phase, playerHand, dealerHand, deck, bet, diff, totalScore, runDealerLogic])

  const doubleDown = useCallback(() => {
    if (phase !== 'playing' || playerHand.length !== 2 || chips < bet * 2) return
    const doubleBet = bet * 2
    setBet(doubleBet)
    setDeck(prevDeck => {
      const newCard = prevDeck[0]
      const remaining = prevDeck.slice(1)
      const newHand = [...playerHand, newCard]
      setPlayerHand(newHand)
      if (isBust(newHand)) {
        setPhase('result')
        setResult('BUST! Dealer wins')
        setChips(c => c - doubleBet)
        setStreak(0)
      } else {
        runDealerLogic(newHand, dealerHand, remaining, doubleBet, diff, totalScore)
      }
      return remaining
    })
  }, [phase, playerHand, dealerHand, deck, bet, chips, diff, totalScore, runDealerLogic])

  const nextHand = useCallback(() => {
    if (chips <= 0) {
      sfxGameOver()
      onGameOver(totalScore)
      setPhase('gameover')
      return
    }
    setPhase('betting')
    setResult('')
  }, [chips, totalScore, onGameOver])

  const resetGame = useCallback(() => {
    setChips(1000)
    setTotalScore(0)
    setStreak(0)
    setBet(50)
    setResult('')
    setPlayerHand([])
    setDealerHand([])
    setPhase('start')
  }, [])

  const diffColors: Record<Diff, string> = { easy: '#10b981', medium: '#8b5cf6', hard: '#ef4444' }
  const diffLabels: Record<Diff, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
  const diffDesc: Record<Diff, string> = { easy: 'Dealer soft-16 stand', medium: 'Standard rules', hard: '1 deck, dealer hits soft-17' }

  const playerTotal = handTotal(playerHand)
  const dealerVisible = handTotal(dealerHand.filter(c => !c.hidden))

  const isWin = result.includes('win') || result.includes('WIN') || result.includes('JACK')
  const isTie = result.includes('tie')
  const resultBg = isWin ? 'rgba(16,185,129,0.15)' : isTie ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)'
  const resultColor = isWin ? '#10b981' : isTie ? '#fbbf24' : '#ef4444'

  if (phase === 'start') return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-sm mx-auto">
      <div className="text-5xl">♠</div>
      <h2 className="text-2xl font-orbitron text-neon-purple">BLACKJACK</h2>
      <p className="text-space-muted text-sm text-center">Beat the dealer! Get closer to 21 without going over.</p>
      <div className="flex flex-col gap-2 w-full">
        {(['easy', 'medium', 'hard'] as Diff[]).map(d => (
          <button
            key={d}
            onClick={() => setDiff(d)}
            className="px-4 py-3 rounded-xl font-bold text-sm text-white transition-all"
            style={{
              background: diff === d ? diffColors[d] : 'rgba(255,255,255,0.07)',
              border: `2px solid ${diff === d ? diffColors[d] : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            <span className="block">{diffLabels[d]}</span>
            <span className="text-xs opacity-70">{diffDesc[d]}</span>
          </button>
        ))}
      </div>
      <button onClick={startBetting} className="btn-primary w-full py-3">Start Game</button>
    </div>
  )

  if (phase === 'gameover') return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="text-4xl">💸</div>
      <h2 className="text-2xl font-orbitron" style={{ color: '#ef4444' }}>BROKE!</h2>
      <p className="text-space-muted">Final score: {totalScore} chips won</p>
      <button onClick={resetGame} className="btn-primary px-8 py-3">Play Again</button>
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-4 p-4 max-w-sm mx-auto w-full">
      {/* Stats bar */}
      <div className="flex justify-between w-full items-center px-2">
        <div className="font-orbitron text-sm">
          <span className="text-space-muted">Chips: </span>
          <span className="text-neon-yellow font-bold">{chips}</span>
        </div>
        <div className="font-orbitron text-xs text-space-muted">
          Streak: <span className="text-neon-green">{streak}</span>
        </div>
        <div className="font-orbitron text-sm text-neon-purple">Score: {totalScore}</div>
      </div>

      {/* Dealer area */}
      <div
        className="w-full rounded-2xl p-4"
        style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <div className="text-xs text-space-muted mb-2 font-orbitron">
          DEALER {phase === 'result' ? `(${handTotal(dealerHand)})` : `(${dealerVisible}+?)`}
        </div>
        <div className="flex gap-2 flex-wrap min-h-[5rem] items-center">
          {dealerHand.map((c, i) => <CardUI key={i} card={c} />)}
        </div>
      </div>

      {/* Player area */}
      <div
        className="w-full rounded-2xl p-4"
        style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <div
          className="text-xs font-orbitron mb-2"
          style={{ color: playerTotal > 21 ? '#ef4444' : playerTotal === 21 ? '#fbbf24' : '#94a3b8' }}
        >
          YOU ({playerTotal})
          {playerTotal > 21 ? ' BUST' : playerTotal === 21 ? ' 21!' : ''}
        </div>
        <div className="flex gap-2 flex-wrap min-h-[5rem] items-center">
          {playerHand.map((c, i) => <CardUI key={i} card={c} />)}
        </div>
      </div>

      {/* Result message */}
      {result && (
        <div
          className="text-center font-orbitron text-sm px-4 py-3 rounded-xl w-full"
          style={{ background: resultBg, border: '1px solid rgba(139,92,246,0.3)', color: resultColor }}
        >
          {result}
          {bet > 0 && (
            <span className="ml-2 text-xs opacity-80">
              {isWin ? `+${isBlackjack(playerHand) ? Math.floor(bet * 1.5) : bet}` : isTie ? '±0' : `-${bet}`} chips
            </span>
          )}
        </div>
      )}

      {/* Betting phase */}
      {phase === 'betting' && (
        <div className="w-full">
          <p className="text-space-muted text-xs text-center mb-3">
            Place your bet (chips: {chips}):
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 100, 200].map(amt => (
              <button
                key={amt}
                onClick={() => placeBet(amt)}
                disabled={amt > chips}
                className="py-3 rounded-xl font-orbitron font-bold text-sm text-white transition-all disabled:opacity-30"
                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playing phase controls */}
      {phase === 'playing' && (
        <div className="flex gap-2 w-full">
          <button onClick={hit} className="btn-primary flex-1 py-3">Hit</button>
          <button onClick={stand} className="btn-secondary flex-1 py-3">Stand</button>
          {playerHand.length === 2 && chips >= bet * 2 && (
            <button
              onClick={doubleDown}
              className="flex-1 py-3 rounded-full font-bold text-xs"
              style={{
                color: '#fbbf24',
                background: 'rgba(251,191,36,0.15)',
                border: '1px solid rgba(251,191,36,0.4)',
              }}
            >
              2x Down
            </button>
          )}
        </div>
      )}

      {/* Result phase controls */}
      {phase === 'result' && (
        <div className="flex gap-3 w-full">
          <button onClick={nextHand} className="btn-primary flex-1 py-3">Next Hand</button>
          <button onClick={resetGame} className="btn-secondary flex-1 py-3 text-sm">Quit</button>
        </div>
      )}
    </div>
  )
}
