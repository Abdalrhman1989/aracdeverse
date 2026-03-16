"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useCallback, useEffect } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
type Card = { suit: Suit; rank: Rank; id: string }
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
type GamePhase = 'start' | 'passing' | 'playing' | 'roundover' | 'gameover'
type PassDirection = 'left' | 'right' | 'across' | 'none'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

function makeDeck(): Card[] {
  const d: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ suit, rank, id: `${rank}${suit}` })
  return d.sort(() => Math.random() - 0.5)
}

function cardPoints(card: Card): number {
  if (card.suit === '♥') return 1
  if (card.suit === '♠' && card.rank === 'Q') return 13
  return 0
}

function isRedSuit(suit: Suit): boolean {
  return suit === '♥' || suit === '♦'
}

function rankVal(rank: Rank): number {
  return RANK_VALUES[rank]
}

function getPassDirection(roundNumber: number): PassDirection {
  const mod = roundNumber % 4
  if (mod === 1) return 'left'
  if (mod === 2) return 'right'
  if (mod === 3) return 'across'
  return 'none'
}

// AI card selection logic
function aiChooseCard(
  hand: Card[],
  trick: Card[],
  leadSuit: Suit | null,
  heartsBroken: boolean,
  trickCount: number,
  difficulty: Difficulty
): Card {
  if (difficulty === 'easy') {
    // Easy: mostly random, avoid taking points occasionally
    const valid = getValidCards(hand, leadSuit, heartsBroken, trickCount)
    return valid[Math.floor(Math.random() * valid.length)]
  }

  const valid = getValidCards(hand, leadSuit, heartsBroken, trickCount)

  if (difficulty === 'medium') {
    // Medium: try not to take hearts if possible, dump high cards when void
    const noPoints = valid.filter(c => cardPoints(c) === 0)
    if (noPoints.length > 0 && Math.random() > 0.3) {
      // play lowest no-points card
      return noPoints.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0]
    }
    return valid[Math.floor(Math.random() * valid.length)]
  }

  // Hard / Expert: strategic play
  if (leadSuit === null) {
    // Leading: play lowest safe card, avoid leading hearts until broken
    const nonHearts = valid.filter(c => c.suit !== '♥')
    const pool = nonHearts.length > 0 ? nonHearts : valid
    return pool.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0]
  }

  // Following: try to win trick only if it's safe, otherwise dump high cards
  const following = valid.filter(c => c.suit === leadSuit)
  if (following.length > 0) {
    const highestInTrick = trick.reduce((max, c) => {
      if (c.suit !== leadSuit) return max
      return rankVal(c.rank) > rankVal(max.rank) ? c : max
    }, trick[0])

    const canWinLow = following.filter(c => rankVal(c.rank) < rankVal(highestInTrick.rank))
    if (canWinLow.length > 0) {
      // Play highest card below current winner (safe play)
      return canWinLow.sort((a, b) => rankVal(b.rank) - rankVal(a.rank))[0]
    }
    // Must win or dump high card
    const trickHasPoints = trick.some(c => cardPoints(c) > 0)
    if (!trickHasPoints) {
      // Win with lowest winning card
      return following.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0]
    }
    // Try to dump a high card instead
    return following.sort((a, b) => rankVal(b.rank) - rankVal(a.rank))[0]
  }

  // Void in lead suit: dump highest point card or highest card
  const pointCards = valid.filter(c => cardPoints(c) > 0)
  if (pointCards.length > 0) {
    return pointCards.sort((a, b) => cardPoints(b) - cardPoints(a))[0]
  }
  return valid.sort((a, b) => rankVal(b.rank) - rankVal(a.rank))[0]
}

function getValidCards(
  hand: Card[],
  leadSuit: Suit | null,
  heartsBroken: boolean,
  trickCount: number
): Card[] {
  if (hand.length === 0) return []

  // First trick: must lead/play 2 of clubs if available
  if (trickCount === 0 && leadSuit === null) {
    const twoClubs = hand.find(c => c.rank === '2' && c.suit === '♣')
    if (twoClubs) return [twoClubs]
  }

  if (leadSuit === null) {
    // Leading: can't lead hearts until broken (unless only hearts remain)
    if (!heartsBroken) {
      const nonHearts = hand.filter(c => c.suit !== '♥')
      if (nonHearts.length > 0) return nonHearts
    }
    return hand
  }

  // Following: must follow suit
  const sameSuit = hand.filter(c => c.suit === leadSuit)
  if (sameSuit.length > 0) return sameSuit

  // Can't follow: any card, but on first trick no points
  if (trickCount === 0) {
    const noPoints = hand.filter(c => cardPoints(c) === 0)
    if (noPoints.length > 0) return noPoints
  }

  return hand
}

function aiChoosePassCards(hand: Card[], difficulty: Difficulty): Card[] {
  if (difficulty === 'easy') {
    return hand.sort(() => Math.random() - 0.5).slice(0, 3)
  }
  // Medium/Hard/Expert: pass high hearts and queen of spades
  const sorted = [...hand].sort((a, b) => {
    const pa = cardPoints(a) > 0 ? cardPoints(a) * 10 + rankVal(a.rank) : rankVal(a.rank)
    const pb = cardPoints(b) > 0 ? cardPoints(b) * 10 + rankVal(b.rank) : rankVal(b.rank)
    return pb - pa
  })
  return sorted.slice(0, 3)
}

function CardFace({ card, small, selected, onClick, disabled }: {
  card: Card
  small?: boolean
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const red = isRedSuit(card.suit)
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`${small ? 'w-9 h-13' : 'w-12 h-16'} rounded-lg flex flex-col justify-between p-1 font-bold select-none transition-all`}
      style={{
        background: selected ? 'linear-gradient(135deg,#fef9c3,#fde047)' : 'linear-gradient(135deg,#f8fafc,#e2e8f0)',
        border: selected ? '2px solid #fbbf24' : '2px solid rgba(0,0,0,0.1)',
        boxShadow: selected ? '0 0 12px rgba(251,191,36,0.6)' : '0 2px 6px rgba(0,0,0,0.4)',
        cursor: disabled ? 'default' : 'pointer',
        transform: selected ? 'translateY(-8px)' : 'none',
        fontSize: small ? '0.6rem' : '0.75rem',
        minWidth: small ? '2.25rem' : '3rem',
        minHeight: small ? '3.25rem' : '4rem',
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

function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      className={`${small ? 'w-9' : 'w-12'} ${small ? 'h-13' : 'h-16'} rounded-lg flex items-center justify-center`}
      style={{
        background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
        border: '2px solid rgba(139,92,246,0.4)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        minWidth: small ? '2.25rem' : '3rem',
        minHeight: small ? '3.25rem' : '4rem',
      }}
    >
      <span style={{ fontSize: small ? '1rem' : '1.2rem' }}>🂠</span>
    </div>
  )
}

const PLAYER_NAMES = ['You', 'West', 'North', 'East']

export default function HeartsGame({ onScoreUpdate, onGameOver, onGameStart }: GameComponentProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [gamePhase, setGamePhase] = useState<GamePhase>('start')
  const [roundNumber, setRoundNumber] = useState(1)
  const [hands, setHands] = useState<Card[][]>([[], [], [], []])
  const [scores, setScores] = useState([0, 0, 0, 0])
  const [roundScores, setRoundScores] = useState([0, 0, 0, 0])
  const [currentTrick, setCurrentTrick] = useState<{ card: Card; player: number }[]>([])
  const [leadSuit, setLeadSuit] = useState<Suit | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [heartsBroken, setHeartsBroken] = useState(false)
  const [trickCount, setTrickCount] = useState(0)
  const [tricksWon, setTricksWon] = useState([0, 0, 0, 0])
  const [passDirection, setPassDirection] = useState<PassDirection>('left')
  const [selectedPassCards, setSelectedPassCards] = useState<Card[]>([])
  const [passingComplete, setPassingComplete] = useState(false)
  const [trickWinner, setTrickWinner] = useState<number | null>(null)
  const [lastTrick, setLastTrick] = useState<{ card: Card; player: number }[]>([])
  const [message, setMessage] = useState('')
  const [totalPlayerScore, setTotalPlayerScore] = useState(0)

  const startGame = useCallback(() => {
    const deck = makeDeck()
    const newHands: Card[][] = [[], [], [], []]
    for (let i = 0; i < 52; i++) newHands[i % 4].push(deck[i])
    // Sort hands
    newHands.forEach(h => h.sort((a, b) => {
      const sOrder: Record<Suit, number> = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }
      if (sOrder[a.suit] !== sOrder[b.suit]) return sOrder[a.suit] - sOrder[b.suit]
      return rankVal(a.rank) - rankVal(b.rank)
    }))
    const dir = getPassDirection(1)
    setHands(newHands)
    setScores([0, 0, 0, 0])
    setRoundScores([0, 0, 0, 0])
    setRoundNumber(1)
    setPassDirection(dir)
    setSelectedPassCards([])
    setPassingComplete(false)
    setCurrentTrick([])
    setLeadSuit(null)
    setHeartsBroken(false)
    setTrickCount(0)
    setTricksWon([0, 0, 0, 0])
    setTrickWinner(null)
    setLastTrick([])
    setMessage('')
    setTotalPlayerScore(0)
    if (dir !== 'none') {
      setGamePhase('passing')
    } else {
      // Find who has 2 of clubs
      const starter = newHands.findIndex(h => h.some(c => c.rank === '2' && c.suit === '♣'))
      setCurrentPlayer(starter >= 0 ? starter : 0)
      setGamePhase('playing')
    }
    onGameStart()
  }, [onGameStart])

  const togglePassCard = useCallback((card: Card) => {
    setSelectedPassCards(prev => {
      const exists = prev.find(c => c.id === card.id)
      if (exists) return prev.filter(c => c.id !== card.id)
      if (prev.length >= 3) return prev
      return [...prev, card]
    })
  }, [])

  const confirmPass = useCallback(() => {
    if (selectedPassCards.length !== 3) return
    // Build new hands after passing
    const newHands = hands.map(h => [...h])
    const passMap: Record<PassDirection, number[]> = {
      left:   [1, 2, 3, 0],
      right:  [3, 0, 1, 2],
      across: [2, 3, 0, 1],
      none:   [0, 1, 2, 3],
    }
    const targets = passMap[passDirection]

    // AI pass selection
    const aiPasses: Card[][] = [selectedPassCards]
    for (let p = 1; p < 4; p++) {
      aiPasses.push(aiChoosePassCards(newHands[p], difficulty))
    }

    // Remove passed cards and give to targets
    for (let p = 0; p < 4; p++) {
      const target = targets[p]
      newHands[p] = newHands[p].filter(c => !aiPasses[p].find(pc => pc.id === c.id))
      newHands[target] = [...newHands[target], ...aiPasses[p]]
    }

    // Sort hands
    newHands.forEach(h => h.sort((a, b) => {
      const sOrder: Record<Suit, number> = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }
      if (sOrder[a.suit] !== sOrder[b.suit]) return sOrder[a.suit] - sOrder[b.suit]
      return rankVal(a.rank) - rankVal(b.rank)
    }))

    setHands(newHands)
    setSelectedPassCards([])
    setPassingComplete(true)

    // Find who has 2 of clubs
    const starter = newHands.findIndex(h => h.some(c => c.rank === '2' && c.suit === '♣'))
    setCurrentPlayer(starter >= 0 ? starter : 0)
    setGamePhase('playing')
  }, [selectedPassCards, hands, passDirection, difficulty])

  const playCard = useCallback((card: Card) => {
    sfxCardPlay()
    if (currentPlayer !== 0 || gamePhase !== 'playing') return
    const valid = getValidCards(hands[0], leadSuit, heartsBroken, trickCount)
    if (!valid.find(c => c.id === card.id)) return

    const newTrick = [...currentTrick, { card, player: 0 }]
    const newLead = leadSuit ?? card.suit
    const newHeartsBroken = heartsBroken || card.suit === '♥'
    const newHands = hands.map((h, i) => i === 0 ? h.filter(c => c.id !== card.id) : h)

    setHands(newHands)
    setCurrentTrick(newTrick)
    setLeadSuit(newLead)
    setHeartsBroken(newHeartsBroken)
    setCurrentPlayer(1)
  }, [currentPlayer, gamePhase, hands, leadSuit, heartsBroken, trickCount, currentTrick])

  // AI plays automatically
  useEffect(() => {
    if (gamePhase !== 'playing' || currentPlayer === 0 || trickWinner !== null) return

    const delay = difficulty === 'easy' ? 600 : difficulty === 'medium' ? 450 : difficulty === 'hard' ? 300 : 200

    const timer = setTimeout(() => {
      const aiHand = hands[currentPlayer]
      if (aiHand.length === 0) return

      const card = aiChooseCard(aiHand, currentTrick.map(t => t.card), leadSuit, heartsBroken, trickCount, difficulty)
      const newTrick = [...currentTrick, { card, player: currentPlayer }]
      const newLead = leadSuit ?? card.suit
      const newHeartsBroken = heartsBroken || card.suit === '♥'
      const newHands = hands.map((h, i) => i === currentPlayer ? h.filter(c => c.id !== card.id) : h)

      setHands(newHands)
      setCurrentTrick(newTrick)
      setLeadSuit(newLead)
      setHeartsBroken(newHeartsBroken)

      if (newTrick.length === 4) {
        // Determine winner
        const lead = newLead
        let winner = newTrick[0]
        for (const t of newTrick) {
          if (t.card.suit === lead && rankVal(t.card.rank) > rankVal(winner.card.rank)) {
            winner = t
          }
        }
        const trickPoints = newTrick.reduce((sum, t) => sum + cardPoints(t.card), 0)

        setTimeout(() => {
          setLastTrick(newTrick)
          setTrickWinner(winner.player)
    if (winner.player === 0) sfxWin()
          setRoundScores(prev => {
            const n = [...prev]
            n[winner.player] += trickPoints
            return n
          })
          setTricksWon(prev => {
            const n = [...prev]
            n[winner.player]++
            return n
          })

          setTimeout(() => {
            const newTrickCount = trickCount + 1
            setCurrentTrick([])
            setLeadSuit(null)
            setTrickWinner(null)

            if (newTrickCount >= 13) {
              // Round over
              setTrickCount(0)
              setGamePhase('roundover')
            } else {
              setTrickCount(newTrickCount)
              setCurrentPlayer(winner.player)
            }
          }, 1200)
        }, 300)
      } else {
        setCurrentPlayer(p => (p % 3) + 1 === 0 ? 0 : (p + 1) % 4)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [currentPlayer, gamePhase, hands, currentTrick, leadSuit, heartsBroken, trickCount, trickWinner, difficulty])

  // When player plays and trick is complete
  useEffect(() => {
    if (gamePhase !== 'playing' || currentTrick.length !== 4 || trickWinner !== null) return

    const lead = leadSuit!
    let winner = currentTrick[0]
    for (const t of currentTrick) {
      if (t.card.suit === lead && rankVal(t.card.rank) > rankVal(winner.card.rank)) {
        winner = t
      }
    }
    const trickPoints = currentTrick.reduce((sum, t) => sum + cardPoints(t.card), 0)

    setLastTrick(currentTrick)
    setTrickWinner(winner.player)
    setRoundScores(prev => {
      const n = [...prev]
      n[winner.player] += trickPoints
      return n
    })
    setTricksWon(prev => {
      const n = [...prev]
      n[winner.player]++
      return n
    })

    const timer = setTimeout(() => {
      const newTrickCount = trickCount + 1
      setCurrentTrick([])
      setLeadSuit(null)
      setTrickWinner(null)

      if (newTrickCount >= 13) {
        setTrickCount(0)
        setGamePhase('roundover')
      } else {
        setTrickCount(newTrickCount)
        setCurrentPlayer(winner.player)
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [currentTrick, gamePhase, trickWinner, leadSuit, trickCount])

  const finishRound = useCallback(() => {
    // Check for shoot the moon
    let finalRoundScores = [...roundScores]
    for (let p = 0; p < 4; p++) {
      if (finalRoundScores[p] === 26) {
        // Shot the moon
        finalRoundScores = finalRoundScores.map((s, i) => i === p ? 0 : s + 26)
        if (p === 0) setMessage('You shot the moon! Everyone else +26!')
        else setMessage(`${PLAYER_NAMES[p]} shot the moon! All others +26!`)
        break
      }
    }

    const newScores = scores.map((s, i) => s + finalRoundScores[i])
    setScores(newScores)

    const playerScore = newScores[0]
    const newTotal = totalPlayerScore + finalRoundScores[0]
    setTotalPlayerScore(newTotal)
    onScoreUpdate(Math.max(0, 1000 - playerScore * 10))

    // Check game over
    if (newScores.some(s => s >= 100)) {
      const minScore = Math.min(...newScores)
      if (newScores[0] === minScore) {
        setMessage('You win the game! Lowest score!')
      } else {
        setMessage('Game over! You lost.')
      }
      const heartsPlayerScore = newScores[0]; const heartsMin = Math.min(...newScores.slice(1)); if (heartsPlayerScore < heartsMin) sfxVictory(); else sfxGameOver()
      onGameOver(Math.max(0, 1000 - newScores[0] * 10))
      setGamePhase('gameover')
      return
    }

    // Start next round
    const nextRound = roundNumber + 1
    const deck = makeDeck()
    const newHands: Card[][] = [[], [], [], []]
    for (let i = 0; i < 52; i++) newHands[i % 4].push(deck[i])
    newHands.forEach(h => h.sort((a, b) => {
      const sOrder: Record<Suit, number> = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }
      if (sOrder[a.suit] !== sOrder[b.suit]) return sOrder[a.suit] - sOrder[b.suit]
      return rankVal(a.rank) - rankVal(b.rank)
    }))

    const newDir = getPassDirection(nextRound)
    setHands(newHands)
    setRoundScores([0, 0, 0, 0])
    setRoundNumber(nextRound)
    setPassDirection(newDir)
    setSelectedPassCards([])
    setPassingComplete(false)
    setHeartsBroken(false)
    setTricksWon([0, 0, 0, 0])
    setTrickWinner(null)
    setLastTrick([])
    setCurrentTrick([])
    setLeadSuit(null)

    if (newDir !== 'none') {
      setGamePhase('passing')
    } else {
      const starter = newHands.findIndex(h => h.some(c => c.rank === '2' && c.suit === '♣'))
      setCurrentPlayer(starter >= 0 ? starter : 0)
      setGamePhase('playing')
    }
  }, [roundScores, scores, roundNumber, totalPlayerScore, onScoreUpdate, onGameOver])

  const diffColors: Record<Difficulty, string> = {
    easy: '#10b981', medium: '#8b5cf6', hard: '#f59e0b', expert: '#ef4444',
  }
  const passArrow: Record<PassDirection, string> = {
    left: 'Pass Left', right: 'Pass Right', across: 'Pass Across', none: 'No Pass',
  }

  if (gamePhase === 'start') return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-sm mx-auto">
      <div className="text-5xl">♥</div>
      <h2 className="text-2xl font-orbitron text-neon-purple">HEARTS</h2>
      <p className="text-space-muted text-sm text-center">Avoid hearts and the Queen of Spades. Lowest score wins!</p>
      <div className="flex flex-col gap-2 w-full">
        {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className="px-4 py-3 rounded-xl font-bold text-sm text-white transition-all capitalize"
            style={{
              background: difficulty === d ? diffColors[d] : 'rgba(255,255,255,0.07)',
              border: `2px solid ${difficulty === d ? diffColors[d] : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="text-xs text-space-muted text-center space-y-1">
        <p>♥ = 1pt each | Q♠ = 13pts</p>
        <p>Shoot the Moon: take ALL = others get 26</p>
        <p>First to 100 loses</p>
      </div>
      <button onClick={startGame} className="btn-primary w-full py-3">Deal Cards</button>
    </div>
  )

  if (gamePhase === 'gameover') return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-sm mx-auto">
      <div className="text-4xl">♥</div>
      <h2 className="text-2xl font-orbitron text-neon-purple">Game Over</h2>
      <p className="text-center text-sm" style={{ color: '#94a3b8' }}>{message}</p>
      <div className="w-full rounded-xl p-4 space-y-2" style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        {PLAYER_NAMES.map((name, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className={`text-sm font-bold ${i === 0 ? 'text-neon-purple' : 'text-space-muted'}`}>{name}</span>
            <span className="font-orbitron text-sm" style={{ color: i === 0 ? '#8b5cf6' : '#94a3b8' }}>{scores[i]} pts</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setGamePhase('start'); setMessage('') }}
        className="btn-primary px-8 py-3"
      >
        Play Again
      </button>
    </div>
  )

  if (gamePhase === 'roundover') return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-sm mx-auto">
      <h2 className="text-xl font-orbitron text-neon-purple">Round {roundNumber} Over</h2>
      {message && <p className="text-center text-sm text-neon-yellow">{message}</p>}
      <div className="w-full rounded-xl p-4 space-y-2" style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <p className="text-xs text-space-muted font-orbitron mb-2">Round Scores</p>
        {PLAYER_NAMES.map((name, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className={`text-sm font-bold ${i === 0 ? 'text-neon-purple' : 'text-space-muted'}`}>{name}</span>
            <div className="flex gap-3">
              <span className="text-xs text-space-muted">+{roundScores[i]}</span>
              <span className="font-orbitron text-sm" style={{ color: i === 0 ? '#8b5cf6' : '#94a3b8' }}>
                {scores[i] + roundScores[i]} total
              </span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={finishRound} className="btn-primary px-8 py-3">Next Round</button>
    </div>
  )

  if (gamePhase === 'passing') return (
    <div className="flex flex-col items-center gap-4 p-4 max-w-sm mx-auto w-full">
      <div className="flex justify-between w-full items-center">
        <h2 className="text-lg font-orbitron text-neon-purple">{passArrow[passDirection]}</h2>
        <div className="text-xs text-space-muted">Round {roundNumber}</div>
      </div>
      <p className="text-sm text-space-muted text-center">
        Choose 3 cards to pass {passDirection}. Selected: {selectedPassCards.length}/3
      </p>
      <div
        className="w-full rounded-2xl p-3"
        style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <div className="flex flex-wrap gap-1 justify-center">
          {hands[0].map(card => (
            <CardFace
              key={card.id}
              card={card}
              small
              selected={!!selectedPassCards.find(c => c.id === card.id)}
              onClick={() => togglePassCard(card)}
            />
          ))}
        </div>
      </div>
      <button
        onClick={confirmPass}
        disabled={selectedPassCards.length !== 3}
        className="btn-primary w-full py-3 disabled:opacity-40"
      >
        Pass Cards
      </button>
      <div className="w-full rounded-xl p-3" style={{ background: 'rgba(15,15,42,0.6)', border: '1px solid rgba(139,92,246,0.1)' }}>
        <p className="text-xs text-space-muted font-orbitron mb-2">Scores</p>
        {PLAYER_NAMES.map((name, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span style={{ color: i === 0 ? '#8b5cf6' : '#94a3b8' }}>{name}</span>
            <span style={{ color: i === 0 ? '#8b5cf6' : '#94a3b8' }}>{scores[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )

  // Playing phase
  const trickHasPlayerCard = currentTrick.find(t => t.player === 0)
  const waitingForPlayer = currentPlayer === 0 && !trickHasPlayerCard
  const validCards = waitingForPlayer ? getValidCards(hands[0], leadSuit, heartsBroken, trickCount) : []

  return (
    <div className="flex flex-col items-center gap-3 p-4 max-w-sm mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between w-full items-center">
        <div className="text-xs font-orbitron text-space-muted">Round {roundNumber} | Trick {trickCount + 1}/13</div>
        <div className="text-xs font-orbitron" style={{ color: heartsBroken ? '#ef4444' : '#94a3b8' }}>
          {heartsBroken ? '♥ Broken' : '♥ Not broken'}
        </div>
      </div>

      {/* Score bar */}
      <div className="grid grid-cols-4 gap-1 w-full">
        {PLAYER_NAMES.map((name, i) => (
          <div
            key={i}
            className="rounded-lg p-2 text-center"
            style={{
              background: i === currentPlayer ? 'rgba(139,92,246,0.2)' : 'rgba(15,15,42,0.6)',
              border: `1px solid ${i === currentPlayer ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.1)'}`,
            }}
          >
            <div className="text-xs font-bold" style={{ color: i === 0 ? '#8b5cf6' : '#94a3b8' }}>{name}</div>
            <div className="text-xs text-space-muted">{scores[i]}+{roundScores[i]}</div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>{hands[i].length}cards</div>
          </div>
        ))}
      </div>

      {/* AI hands (show count) */}
      <div className="flex justify-between w-full px-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-0.5">
            {Array.from({ length: Math.min(hands[i].length, 8) }).map((_, j) => (
              <CardBack key={j} small />
            ))}
            {hands[i].length > 8 && <span className="text-xs text-space-muted self-center">+{hands[i].length - 8}</span>}
          </div>
        ))}
      </div>

      {/* Trick area */}
      <div
        className="w-full rounded-2xl p-4 min-h-24"
        style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.3)' }}
      >
        <div className="text-xs text-space-muted mb-2 font-orbitron">
          {trickWinner !== null ? `${PLAYER_NAMES[trickWinner]} wins the trick!` : leadSuit ? `Lead: ${leadSuit}` : 'Trick'}
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          {currentTrick.map((t, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="text-xs text-space-muted">{PLAYER_NAMES[t.player]}</div>
              <CardFace card={t.card} />
            </div>
          ))}
          {currentTrick.length === 0 && lastTrick.length > 0 && (
            <div className="text-xs text-space-muted self-center">Last trick shown above</div>
          )}
        </div>
      </div>

      {/* Player hand */}
      <div
        className="w-full rounded-2xl p-3"
        style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <div className="text-xs text-space-muted mb-2 font-orbitron">
          Your Hand ({hands[0].length} cards)
          {waitingForPlayer && <span className="text-neon-yellow ml-2">- Your turn!</span>}
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {hands[0].map(card => {
            const isValid = validCards.find(c => c.id === card.id)
            return (
              <CardFace
                key={card.id}
                card={card}
                small
                onClick={waitingForPlayer && isValid ? () => playCard(card) : undefined}
                disabled={!waitingForPlayer || !isValid}
                selected={false}
              />
            )
          })}
        </div>
      </div>

      {/* Round scores mini */}
      <div className="flex gap-2 text-xs text-space-muted">
        {PLAYER_NAMES.map((name, i) => (
          <span key={i}>
            <span style={{ color: i === 0 ? '#8b5cf6' : '#94a3b8' }}>{name}</span>: {roundScores[i]}
          </span>
        ))}
      </div>
    </div>
  )
}
