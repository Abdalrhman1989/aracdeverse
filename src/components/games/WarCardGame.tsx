"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useEffect, useCallback, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
type Card = { suit: Suit; rank: Rank; id: string }
type Difficulty = 'easy' | 'medium' | 'hard'
type GamePhase = 'start' | 'playing' | 'war' | 'gameover'
type RoundResult = 'player' | 'computer' | 'war' | null

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

function isRedSuit(suit: Suit): boolean {
  return suit === '♥' || suit === '♦'
}

function cardRankVal(card: Card): number {
  return RANK_VALUES[card.rank]
}

function BigCard({ card, label, winner, loser }: {
  card?: Card
  label: string
  winner?: boolean
  loser?: boolean
}) {
  if (!card) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs text-space-muted font-orbitron">{label}</div>
        <div
          className="w-20 h-28 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(15,15,42,0.8)',
            border: '2px dashed rgba(139,92,246,0.3)',
            color: '#475569',
            fontSize: '0.75rem',
          }}
        >
          No card
        </div>
      </div>
    )
  }

  const red = isRedSuit(card.suit)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-orbitron" style={{
        color: winner ? '#10b981' : loser ? '#ef4444' : '#94a3b8',
      }}>{label}</div>
      <div
        className="w-20 h-28 rounded-xl flex flex-col justify-between p-2 font-bold select-none transition-all"
        style={{
          background: winner
            ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)'
            : loser
            ? 'linear-gradient(135deg,#fee2e2,#fecaca)'
            : 'linear-gradient(135deg,#f8fafc,#e2e8f0)',
          border: winner
            ? '3px solid #10b981'
            : loser
            ? '3px solid #ef4444'
            : '2px solid rgba(0,0,0,0.1)',
          boxShadow: winner
            ? '0 0 20px rgba(16,185,129,0.5)'
            : loser
            ? '0 0 20px rgba(239,68,68,0.5)'
            : '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ color: red ? '#dc2626' : '#1e1b4b' }}>
          <div className="text-base">{card.rank}</div>
          <div className="text-lg">{card.suit}</div>
        </div>
        <div className="text-center text-2xl" style={{ color: red ? '#dc2626' : '#1e1b4b' }}>
          {card.suit}
        </div>
        <div style={{ color: red ? '#dc2626' : '#1e1b4b', transform: 'rotate(180deg)' }}>
          <div className="text-base">{card.rank}</div>
          <div className="text-lg">{card.suit}</div>
        </div>
      </div>
      {winner && <div className="text-xs font-bold" style={{ color: '#10b981' }}>WINS</div>}
      {loser && <div className="text-xs font-bold" style={{ color: '#ef4444' }}>LOSES</div>}
    </div>
  )
}

function FaceDownCard({ small }: { small?: boolean }) {
  return (
    <div
      className={`${small ? 'w-8 h-11' : 'w-12 h-16'} rounded-lg flex items-center justify-center`}
      style={{
        background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
        border: '2px solid rgba(139,92,246,0.4)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}
    >
    </div>
  )
}

export default function WarCardGame({ onScoreUpdate, onGameOver, onGameStart }: GameComponentProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [gamePhase, setGamePhase] = useState<GamePhase>('start')
  const [playerDeck, setPlayerDeck] = useState<Card[]>([])
  const [computerDeck, setComputerDeck] = useState<Card[]>([])
  const [playerCard, setPlayerCard] = useState<Card | null>(null)
  const [computerCard, setComputerCard] = useState<Card | null>(null)
  const [warPlayerCards, setWarPlayerCards] = useState<Card[]>([])
  const [warComputerCards, setWarComputerCards] = useState<Card[]>([])
  const [roundResult, setRoundResult] = useState<RoundResult>(null)
  const [roundNumber, setRoundNumber] = useState(0)
  const [score, setScore] = useState(0)
  const [message, setMessage] = useState('')
  const [autoFlipTimer, setAutoFlipTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [warDepth, setWarDepth] = useState(0)
  const [totalWarsWon, setTotalWarsWon] = useState(0)
  const [speedMode, setSpeedMode] = useState(false)
  const [speedCountdown, setSpeedCountdown] = useState(0)
  const speedRef = useRef(speedMode)
  speedRef.current = speedMode

  const AUTO_FLIP_DELAY = difficulty === 'easy' ? 1500 : difficulty === 'medium' ? 1000 : 600

  const collectCards = useCallback((winner: 'player' | 'computer', cards: Card[]) => {
    if (winner === 'player') sfxWin(); else sfxLose()
    if (winner === 'player') {
      setPlayerDeck(prev => [...prev, ...cards.sort(() => Math.random() - 0.5)])
      const newScore = score + cards.length
      setScore(newScore)
      onScoreUpdate(newScore)
    } else {
      setComputerDeck(prev => [...prev, ...cards.sort(() => Math.random() - 0.5)])
    }
  }, [score, onScoreUpdate])

  const resolveRound = useCallback((
    pCard: Card,
    cCard: Card,
    pDeck: Card[],
    cDeck: Card[],
    warCards: Card[],
    currentWarDepth: number
  ) => {
    const pVal = cardRankVal(pCard)
    const cVal = cardRankVal(cCard)
    const allCards = [...warCards, pCard, cCard]

    if (pVal > cVal) {
      setRoundResult('player')
      setMessage(`You win! ${pCard.rank}${pCard.suit} beats ${cCard.rank}${cCard.suit}`)
      setTimeout(() => {
        setPlayerDeck(prev => [...prev, ...allCards.sort(() => Math.random() - 0.5)])
        const newScore = score + allCards.length
        setScore(newScore)
        onScoreUpdate(newScore)
        setPlayerCard(null)
        setComputerCard(null)
        setWarPlayerCards([])
        setWarComputerCards([])
        setWarDepth(0)
        setGamePhase('playing')
        setRoundResult(null)
        setIsAnimating(false)
      }, AUTO_FLIP_DELAY)
    } else if (cVal > pVal) {
      setRoundResult('computer')
      setMessage(`Computer wins! ${cCard.rank}${cCard.suit} beats ${pCard.rank}${pCard.suit}`)
      setTimeout(() => {
        setComputerDeck(prev => [...prev, ...allCards.sort(() => Math.random() - 0.5)])
        setPlayerCard(null)
        setComputerCard(null)
        setWarPlayerCards([])
        setWarComputerCards([])
        setWarDepth(0)
        setGamePhase('playing')
        setRoundResult(null)
        setIsAnimating(false)
      }, AUTO_FLIP_DELAY)
    } else {
      // War!
      setRoundResult('war')
      setMessage(`WAR! Both played ${pCard.rank}${pCard.suit}!`)
      const newWarDepth = currentWarDepth + 1

      if (pDeck.length < 4 || cDeck.length < 4) {
        // Not enough cards for war - whoever has more wins
        const winner: 'player' | 'computer' = pDeck.length >= cDeck.length ? 'player' : 'computer'
        setMessage(`Not enough cards for war! ${winner === 'player' ? 'You win' : 'Computer wins'}!`)
        setTimeout(() => {
          if (winner === 'player') {
            setPlayerDeck(prev => [...prev, ...allCards, ...cDeck])
            setComputerDeck([])
          } else {
            setComputerDeck(prev => [...prev, ...allCards, ...pDeck])
            setPlayerDeck([])
          }
          setGamePhase('gameover')
          onGameOver(score)
        }, AUTO_FLIP_DELAY)
        return
      }

      // Take 3 face-down cards from each
      const pWarFaceDown = pDeck.slice(0, 3)
      const cWarFaceDown = cDeck.slice(0, 3)
      const newPDeck = pDeck.slice(3)
      const newCDeck = cDeck.slice(3)
      const newWarCards = [...allCards, ...pWarFaceDown, ...cWarFaceDown]

      setWarPlayerCards(prev => [...prev, pCard, ...pWarFaceDown])
      setWarComputerCards(prev => [...prev, cCard, ...cWarFaceDown])
      setWarDepth(newWarDepth)

      setTimeout(() => {
        setPlayerDeck(newPDeck)
        setComputerDeck(newCDeck)
        setGamePhase('war')
        setRoundResult(null)
        setIsAnimating(false)
      }, AUTO_FLIP_DELAY)
    }
  }, [score, onScoreUpdate, AUTO_FLIP_DELAY, onGameOver])

  const flipCards = useCallback(() => {
    if (isAnimating) return

    const currentPlayerDeck = playerDeck
    const currentComputerDeck = computerDeck

    if (currentPlayerDeck.length === 0) {
      setMessage("You have no cards! Game over!")
      setGamePhase('gameover')
      onGameOver(score)
      return
    }
    if (currentComputerDeck.length === 0) {
      setMessage("Computer has no cards! You win!")
      setGamePhase('gameover')
      onGameOver(score)
      return
    }

    setIsAnimating(true)
    const pCard = currentPlayerDeck[0]
    const cCard = currentComputerDeck[0]
    const newPDeck = currentPlayerDeck.slice(1)
    const newCDeck = currentComputerDeck.slice(1)

    setPlayerCard(pCard)
    setComputerCard(cCard)
    setPlayerDeck(newPDeck)
    setComputerDeck(newCDeck)
    setRoundNumber(r => r + 1)

    resolveRound(pCard, cCard, newPDeck, newCDeck, [], 0)
  }, [isAnimating, playerDeck, computerDeck, score, onGameOver, resolveRound])

  const flipWarCard = useCallback(() => {
    if (isAnimating || gamePhase !== 'war') return

    const currentPlayerDeck = playerDeck
    const currentComputerDeck = computerDeck

    if (currentPlayerDeck.length === 0 || currentComputerDeck.length === 0) {
      setMessage("Not enough cards for war!")
      setGamePhase('gameover')
      onGameOver(score)
      return
    }

    setIsAnimating(true)
    const pCard = currentPlayerDeck[0]
    const cCard = currentComputerDeck[0]
    const newPDeck = currentPlayerDeck.slice(1)
    const newCDeck = currentComputerDeck.slice(1)

    setPlayerCard(pCard)
    setComputerCard(cCard)
    setPlayerDeck(newPDeck)
    setComputerDeck(newCDeck)
    setTotalWarsWon(w => w + 1)

    const warCards = [...warPlayerCards, ...warComputerCards]
    resolveRound(pCard, cCard, newPDeck, newCDeck, warCards, warDepth)
  }, [isAnimating, gamePhase, playerDeck, computerDeck, warPlayerCards, warComputerCards, warDepth, score, onGameOver, resolveRound])

  // Speed mode auto-flip
  useEffect(() => {
    if (!speedMode || gamePhase !== 'playing' || isAnimating) return

    const timer = setTimeout(() => {
      // Computer auto-flips if player hasn't
      if (speedRef.current && gamePhase === 'playing' && !isAnimating) {
        flipCards()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [speedMode, gamePhase, isAnimating, flipCards])

  // Check game over
  useEffect(() => {
    if (gamePhase === 'playing' && playerDeck.length === 0 && !playerCard) {
      setMessage("You have no cards left! Computer wins!")
      onGameOver(score)
      setGamePhase('gameover')
    } else if (gamePhase === 'playing' && computerDeck.length === 0 && !computerCard) {
      setMessage("Computer has no cards! You win the war!")
      onGameOver(score + 100)
      setGamePhase('gameover')
    }
  }, [playerDeck, computerDeck, playerCard, computerCard, gamePhase, score, onGameOver])
  // Sound: victory/gameover on phase change
  const warPrevPhaseRef = useRef(gamePhase);
  useEffect(() => {
    if (warPrevPhaseRef.current !== gamePhase && gamePhase === 'gameover') {
      const pCards = playerDeck.length + (playerCard ? 1 : 0) + warPlayerCards.length;
      const cCards = computerDeck.length + (computerCard ? 1 : 0);
      if (pCards >= cCards) sfxVictory(); else sfxGameOver();
    }
    warPrevPhaseRef.current = gamePhase;
  }, [gamePhase]);


  const startGame = useCallback(() => {
    const deck = makeDeck()
    setPlayerDeck(deck.slice(0, 26))
    setComputerDeck(deck.slice(26))
    setPlayerCard(null)
    setComputerCard(null)
    setWarPlayerCards([])
    setWarComputerCards([])
    setRoundResult(null)
    setRoundNumber(0)
    setScore(0)
    setMessage('Flip your top card to start!')
    setIsAnimating(false)
    setWarDepth(0)
    setTotalWarsWon(0)
    setSpeedMode(difficulty === 'hard')
    setGamePhase('playing')
    onGameStart()
  }, [difficulty, onGameStart])

  const playerCardCount = playerDeck.length + (playerCard ? 1 : 0) + warPlayerCards.length
  const computerCardCount = computerDeck.length + (computerCard ? 1 : 0) + warComputerCards.length
  const progressPercent = 52 > 0 ? (playerCardCount / 52) * 100 : 0

  if (gamePhase === 'start') return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-sm mx-auto">
      <div className="text-5xl">⚔️</div>
      <h2 className="text-2xl font-orbitron text-neon-purple">WAR</h2>
      <p className="text-space-muted text-sm text-center">
        Flip cards and compare! Higher card wins. Tie = WAR (3 face-down + 1 battle card)!
      </p>
      <div className="flex flex-col gap-2 w-full">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
          const colors = { easy: '#10b981', medium: '#8b5cf6', hard: '#ef4444' }
          const labels = {
            easy: 'Easy - Relaxed pace',
            medium: 'Medium - Faster rounds',
            hard: 'Hard - Speed mode (auto-flip)',
          }
          return (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className="px-4 py-3 rounded-xl font-bold text-sm text-white transition-all"
              style={{
                background: difficulty === d ? colors[d] : 'rgba(255,255,255,0.07)',
                border: `2px solid ${difficulty === d ? colors[d] : 'rgba(255,255,255,0.15)'}`,
              }}
            >
              {labels[d]}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-space-muted text-center space-y-1">
        <p>2 &lt; 3 &lt; ... &lt; K &lt; A</p>
        <p>Collect all 52 cards to win!</p>
      </div>
      <button onClick={startGame} className="btn-primary w-full py-3">Start Battle!</button>
    </div>
  )

  if (gamePhase === 'gameover') return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-sm mx-auto">
      <div className="text-4xl">
        {playerCardCount >= computerCardCount ? '🏆' : '💀'}
      </div>
      <h2 className="text-2xl font-orbitron text-neon-purple">
        {playerCardCount >= computerCardCount ? 'Victory!' : 'Defeated!'}
      </h2>
      <p className="text-center text-sm text-space-muted">{message}</p>
      <div className="grid grid-cols-3 gap-4 text-center w-full">
        <div>
          <div className="text-xl font-orbitron text-neon-yellow">{score}</div>
          <div className="text-xs text-space-muted">Cards Won</div>
        </div>
        <div>
          <div className="text-xl font-orbitron text-neon-purple">{roundNumber}</div>
          <div className="text-xs text-space-muted">Rounds</div>
        </div>
        <div>
          <div className="text-xl font-orbitron" style={{ color: '#f59e0b' }}>{totalWarsWon}</div>
          <div className="text-xs text-space-muted">Wars</div>
        </div>
      </div>
      <div className="w-full rounded-xl overflow-hidden h-3" style={{ background: 'rgba(15,15,42,0.8)' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${(playerCardCount / 52) * 100}%`,
            background: 'linear-gradient(90deg,#8b5cf6,#10b981)',
          }}
        />
      </div>
      <div className="text-xs text-space-muted">
        Final: You {playerCardCount} - Computer {computerCardCount}
      </div>
      <button onClick={() => { setGamePhase('start'); setMessage('') }} className="btn-primary px-8 py-3">
        Play Again
      </button>
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-4 p-4 max-w-sm mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between w-full items-center">
        <div className="font-orbitron text-xs text-space-muted">
          Round <span className="text-neon-purple">{roundNumber}</span>
        </div>
        {gamePhase === 'war' && (
          <div className="font-orbitron text-xs font-bold animate-pulse" style={{ color: '#ef4444' }}>
            ⚔️ WAR! ⚔️
          </div>
        )}
        <div className="font-orbitron text-xs text-neon-yellow">
          Score: {score}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between text-xs text-space-muted mb-1">
          <span>You: {playerCardCount} cards</span>
          <span>CPU: {computerCardCount} cards</span>
        </div>
        <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(15,15,42,0.8)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: progressPercent > 50 ? 'linear-gradient(90deg,#8b5cf6,#10b981)' : 'linear-gradient(90deg,#ef4444,#8b5cf6)',
            }}
          />
        </div>
      </div>

      {/* Card stacks */}
      <div className="flex gap-4 items-end">
        {/* Player stack */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative" style={{ width: '3rem', height: '4rem' }}>
            {Array.from({ length: Math.min(playerDeck.length, 5) }).map((_, i) => (
              <div key={i} className="absolute" style={{ top: `-${i}px`, left: `${i}px` }}>
                <FaceDownCard small />
              </div>
            ))}
          </div>
          <div className="text-xs text-space-muted">{playerDeck.length}</div>
        </div>

        {/* Battle area */}
        <div
          className="flex-1 rounded-2xl p-4 flex flex-col items-center gap-3"
          style={{ background: 'rgba(15,15,42,0.8)', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          <div className="flex gap-6 items-center justify-center">
            <BigCard
              card={playerCard ?? undefined}
              label="You"
              winner={roundResult === 'player'}
              loser={roundResult === 'computer'}
            />
            <div className="flex flex-col items-center">
              <div className="text-lg font-orbitron" style={{
                color: roundResult === 'war' ? '#ef4444' : '#8b5cf6',
              }}>
                {roundResult === 'war' ? 'WAR' : 'VS'}
              </div>
              {roundResult === 'player' && <div className="text-2xl">←</div>}
              {roundResult === 'computer' && <div className="text-2xl">→</div>}
            </div>
            <BigCard
              card={computerCard ?? undefined}
              label="Computer"
              winner={roundResult === 'computer'}
              loser={roundResult === 'player'}
            />
          </div>

          {/* War cards face down */}
          {gamePhase === 'war' && (
            <div className="flex gap-8 mt-2">
              <div className="flex gap-0.5">
                {warPlayerCards.slice(0, 6).map((_, i) => <FaceDownCard key={i} small />)}
                {warPlayerCards.length > 6 && <span className="text-xs text-space-muted self-center ml-1">+{warPlayerCards.length - 6}</span>}
              </div>
              <div className="text-xs text-space-muted self-center font-orbitron">WAR CARDS</div>
              <div className="flex gap-0.5">
                {warComputerCards.slice(0, 6).map((_, i) => <FaceDownCard key={i} small />)}
                {warComputerCards.length > 6 && <span className="text-xs text-space-muted self-center ml-1">+{warComputerCards.length - 6}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Computer stack */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative" style={{ width: '3rem', height: '4rem' }}>
            {Array.from({ length: Math.min(computerDeck.length, 5) }).map((_, i) => (
              <div key={i} className="absolute" style={{ top: `-${i}px`, right: `${i}px` }}>
                <FaceDownCard small />
              </div>
            ))}
          </div>
          <div className="text-xs text-space-muted">{computerDeck.length}</div>
        </div>
      </div>

      {/* Message */}
      <div
        className="text-center text-sm font-orbitron px-4 py-2 rounded-xl w-full"
        style={{
          background: roundResult === 'player' ? 'rgba(16,185,129,0.15)'
            : roundResult === 'computer' ? 'rgba(239,68,68,0.15)'
            : roundResult === 'war' ? 'rgba(239,68,68,0.15)'
            : 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.2)',
          color: roundResult === 'player' ? '#10b981'
            : roundResult === 'computer' ? '#ef4444'
            : roundResult === 'war' ? '#ef4444'
            : '#94a3b8',
        }}
      >
        {message}
      </div>

      {/* Action button */}
      {gamePhase === 'playing' && (
        <button
          onClick={flipCards}
          disabled={isAnimating}
          className="btn-primary w-full py-4 text-lg font-orbitron disabled:opacity-40"
        >
          {speedMode ? 'FLIP FAST!' : 'Flip Card'}
        </button>
      )}
      {gamePhase === 'war' && (
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="text-xs font-orbitron text-center" style={{ color: '#ef4444' }}>
            WAR! 3 cards face-down placed. Flip your battle card!
          </div>
          <button
            onClick={flipWarCard}
            disabled={isAnimating}
            className="w-full py-4 text-lg font-orbitron font-bold rounded-full disabled:opacity-40 transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#ef4444,#dc2626)',
              color: 'white',
              border: '2px solid rgba(239,68,68,0.5)',
              boxShadow: '0 0 20px rgba(239,68,68,0.4)',
            }}
          >
            ⚔️ BATTLE!
          </button>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex gap-4 text-xs text-space-muted text-center">
        <div>Wars: <span className="font-bold" style={{ color: '#f59e0b' }}>{totalWarsWon}</span></div>
        {speedMode && <div className="text-neon-red font-bold">SPEED MODE</div>}
        <div>Score: <span className="font-bold text-neon-yellow">{score}</span></div>
      </div>
    </div>
  )
}
