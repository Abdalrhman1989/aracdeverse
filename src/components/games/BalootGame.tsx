"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound';
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
type PlayerId = "You" | "AI_Partner" | "AI_Left" | "AI_Right";
type Team = "A" | "B";
type BidType = "pass" | "Sun" | "♠" | "♥" | "♦" | "♣";
type Phase = "dealing" | "bidding" | "playing" | "roundOver" | "gameOver";

interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

interface BidEntry {
  player: PlayerId;
  bid: BidType;
}

interface TrickCard {
  player: PlayerId;
  card: Card;
}

interface GameState {
  phase: Phase;
  deck: Card[];
  hands: Record<PlayerId, Card[]>;
  currentTrick: TrickCard[];
  tricksWon: Record<PlayerId, Card[][]>;
  bids: BidEntry[];
  contract: { team: Team; type: BidType; value: number } | null;
  trumpSuit: Suit | null;
  isSun: boolean;
  currentPlayer: PlayerId;
  dealer: PlayerId;
  scores: Record<Team, number>;
  roundScores: Record<Team, number>;
  message: string;
  selectedCard: Card | null;
  lastTrickWinner: PlayerId | null;
  animatingCard: string | null;
  showBidPanel: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
const PLAYERS: PlayerId[] = ["You", "AI_Partner", "AI_Left", "AI_Right"];
const TEAM_A: PlayerId[] = ["You", "AI_Partner"];
const TEAM_B: PlayerId[] = ["AI_Left", "AI_Right"];

const PLAYER_TEAM: Record<PlayerId, Team> = {
  You: "A",
  AI_Partner: "A",
  AI_Left: "B",
  AI_Right: "B",
};

const PLAYER_POSITIONS: Record<PlayerId, string> = {
  You: "bottom",
  AI_Partner: "top",
  AI_Left: "left",
  AI_Right: "right",
};

const SUIT_COLORS: Record<Suit, string> = {
  "♠": "#1a1a2e",
  "♥": "#e63946",
  "♦": "#e63946",
  "♣": "#1a1a2e",
};

function cardValue(card: Card, trumpSuit: Suit | null, isSun: boolean): number {
  const isTrump = !isSun && trumpSuit && card.suit === trumpSuit;
  if (isTrump) {
    const vals: Record<Rank, number> = {
      J: 11,
      "9": 9,
      A: 11,
      "10": 10,
      K: 4,
      Q: 3,
      "8": 0,
      "7": 0,
    };
    return vals[card.rank];
  } else {
    const vals: Record<Rank, number> = {
      A: 11,
      "10": 10,
      K: 4,
      Q: 3,
      J: 2,
      "9": 0,
      "8": 0,
      "7": 0,
    };
    return vals[card.rank];
  }
}

function trumpRank(rank: Rank): number {
  const order: Record<Rank, number> = {
    J: 8,
    "9": 7,
    A: 6,
    "10": 5,
    K: 4,
    Q: 3,
    "8": 2,
    "7": 1,
  };
  return order[rank];
}

function normalRank(rank: Rank): number {
  const order: Record<Rank, number> = {
    A: 8,
    "10": 7,
    K: 6,
    Q: 5,
    J: 4,
    "9": 3,
    "8": 2,
    "7": 1,
  };
  return order[rank];
}

function determineTrickWinner(
  trick: TrickCard[],
  trumpSuit: Suit | null,
  isSun: boolean
): PlayerId {
  const ledSuit = trick[0].card.suit;
  let winner = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const tc = trick[i];
    const wCard = winner.card;
    const cCard = tc.card;

    if (!isSun && trumpSuit) {
      const wIsTrump = wCard.suit === trumpSuit;
      const cIsTrump = cCard.suit === trumpSuit;
      if (cIsTrump && !wIsTrump) {
        winner = tc;
      } else if (cIsTrump && wIsTrump) {
        if (trumpRank(cCard.rank) > trumpRank(wCard.rank)) winner = tc;
      } else if (!cIsTrump && cCard.suit === ledSuit) {
        if (!wIsTrump && normalRank(cCard.rank) > normalRank(wCard.rank))
          winner = tc;
      }
    } else {
      // Sun or no trump
      if (cCard.suit === ledSuit && normalRank(cCard.rank) > normalRank(wCard.rank)) {
        winner = tc;
      }
    }
  }
  return winner.player;
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPlayer(current: PlayerId): PlayerId {
  const idx = PLAYERS.indexOf(current);
  return PLAYERS[(idx + 1) % 4];
}

function calcRoundPoints(
  tricksWon: Record<PlayerId, Card[][]>,
  trumpSuit: Suit | null,
  isSun: boolean,
  lastTrickWinner: PlayerId | null
): Record<Team, number> {
  const pts: Record<Team, number> = { A: 0, B: 0 };
  for (const player of PLAYERS) {
    const team = PLAYER_TEAM[player];
    for (const trick of tricksWon[player]) {
      for (const card of trick) {
        pts[team] += cardValue(card, trumpSuit, isSun);
      }
    }
  }
  // Akhira: +10 for last trick winner
  if (lastTrickWinner) {
    pts[PLAYER_TEAM[lastTrickWinner]] += 10;
  }
  return pts;
}

// ─── AI Logic ─────────────────────────────────────────────────────────────────
function aiBid(
  player: PlayerId,
  hand: Card[],
  bids: BidEntry[]
): BidType {
  // Count trump-worthy cards
  const suitCounts: Record<Suit, number> = { "♠": 0, "♥": 0, "♦": 0, "♣": 0 };
  let hasJ: Record<Suit, boolean> = { "♠": false, "♥": false, "♦": false, "♣": false };
  let has9: Record<Suit, boolean> = { "♠": false, "♥": false, "♦": false, "♣": false };

  for (const card of hand) {
    suitCounts[card.suit]++;
    if (card.rank === "J") hasJ[card.suit] = true;
    if (card.rank === "9") has9[card.suit] = true;
  }

  // Already someone bid non-pass?
  const nonPass = bids.filter((b) => b.bid !== "pass");
  if (nonPass.length > 0 && PLAYER_TEAM[player] === PLAYER_TEAM[nonPass[0].player]) {
    return "pass"; // partner already bid
  }

  let bestSuit: Suit | null = null;
  let bestScore = 0;
  for (const suit of SUITS) {
    let score = suitCounts[suit];
    if (hasJ[suit]) score += 3;
    if (has9[suit]) score += 2;
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }

  if (bestScore >= 5 && bestSuit) return bestSuit;
  if (bestScore >= 3) return "Sun";
  return "pass";
}

function aiPlayCard(
  player: PlayerId,
  hand: Card[],
  currentTrick: TrickCard[],
  trumpSuit: Suit | null,
  isSun: boolean
): Card {
  const ledSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  // Must follow suit
  if (ledSuit) {
    const suitCards = hand.filter((c) => c.suit === ledSuit);
    if (suitCards.length > 0) {
      // Try to win
      const trickWinnerSoFar = determineTrickWinner(currentTrick, trumpSuit, isSun);
      const winnerTeam = PLAYER_TEAM[trickWinnerSoFar];
      const myTeam = PLAYER_TEAM[player];
      if (winnerTeam !== myTeam) {
        // Try to beat highest
        const sorted = [...suitCards].sort((a, b) => {
          if (!isSun && trumpSuit && a.suit === trumpSuit)
            return trumpRank(b.rank) - trumpRank(a.rank);
          return normalRank(b.rank) - normalRank(a.rank);
        });
        return sorted[0];
      } else {
        // Partner winning, play low
        const sorted = [...suitCards].sort((a, b) => normalRank(a.rank) - normalRank(b.rank));
        return sorted[0];
      }
    }
  }

  // Can play anything
  if (!isSun && trumpSuit) {
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);
    if (trumpCards.length > 0 && currentTrick.length > 0) {
      const trickWinner = determineTrickWinner(currentTrick, trumpSuit, isSun);
      if (PLAYER_TEAM[trickWinner] !== PLAYER_TEAM[player]) {
        const sorted = [...trumpCards].sort((a, b) => trumpRank(b.rank) - trumpRank(a.rank));
        return sorted[0];
      }
    }
  }

  // Play lowest value card
  const sorted = [...hand].sort(
    (a, b) => cardValue(a, trumpSuit, isSun) - cardValue(b, trumpSuit, isSun)
  );
  return sorted[0];
}

// ─── Initial State ────────────────────────────────────────────────────────────
function createInitialState(): GameState {
  return {
    phase: "dealing",
    deck: [],
    hands: { You: [], AI_Partner: [], AI_Left: [], AI_Right: [] },
    currentTrick: [],
    tricksWon: { You: [], AI_Partner: [], AI_Left: [], AI_Right: [] },
    bids: [],
    contract: null,
    trumpSuit: null,
    isSun: false,
    currentPlayer: "You",
    dealer: "AI_Right",
    scores: { A: 0, B: 0 },
    roundScores: { A: 0, B: 0 },
    message: "Dealing cards...",
    selectedCard: null,
    lastTrickWinner: null,
    animatingCard: null,
    showBidPanel: false,
  };
}

// ─── Difficulty ───────────────────────────────────────────────────────────────
type Diff = 'easy' | 'medium' | 'hard'
const DIFF_CONFIG: Record<Diff, { aiDelay: number; aiMistakeChance: number }> = {
  easy:   { aiDelay: 1400, aiMistakeChance: 0.35 },
  medium: { aiDelay: 900,  aiMistakeChance: 0.15 },
  hard:   { aiDelay: 500,  aiMistakeChance: 0    },
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BalootGame() {
  const [diff, setDiff] = useState<Diff | null>(null)
  const [gs, setGs] = useState<GameState>(createInitialState());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(fn, ms);
  }, []);

  // Deal cards
  const dealCards = useCallback(() => {
    const deck = shuffle(buildDeck());
    const hands: Record<PlayerId, Card[]> = {
      You: deck.slice(0, 8),
      AI_Left: deck.slice(8, 16),
      AI_Partner: deck.slice(16, 24),
      AI_Right: deck.slice(24, 32),
    };
    const firstBidder = nextPlayer("AI_Right"); // after dealer
    setGs((prev) => ({
      ...prev,
      phase: "bidding",
      deck,
      hands,
      currentTrick: [],
      tricksWon: { You: [], AI_Partner: [], AI_Left: [], AI_Right: [] },
      bids: [],
      contract: null,
      trumpSuit: null,
      isSun: false,
      currentPlayer: firstBidder,
      selectedCard: null,
      lastTrickWinner: null,
      message: `Bidding — ${firstBidder}'s turn`,
      showBidPanel: firstBidder === "You",
    }));
  }, []);

  useEffect(() => {
    safeTimeout(dealCards, 600);
  }, []);

  // AI bidding
  useEffect(() => {
    if (gs.phase !== "bidding" || gs.currentPlayer === "You") return;
    safeTimeout(() => {
      setGs((prev) => {
        const player = prev.currentPlayer;
        const bid = aiBid(player, prev.hands[player], prev.bids);
        const newBids = [...prev.bids, { player, bid }];

        // Check if bidding is done
        const nonPassBids = newBids.filter((b) => b.bid !== "pass");
        const allPassed = newBids.length === 4 && nonPassBids.length === 0;
        const bidMade = newBids.length >= 2 && nonPassBids.length === 1;
        const afterBidder =
          newBids.length >= 2 &&
          nonPassBids.length >= 1 &&
          newBids.slice(newBids.findIndex((b) => b.bid !== "pass") + 1).length === 3;

        let nextState = { ...prev, bids: newBids };

        if (allPassed) {
          // Re-deal
          return { ...nextState, phase: "dealing" as Phase, message: "All passed! Re-dealing..." };
        }

        // Check if 3 consecutive passes after a bid
        let biddingDone = false;
        if (nonPassBids.length === 1) {
          const bidIdx = newBids.findIndex((b) => b.bid !== "pass");
          const afterBid = newBids.slice(bidIdx + 1);
          if (afterBid.length === 3 && afterBid.every((b) => b.bid === "pass")) {
            biddingDone = true;
          }
          if (newBids.length === 4 && afterBid.every((b) => b.bid === "pass")) {
            biddingDone = true;
          }
        }

        if (biddingDone && nonPassBids.length === 1) {
          const winningBid = nonPassBids[0];
          const contractTeam = PLAYER_TEAM[winningBid.player];
          const isSun = winningBid.bid === "Sun";
          const trumpSuit = isSun ? null : (winningBid.bid as Suit);
          return {
            ...nextState,
            phase: "playing" as Phase,
            contract: { team: contractTeam, type: winningBid.bid, value: 152 },
            trumpSuit,
            isSun,
            currentPlayer: nextPlayer(prev.dealer),
            message: `Contract: ${contractTeam === "A" ? "You & Partner" : "Opponents"} play ${winningBid.bid}`,
            showBidPanel: false,
          };
        }

        const next = nextPlayer(player);
        return {
          ...nextState,
          currentPlayer: next,
          message: `${next}'s turn to bid`,
          showBidPanel: next === "You",
        };
      });
    }, 900);
  }, [gs.phase, gs.currentPlayer, gs.bids]);
  // Sound: gameover via phase change
  const balootPrevPhase = React.useRef("");
  React.useEffect(() => {
    if (balootPrevPhase.current !== gs.phase) {
      if (gs.phase === "gameOver") {
        if (gs.scores.A > gs.scores.B) sfxVictory(); else sfxGameOver();
      }
      balootPrevPhase.current = gs.phase;
    }
  }, [gs.phase, gs.scores]);


  // Re-deal trigger
  useEffect(() => {
    if (gs.phase === "dealing") {
      safeTimeout(dealCards, 800);
    }
  }, [gs.phase]);

  // AI playing
  useEffect(() => {
    if (gs.phase !== "playing" || gs.currentPlayer === "You") return;
    safeTimeout(() => {
      setGs((prev) => {
        const player = prev.currentPlayer;
        const hand = prev.hands[player];
        if (hand.length === 0) return prev;
        const card = aiPlayCard(player, hand, prev.currentTrick, prev.trumpSuit, prev.isSun);
        return playCardLogic(prev, player, card);
      });
    }, 1000);
  }, [gs.phase, gs.currentPlayer, gs.currentTrick]);

  function playCardLogic(prev: GameState, player: PlayerId, card: Card): GameState {
    const newHand = prev.hands[player].filter((c) => c.id !== card.id);
    const newTrick = [...prev.currentTrick, { player, card }];
    const newHands = { ...prev.hands, [player]: newHand };

    if (newTrick.length < 4) {
      const next = nextPlayer(player);
      return {
        ...prev,
        hands: newHands,
        currentTrick: newTrick,
        currentPlayer: next,
        animatingCard: card.id,
        message: `${next === "You" ? "Your" : next + "'s"} turn`,
        showBidPanel: false,
      };
    }

    // Trick complete
    const winner = determineTrickWinner(newTrick, prev.trumpSuit, prev.isSun);
  if (winner === "You") sfxWin()
    const trickCards = newTrick.map((tc) => tc.card);
    const newTricksWon = {
      ...prev.tricksWon,
      [winner]: [...prev.tricksWon[winner], trickCards],
    };

    // Check if round over
    const totalTricks = Object.values(newTricksWon).reduce((s, t) => s + t.length, 0);
    if (totalTricks === 8) {
      // Round over
      const roundPts = calcRoundPoints(newTricksWon, prev.trumpSuit, prev.isSun, winner);
      const contract = prev.contract!;
      let newScores = { ...prev.scores };
      let msg = "";

      if (contract) {
        const contractTeam = contract.team;
        const opponentTeam: Team = contractTeam === "A" ? "B" : "A";
        if (roundPts[contractTeam] >= contract.value) {
          newScores[contractTeam] += roundPts[contractTeam];
          msg = `${contractTeam === "A" ? "Your team" : "Opponents"} made contract! +${roundPts[contractTeam]}`;
        } else {
          newScores[opponentTeam] += roundPts[contractTeam];
          msg = `${contractTeam === "A" ? "Your team" : "Opponents"} failed contract! Opponents get +${roundPts[contractTeam]}`;
        }
        newScores[opponentTeam] += roundPts[opponentTeam];
      }

      const gameOver = newScores.A >= 152 || newScores.B >= 152;
      return {
        ...prev,
        hands: newHands,
        currentTrick: [],
        tricksWon: newTricksWon,
        lastTrickWinner: winner,
        roundScores: roundPts,
        scores: newScores,
        phase: gameOver ? "gameOver" : "roundOver",
        message: msg,
        showBidPanel: false,
      };
    }

    return {
      ...prev,
      hands: newHands,
      currentTrick: [],
      tricksWon: newTricksWon,
      lastTrickWinner: winner,
      currentPlayer: winner,
      animatingCard: null,
      message: `${winner === "You" ? "You" : winner} won the trick! ${winner === "You" ? "Your" : winner + "'s"} turn`,
      showBidPanel: false,
    };
  }

  function handleCardClick(card: Card) {
    if (gs.phase !== "playing" || gs.currentPlayer !== "You") return;
    const ledSuit = gs.currentTrick.length > 0 ? gs.currentTrick[0].card.suit : null;
    if (ledSuit) {
      const hasSuit = gs.hands.You.some((c) => c.suit === ledSuit);
      if (hasSuit && card.suit !== ledSuit) {
        setGs((prev) => ({ ...prev, message: `Must follow suit: ${ledSuit}` }));
        return;
      }
    }
    sfxCardPlay()
    setGs((prev) => playCardLogic(prev, "You", card));
  }

  function handleBid(bid: BidType) {
    setGs((prev) => {
      const newBids = [...prev.bids, { player: "You" as PlayerId, bid }];
      const nonPassBids = newBids.filter((b) => b.bid !== "pass");

      // Check if 3 passes after a bid
      let biddingDone = false;
      if (nonPassBids.length === 1) {
        const bidIdx = newBids.findIndex((b) => b.bid !== "pass");
        const afterBid = newBids.slice(bidIdx + 1);
        if (afterBid.length === 3 && afterBid.every((b) => b.bid === "pass")) biddingDone = true;
        if (newBids.length === 4 && afterBid.every((b) => b.bid === "pass")) biddingDone = true;
      }

      if (biddingDone && nonPassBids.length === 1) {
        const winningBid = nonPassBids[0];
        const contractTeam = PLAYER_TEAM[winningBid.player];
        const isSun = winningBid.bid === "Sun";
        const trumpSuit = isSun ? null : (winningBid.bid as Suit);
        return {
          ...prev,
          bids: newBids,
          phase: "playing" as Phase,
          contract: { team: contractTeam, type: winningBid.bid, value: 152 },
          trumpSuit,
          isSun,
          currentPlayer: nextPlayer(prev.dealer),
          message: `Contract: ${contractTeam === "A" ? "You & Partner" : "Opponents"} play ${winningBid.bid}`,
          showBidPanel: false,
        };
      }

      const next = nextPlayer("You");
      return {
        ...prev,
        bids: newBids,
        currentPlayer: next,
        message: `${next}'s turn to bid`,
        showBidPanel: false,
      };
    });
  }

  function startNewRound() {
    setGs((prev) => ({ ...prev, phase: "dealing", message: "Starting new round..." }));
  }

  function resetGame() {
    setGs({ ...createInitialState(), scores: { A: 0, B: 0 } });
    safeTimeout(dealCards, 600);
  }

  // ─── Render Helpers ──────────────────────────────────────────────────────────
  function renderCard(
    card: Card,
    onClick?: () => void,
    selected = false,
    small = false,
    faceDown = false
  ) {
    const isRed = card.suit === "♥" || card.suit === "♦";
    const isTrump = !gs.isSun && gs.trumpSuit === card.suit;
    const w = small ? "w-10 h-14" : "w-14 h-20";

    if (faceDown) {
      return (
        <div
          key={card.id}
          className={`${w} rounded-lg border-2 border-gray-600 bg-gradient-to-br from-blue-900 to-blue-700 shadow-md`}
        />
      );
    }

    return (
      <div
        key={card.id}
        onClick={onClick}
        className={`
          ${w} rounded-lg border-2 shadow-md flex flex-col items-center justify-between p-1 
          transition-all duration-200 select-none
          ${onClick ? "cursor-pointer hover:-translate-y-2 hover:shadow-xl" : "cursor-default"}
          ${selected ? "-translate-y-4 ring-2 ring-yellow-400" : ""}
          ${isTrump ? "border-yellow-400 bg-yellow-50" : "bg-white border-gray-300"}
        `}
      >
        <span className={`text-xs font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
          {card.rank}
        </span>
        <span className={`text-lg ${isRed ? "text-red-600" : "text-gray-900"}`}>{card.suit}</span>
        <span className={`text-xs font-bold rotate-180 ${isRed ? "text-red-600" : "text-gray-900"}`}>
          {card.rank}
        </span>
      </div>
    );
  }

  function renderHand(player: PlayerId, faceDown = false) {
    const hand = gs.hands[player];
    const isBottom = player === "You";
    const isHoriz = player === "AI_Partner" || player === "You";

    if (isHoriz) {
      return (
        <div className="flex gap-1 flex-wrap justify-center">
          {hand.map((card) =>
            renderCard(
              card,
              isBottom && !faceDown ? () => handleCardClick(card) : undefined,
              false,
              !isBottom,
              faceDown
            )
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 items-center">
        {hand.map((card) => renderCard(card, undefined, false, true, true))}
      </div>
    );
  }

  function renderTrickCard(tc: TrickCard) {
    const isRed = tc.card.suit === "♥" || tc.card.suit === "♦";
    const isTrump = !gs.isSun && gs.trumpSuit === tc.card.suit;
    return (
      <div key={tc.player} className="flex flex-col items-center gap-1">
        <span className="text-xs text-gray-400">{tc.player === "You" ? "You" : tc.player}</span>
        <div
          className={`w-12 h-16 rounded-lg border-2 shadow-lg flex flex-col items-center justify-between p-1
          ${isTrump ? "border-yellow-400 bg-yellow-50" : "bg-white border-gray-300"}`}
        >
          <span className={`text-xs font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
            {tc.card.rank}
          </span>
          <span className={`text-xl ${isRed ? "text-red-600" : "text-gray-900"}`}>
            {tc.card.suit}
          </span>
          <span
            className={`text-xs font-bold rotate-180 ${isRed ? "text-red-600" : "text-gray-900"}`}
          >
            {tc.card.rank}
          </span>
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────────
  // ── Difficulty selector ────────────────────────────────────────────────────
  if (!diff) return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="text-5xl mb-2">🌟</div>
        <h1 className="text-3xl font-bold text-yellow-400 mb-1">بلوت — Baloot</h1>
        <p className="text-green-300 text-sm">Saudi Arabia's Favorite Card Game</p>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
        {(['easy','medium','hard'] as Diff[]).map(d => (
          <button key={d} onClick={() => { sfxClick(); setDiff(d) }}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
            style={{ background: d==='easy'?'rgba(16,185,129,0.15)':d==='medium'?'rgba(251,191,36,0.15)':'rgba(239,68,68,0.15)', border: `2px solid ${d==='easy'?'#10b981':d==='medium'?'#fbbf24':'#ef4444'}`, color: d==='easy'?'#10b981':d==='medium'?'#fbbf24':'#ef4444' }}>
            <span className="text-2xl">{d==='easy'?'😊':d==='medium'?'🧠':'🔥'}</span>
            <span className="capitalize text-sm">{d}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 flex flex-col items-center justify-center p-4 font-sans">
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-yellow-400 tracking-wide">بلوت</h1>
          <p className="text-green-300 text-sm">Baloot</p>
        </div>

        {/* Scores */}
        <div className="flex gap-6">
          <div className="bg-black/40 rounded-xl p-3 text-center border border-green-700">
            <p className="text-green-300 text-xs font-semibold">YOU & PARTNER</p>
            <p className="text-yellow-400 text-2xl font-bold">{gs.scores.A}</p>
          </div>
          <div className="bg-black/40 rounded-xl p-3 text-center border border-red-800">
            <p className="text-red-300 text-xs font-semibold">OPPONENTS</p>
            <p className="text-red-400 text-2xl font-bold">{gs.scores.B}</p>
          </div>
        </div>

        {/* Contract & Trump */}
        <div className="bg-black/40 rounded-xl p-3 text-center border border-yellow-700 min-w-[120px]">
          {gs.contract ? (
            <>
              <p className="text-yellow-300 text-xs font-semibold">CONTRACT</p>
              <p className="text-white font-bold">
                {gs.contract.type === "Sun" ? "☀ SUN" : `Trump: ${gs.contract.type}`}
              </p>
              <p className="text-gray-400 text-xs">{gs.contract.team === "A" ? "Your Team" : "Opponents"}</p>
            </>
          ) : (
            <p className="text-gray-400 text-xs">No contract yet</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="w-full max-w-4xl bg-green-800/50 rounded-3xl border-2 border-green-700 p-4 shadow-2xl relative">
        {/* Top player (AI_Partner) */}
        <div className="flex flex-col items-center mb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white">
              P
            </div>
            <span className="text-green-200 text-sm font-semibold">Partner</span>
            <span className="text-gray-400 text-xs">({gs.hands.AI_Partner.length} cards)</span>
            {gs.currentPlayer === "AI_Partner" && (
              <span className="text-yellow-400 text-xs animate-pulse">● PLAYING</span>
            )}
          </div>
          {renderHand("AI_Partner", true)}
        </div>

        {/* Middle row: left, trick area, right */}
        <div className="flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center text-xs font-bold text-white">
                L
              </div>
              <div>
                <p className="text-red-300 text-xs font-semibold">AI Left</p>
                <p className="text-gray-400 text-xs">{gs.hands.AI_Left.length} cards</p>
                {gs.currentPlayer === "AI_Left" && (
                  <p className="text-yellow-400 text-xs animate-pulse">● PLAYING</p>
                )}
              </div>
            </div>
            {renderHand("AI_Left", true)}
          </div>

          {/* Trick area */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[160px]">
            {/* Trump indicator */}
            {gs.trumpSuit && !gs.isSun && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-yellow-400 text-xs font-semibold">TRUMP:</span>
                <span
                  className="text-2xl font-bold"
                  style={{ color: SUIT_COLORS[gs.trumpSuit] === "#e63946" ? "#e63946" : "#fff" }}
                >
                  {gs.trumpSuit}
                </span>
              </div>
            )}
            {gs.isSun && (
              <div className="mb-3">
                <span className="text-yellow-400 font-bold text-sm">☀ SUN (No Trump)</span>
              </div>
            )}

            {/* Current trick */}
            {gs.currentTrick.length > 0 ? (
              <div className="flex gap-3 flex-wrap justify-center">
                {gs.currentTrick.map(renderTrickCard)}
              </div>
            ) : (
              <div className="text-green-600 text-sm italic">
                {gs.phase === "bidding" ? "Bidding in progress..." : "Play a card"}
              </div>
            )}

            {/* Message */}
            <div className="mt-3 bg-black/30 rounded-lg px-4 py-2 max-w-sm text-center">
              <p className="text-green-200 text-sm">{gs.message}</p>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center text-xs font-bold text-white">
                R
              </div>
              <div>
                <p className="text-red-300 text-xs font-semibold">AI Right</p>
                <p className="text-gray-400 text-xs">{gs.hands.AI_Right.length} cards</p>
                {gs.currentPlayer === "AI_Right" && (
                  <p className="text-yellow-400 text-xs animate-pulse">● PLAYING</p>
                )}
              </div>
            </div>
            {renderHand("AI_Right", true)}
          </div>
        </div>

        {/* Bottom player (You) */}
        <div className="flex flex-col items-center mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              Y
            </div>
            <span className="text-blue-200 text-sm font-semibold">You</span>
            <span className="text-gray-400 text-xs">({gs.hands.You.length} cards)</span>
            {gs.currentPlayer === "You" && gs.phase === "playing" && (
              <span className="text-yellow-400 text-xs animate-pulse font-bold">● YOUR TURN</span>
            )}
          </div>
          {renderHand("You", false)}
        </div>
      </div>

      {/* Bidding Panel */}
      {gs.phase === "bidding" && gs.currentPlayer === "You" && (
        <div className="mt-4 bg-black/70 rounded-2xl p-5 border border-yellow-600 w-full max-w-md">
          <h3 className="text-yellow-400 font-bold text-center mb-3 text-lg">Your Bid</h3>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => handleBid("pass")}
              className="px-4 py-2 rounded-xl bg-gray-700 text-gray-200 font-semibold hover:bg-gray-600 transition-colors border border-gray-500"
            >
              Pass
            </button>
            <button
              onClick={() => handleBid("Sun")}
              className="px-4 py-2 rounded-xl bg-yellow-700 text-yellow-200 font-semibold hover:bg-yellow-600 transition-colors border border-yellow-500"
            >
              ☀ Sun
            </button>
            {SUITS.map((suit) => (
              <button
                key={suit}
                onClick={() => handleBid(suit)}
                className="px-4 py-2 rounded-xl font-bold text-xl hover:scale-110 transition-all border-2"
                style={{
                  backgroundColor:
                    suit === "♥" || suit === "♦" ? "#7f1d1d" : "#1e3a5f",
                  color: suit === "♥" || suit === "♦" ? "#fca5a5" : "#93c5fd",
                  borderColor: suit === "♥" || suit === "♦" ? "#ef4444" : "#3b82f6",
                }}
              >
                {suit}
              </button>
            ))}
          </div>
          <p className="text-gray-400 text-xs text-center mt-2">
            Bidding order:{" "}
            {gs.bids.map((b) => `${b.player}: ${b.bid}`).join(" → ")}
          </p>
        </div>
      )}

      {/* Bid history strip */}
      {gs.bids.length > 0 && gs.phase === "bidding" && gs.currentPlayer !== "You" && (
        <div className="mt-3 flex gap-2 flex-wrap justify-center">
          {gs.bids.map((b, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                b.bid === "pass"
                  ? "bg-gray-700 text-gray-300"
                  : "bg-yellow-700 text-yellow-200"
              }`}
            >
              {b.player}: {b.bid}
            </span>
          ))}
          <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-900 text-blue-200 animate-pulse">
            {gs.currentPlayer} bidding...
          </span>
        </div>
      )}

      {/* Round Over */}
      {gs.phase === "roundOver" && (
        <div className="mt-4 bg-black/80 rounded-2xl p-6 border border-yellow-600 w-full max-w-md text-center">
          <h3 className="text-yellow-400 font-bold text-xl mb-3">Round Over</h3>
          <div className="flex justify-center gap-8 mb-4">
            <div>
              <p className="text-green-300 text-sm">Your Team</p>
              <p className="text-white text-2xl font-bold">{gs.roundScores.A}</p>
              <p className="text-gray-400 text-xs">Total: {gs.scores.A}</p>
            </div>
            <div>
              <p className="text-red-300 text-sm">Opponents</p>
              <p className="text-white text-2xl font-bold">{gs.roundScores.B}</p>
              <p className="text-gray-400 text-xs">Total: {gs.scores.B}</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm mb-4">{gs.message}</p>
          <button
            onClick={startNewRound}
            className="px-6 py-3 bg-green-700 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"
          >
            Next Round
          </button>
        </div>
      )}

      {/* Game Over */}
      {gs.phase === "gameOver" && (
        <div className="mt-4 bg-black/90 rounded-2xl p-8 border-2 border-yellow-500 w-full max-w-md text-center">
          <h2 className="text-3xl font-bold text-yellow-400 mb-4">
            {gs.scores.A >= 152 ? "🏆 Your Team Wins!" : "Game Over"}
          </h2>
          <div className="flex justify-center gap-8 mb-6">
            <div>
              <p className="text-green-300">Your Team</p>
              <p className="text-white text-3xl font-bold">{gs.scores.A}</p>
            </div>
            <div>
              <p className="text-red-300">Opponents</p>
              <p className="text-white text-3xl font-bold">{gs.scores.B}</p>
            </div>
          </div>
          <button
            onClick={resetGame}
            className="px-8 py-3 bg-yellow-600 text-black font-bold rounded-xl hover:bg-yellow-500 transition-colors text-lg"
          >
            New Game
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 text-gray-500 text-xs text-center max-w-xl">
        Baloot: Bid Sun (no trump) or a suit. Make your contract (152 pts) to score. Last trick = 10 bonus.
        First team to 152 total wins.
      </div>
    </div>
  );
}
