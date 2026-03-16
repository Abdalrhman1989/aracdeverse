"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound'
import { useState, useEffect, useCallback, useRef } from "react"
import type { GameComponentProps } from "@/types/game"

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
type Card = { suit: Suit; rank: Rank; id: string }
type Difficulty = 'easy' | 'medium' | 'hard'
type GamePhase = 'start' | 'playing' | 'gameover'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const COMPUTER_REACT_MS: Record<Difficulty, number> = {
  easy: 1200,
  medium: 700,
  hard: 300,
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

function CardDisplay({ card, faceDown, animate }: { card?: Card; faceDown?: boolean; animate?: boolean }) {
  if (!card || faceDown) {
    return (
      <div
        className="w-20 h-28 rounded-xl flex items-center justify-center font-bold select-none"
        style={{
          background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
          border: '2px solid rgba(139,92,246,0.4)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <span className="text-3xl">🂠</span>
      </div>
    )
  }

  const red = isRedSuit(card.suit)
  const isJack = card.rank === 'J'

  return (
    <div
      className="w-20 h-28 rounded-xl flex flex-col justify-between p-2 font-bold select-none"
      style={{
        background: isJack
          ? 'linear-gradient(135deg,#fef9c3,#fde047)'
          : 'linear-gradient(135deg,#f8fafc,#e2e8f0)',
        border: isJack ? '3px solid #f59e0b' : '2px solid rgba(0,0,0,0.15)',
        boxShadow: isJack
          ? '0 0 24px rgba(251,191,36,0.8), 0 4px 16px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        transform: animate ? 'scale(1.05)' : 'none',
        transition: 'transform 0.1s',
      }}
    >
      <div style={{ color: red ? '#dc2626' : '#1e1b4b' }}>
        <div className="text-base">{card.rank}</div>
        <div className="text-base">{card.suit}</div>
      </div>
      {isJack && (
        <div className="text-center text-2xl">J</div>
      )}
      <div style={{ color: red ? '#dc2626' : '#1e1b4b', transform: 'rotate(180deg)' }}>
        <div className="text-base">{card.rank}</div>
        <div className="text-base">{card.suit}</div>
      </div>
    </div>
  )
}

function PileCard({ card, index }: { card: Card; index: number }) {
  const red = isRedSuit(card.suit)
  const offset = (index % 5) * 2 - 4
  return (
    <div
      className="absolute w-20 h-28 rounded-xl"
      style={{
        background: index === 0 ? (card.rank === 'J' ? 'linear-gradient(135deg,#fef9c3,#fde047)' : 'linear-gradient(135deg,#f8fafc,#e2e8f0)') : 'linear-gradient(135deg,#1e1b4b,#312e81)',
        border: index === 0 ? (card.rank === 'J' ? '3px solid #f59e0b' : '2px solid rgba(0,0,0,0.1)') : '2px solid rgba(139,92,246,0.3)',
        boxShadow: index === 0 ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
        transform: `rotate(${offset}deg) translateX(${offset}px)`,
        top: `${Math.abs(offset)}px`,
        left: 0,
        zIndex: index,
      }}
    >
      {index === 0 && (
        <div className="w-full h-full flex flex-col justify-between p-2">
          <div style={{ color: red ? '#dc2626' : '#1e1b4b' }}>
            <div className="text-base font-bold">{card.rank}</div>
            <div className="text-base font-bold">{card.suit}</div>
          </div>
          <div style={{ color: red ? '#dc2626' : '#1e1b4b', transform: 'rotate(180deg)' }}>
            <div className="text-base font-bold">{card.rank}</div>
            <div className="text-base font-bold">{card.suit}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SlapJackGame({ onScoreUpdate, onGameOver, onGameStart }: GameComponentProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [gamePhase, setGamePhase] = useState<GamePhase>('start')
  const [playerDeck, setPlayerDeck] = useState<Card[]>([])
  const [computerDeck, setComputerDeck] = useState<Card[]>([])
  const [pile, setPile] = useState<Card[]>([])
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [message, setMessage] = useState('')
  const [score, setScore] = useState(0)
  const [slapResult, setSlapResult] = useState<'correct' | 'wrong' | null>(null)
  const [lastSlapBy, setLastSlapBy] = useState<'player' | 'computer' | null>(null)
  const [flipping, setFlipping] = useState(false)
  const [computerSlapTimer, setComputerSlapTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [roundsWon, setRoundsWon] = useState(0)
  const pileRef = useRef(pile)
  pileRef.current = pile

  const isJackOnTop = useCallback((currentPile: Card[]) => {
    return currentPile.length > 0 && currentPile[0].rank === 'J'
  }, [])

  const clearSlapResult = useCallback(() => {
    setTimeout(() => {
      setSlapResult(null)
      setLastSlapBy(null)
    }, 800)
  }, [])

  const startGame = useCallback(() => {
    const deck = makeDeck()
    const half = Math.floor(deck.length / 2)
    setPlayerDeck(deck.slice(0, half))
    setComputerDeck(deck.slice(half))
    setPile([])
    setIsPlayerTurn(true)
    setMessage("Your turn! Press Space or tap the pile area to slap a Jack!")
    setScore(0)
    setSlapResult(null)
    setLastSlapBy(null)
    setFlipping(false)
    setRoundsWon(0)
    setGamePhase('playing')
    onGameStart()
  }, [onGameStart])

  const flipCard = useCallback((fromPlayer: boolean) => {
    if (flipping) return

    if (fromPlayer) {
      if (playerDeck.length === 0) {
        setMessage("You have no cards! Slap the Jack to get cards back!")
        return
      }
      setFlipping(true)
      sfxCardFlip()
      const card = playerDeck[0]
      const newPlayerDeck = playerDeck.slice(1)
      const newPile = [card, ...pile]
      setPlayerDeck(newPlayerDeck)
      setPile(newPile)
      setIsPlayerTurn(false)

      if (card.rank === 'J') {
        setMessage("JACK! SLAP IT NOW!")
        // Schedule computer slap
        const reactTime = COMPUTER_REACT_MS[difficulty]
        const timer = setTimeout(() => {
          // Computer slaps
          if (isJackOnTop(pileRef.current)) {
            setLastSlapBy('computer')
            setSlapResult('correct')
            const wonCards = pileRef.current
            setComputerDeck(prev => [...prev, ...wonCards.reverse()])
            setPile([])
            setMessage("Computer slapped the Jack! Computer wins the pile!")
            clearSlapResult()
          }
        }, reactTime)
        setComputerSlapTimer(timer)
      } else {
        setMessage("Computer's turn...")
        // Computer flips after delay
        const delay = difficulty === 'easy' ? 900 : difficulty === 'medium' ? 600 : 400
        setTimeout(() => {
          setFlipping(false)
          setIsPlayerTurn(false)
          // trigger computer flip
        }, delay)
      }
      setTimeout(() => setFlipping(false), 300)
    }
  }, [flipping, playerDeck, pile, difficulty, isJackOnTop, clearSlapResult])

  // Computer auto-flip
  useEffect(() => {
    if (gamePhase !== 'playing' || isPlayerTurn || flipping) return
    if (isJackOnTop(pile)) return // Wait for slap resolution

    const delay = difficulty === 'easy' ? 900 : difficulty === 'medium' ? 600 : 400
    const timer = setTimeout(() => {
      if (computerDeck.length === 0) {
        setMessage("Computer has no cards! Flip to take the pile!")
        setIsPlayerTurn(true)
        return
      }
      setFlipping(true)
      const card = computerDeck[0]
      const newComputerDeck = computerDeck.slice(1)
      const newPile = [card, ...pile]
      setComputerDeck(newComputerDeck)
      setPile(newPile)

      if (card.rank === 'J') {
        setMessage("JACK! SLAP IT NOW!")
        // Schedule computer slap
        const reactTime = COMPUTER_REACT_MS[difficulty]
        const slapTimer = setTimeout(() => {
          if (isJackOnTop(pileRef.current)) {
            setLastSlapBy('computer')
            setSlapResult('correct')
            const wonCards = pileRef.current
            setComputerDeck(prev => [...prev, ...wonCards.reverse()])
            setPile([])
            setMessage("Computer slapped the Jack! Computer wins the pile!")
            clearSlapResult()
          }
        }, reactTime)
        setComputerSlapTimer(slapTimer)
        setTimeout(() => {
          setFlipping(false)
          setIsPlayerTurn(true)
        }, 200)
      } else {
        setTimeout(() => {
          setFlipping(false)
          setIsPlayerTurn(true)
        }, 300)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [isPlayerTurn, gamePhase, computerDeck, pile, flipping, difficulty, isJackOnTop, clearSlapResult])

  const handleSlap = useCallback(() => {
    if (gamePhase !== 'playing') return

    if (isJackOnTop(pile)) {
      // Correct slap!
      sfxSlap()
      if (computerSlapTimer) clearTimeout(computerSlapTimer)
      setLastSlapBy('player')
      setSlapResult('correct')
      const wonCards = pile
      const newScore = score + wonCards.length
      setPlayerDeck(prev => [...prev, ...wonCards.reverse()])
      setPile([])
      setRoundsWon(r => r + 1)
      setScore(newScore)
      onScoreUpdate(newScore)
      setMessage(`You slapped the Jack! Won ${wonCards.length} cards!`)
      setIsPlayerTurn(true)
      clearSlapResult()
    } else {
      // Wrong slap - lose 3 cards to pile
      setSlapResult('wrong')
      if (playerDeck.length > 0) {
        const penalty = playerDeck.slice(0, Math.min(3, playerDeck.length))
        setPlayerDeck(prev => prev.slice(Math.min(3, prev.length)))
        setPile(prev => [...prev, ...penalty])
        setMessage("Wrong slap! Lost 3 cards to the pile!")
      } else {
        setMessage("Wrong slap! No cards to lose.")
      }
      clearSlapResult()
    }
  }, [gamePhase, pile, computerSlapTimer, score, playerDeck, onScoreUpdate, clearSlapResult, isJackOnTop])

  // Keyboard listener
  useEffect(() => {
    if (gamePhase !== 'playing') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleSlap()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gamePhase, handleSlap])

  // Check game over
  useEffect(() => {
    if (gamePhase !== 'playing') return
    if (playerDeck.length === 52 && pile.length === 0) {
      setMessage("You won! You have all 52 cards!")
      sfxVictory()
      onGameOver(score)
      setGamePhase('gameover')
    } else if (computerDeck.length === 52 && pile.length === 0) {
      setMessage("Computer won! Computer has all 52 cards!")
      sfxGameOver()
      onGameOver(score)
      setGamePhase('gameover')
    } else if (playerDeck.length === 0 && pile.length === 0 && computerDeck.length > 0) {
      // Player is out - check if there's anything left
      setMessage("You ran out of cards! Game over!")
      sfxGameOver()
      onGameOver(score)
      setGamePhase('gameover')
    }
  }, [playerDeck, computerDeck, pile, gamePhase, score, onGameOver])

  const slapBgColor =
    slapResult === 'correct' ? 'rgba(16,185,129,0.3)' :
    slapResult === 'wrong' ? 'rgba(239,68,68,0.3)' :
    isJackOnTop(pile) ? 'rgba(251,191,36,0.15)' :
    'rgba(15,15,42,0.8)'

  const slapBorderColor =
    slapResult === 'correct' ? '#10b981' :
    slapResult === 'wrong' ? '#ef4444' :
    isJackOnTop(pile) ? '#fbbf24' :
    'rgba(139,92,246,0.3)'

  if (gamePhase === 'start') return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-sm mx-auto">
      <div className="text-5xl">👋</div>
      <h2 className="text-2xl font-orbitron text-neon-purple">SLAP JACK</h2>
      <p className="text-space-muted text-sm text-center">
        Flip cards to the center. When a Jack appears - SLAP IT FIRST to win the pile!
      </p>
      <div className="text-xs text-space-muted text-center space-y-1">
        <p>Desktop: Press Space to slap</p>
        <p>Mobile: Tap the center pile</p>
        <p>Wrong slap = lose 3 cards</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
          const colors = { easy: '#10b981', medium: '#8b5cf6', hard: '#ef4444' }
          const labels = { easy: 'Easy (1200ms react)', medium: 'Medium (700ms react)', hard: 'Hard (300ms react)' }
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
      <button onClick={startGame} className="btn-primary w-full py-3">Deal Cards</button>
    </div>
  )

  if (gamePhase === 'gameover') return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-sm mx-auto">
      <div className="text-4xl">
        {playerDeck.length > computerDeck.length ? '🏆' : '😢'}
      </div>
      <h2 className="text-2xl font-orbitron text-neon-purple">Game Over!</h2>
      <p className="text-center text-sm text-space-muted">{message}</p>
      <div className="flex gap-6 text-center">
        <div>
          <div className="text-2xl font-orbitron text-neon-yellow">{score}</div>
          <div className="text-xs text-space-muted">Cards Won</div>
        </div>
        <div>
          <div className="text-2xl font-orbitron text-neon-green">{roundsWon}</div>
          <div className="text-xs text-space-muted">Jacks Slapped</div>
        </div>
      </div>
      <button onClick={() => { setGamePhase('start'); setMessage('') }} className="btn-primary px-8 py-3">
        Play Again
      </button>
    </div>
  )

  const jackOnTop = isJackOnTop(pile)

  return (
    <div className="flex flex-col items-center gap-4 p-4 max-w-sm mx-auto w-full">
      {/* Stats */}
      <div className="flex justify-between w-full px-2">
        <div className="font-orbitron text-xs text-space-muted">
          You: <span className="text-neon-purple font-bold">{playerDeck.length}</span> cards
        </div>
        <div className="font-orbitron text-xs text-neon-yellow">
          Score: {score}
        </div>
        <div className="font-orbitron text-xs text-space-muted">
          CPU: <span className="text-neon-red font-bold">{computerDeck.length}</span> cards
        </div>
      </div>

      {/* Computer deck area */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-xs text-space-muted font-orbitron">Computer</div>
        <div className="relative flex items-center justify-center" style={{ width: '5rem', height: '7rem' }}>
          {computerDeck.length > 0 ? (
            <CardDisplay faceDown />
          ) : (
            <div className="w-20 h-28 rounded-xl border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#94a3b8', fontSize: '0.75rem' }}>
              Empty
            </div>
          )}
        </div>
        <div className="text-xs text-space-muted">{computerDeck.length} cards</div>
      </div>

      {/* Center pile - tap to slap */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleSlap}
          className="relative flex items-center justify-center transition-all active:scale-95"
          style={{
            width: '7rem',
            height: '9rem',
            background: slapBgColor,
            border: `2px solid ${slapBorderColor}`,
            borderRadius: '1rem',
            cursor: 'pointer',
            boxShadow: jackOnTop ? '0 0 24px rgba(251,191,36,0.5)' : '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {pile.length > 0 ? (
            <div className="relative" style={{ width: '5rem', height: '7rem' }}>
              {pile.slice(0, Math.min(5, pile.length)).map((card, i) => (
                <PileCard key={card.id} card={card} index={pile.length - 1 - i} />
              ))}
            </div>
          ) : (
            <div className="text-space-muted text-xs text-center px-2">
              Pile empty
            </div>
          )}
          {jackOnTop && (
            <div
              className="absolute inset-0 rounded-2xl flex items-center justify-center text-xs font-orbitron font-bold"
              style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)' }}
            >
              <span className="mt-20">SLAP!</span>
            </div>
          )}
          {slapResult && (
            <div
              className="absolute inset-0 rounded-2xl flex items-center justify-center text-lg font-orbitron font-bold"
              style={{ color: slapResult === 'correct' ? '#10b981' : '#ef4444' }}
            >
              {slapResult === 'correct' ? 'YES!' : 'NO!'}
            </div>
          )}
        </button>
        <div className="text-xs text-space-muted">{pile.length} cards in pile</div>
      </div>

      {/* Message */}
      <div
        className="text-center text-xs font-orbitron px-3 py-2 rounded-xl w-full"
        style={{
          background: jackOnTop ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.2)',
          color: jackOnTop ? '#fbbf24' : '#94a3b8',
        }}
      >
        {message || (isPlayerTurn ? 'Your turn - flip a card!' : "Computer's turn...")}
      </div>

      {/* Player deck + flip button */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs text-space-muted">{playerDeck.length} cards</div>
        <div className="relative" style={{ width: '5rem', height: '7rem' }}>
          {playerDeck.length > 0 ? (
            <CardDisplay faceDown />
          ) : (
            <div className="w-20 h-28 rounded-xl border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#94a3b8', fontSize: '0.75rem' }}>
              Empty
            </div>
          )}
        </div>
        <div className="text-xs text-space-muted font-orbitron">You</div>
        <button
          onClick={() => isPlayerTurn && flipCard(true)}
          disabled={!isPlayerTurn || playerDeck.length === 0}
          className="btn-primary px-6 py-2 text-sm disabled:opacity-40"
        >
          Flip Card
        </button>
      </div>

      {/* Controls hint */}
      <div className="text-xs text-space-muted text-center">
        Space / Tap pile = Slap | Flip Card = your turn
      </div>
    </div>
  )
}
