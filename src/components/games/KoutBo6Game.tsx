"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound';
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
type PlayerId = "You" | "AI_1" | "AI_2" | "AI_3";
type Phase = "dealing" | "playing" | "trickEnd" | "roundEnd" | "gameOver";
type Difficulty = "easy" | "medium" | "hard";

interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

interface TrickCard {
  player: PlayerId;
  card: Card;
}

interface GameState {
  phase: Phase;
  hands: Record<PlayerId, Card[]>;
  currentTrick: TrickCard[];
  tricksWon: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  roundNumber: number;
  currentPlayer: PlayerId;
  message: string;
  lastTrickWinner: PlayerId | null;
  ledSuit: Suit | null;
  koutPlayed: boolean;
  invalidPlay: string;
  difficulty: Difficulty;
  roundHistory: Array<Record<PlayerId, number>>;
  showInstructions: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYERS: PlayerId[] = ["You", "AI_1", "AI_2", "AI_3"];
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const KOUT_CARD = { suit: "♥" as Suit, rank: "6" as Rank };
const TOTAL_ROUNDS = 4;
const TOTAL_TRICKS = 13;

const RANK_ORDER: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

const PLAYER_LABELS: Record<PlayerId, string> = {
  You: "You",
  AI_1: "Khalid",
  AI_2: "Nora",
  AI_3: "Faisal",
};

const PLAYER_COLORS: Record<PlayerId, string> = {
  You: "bg-blue-700 border-blue-400",
  AI_1: "bg-purple-800 border-purple-500",
  AI_2: "bg-pink-800 border-pink-500",
  AI_3: "bg-orange-800 border-orange-500",
};

const SUIT_RED: Record<Suit, boolean> = { "♠": false, "♥": true, "♦": true, "♣": false };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildFullDeck(): Card[] {
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
  return PLAYERS[(PLAYERS.indexOf(current) + 1) % 4];
}

function isKout(card: Card): boolean {
  return card.suit === "♥" && card.rank === "6";
}

function determineTrickWinner(trick: TrickCard[]): PlayerId {
  if (trick.length === 0) return "You";

  // Check if Kout (6♥) is in the trick
  const koutPlay = trick.find((tc) => isKout(tc.card));
  if (koutPlay) return koutPlay.player;

  const ledSuit = trick[0].card.suit;
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const tc = trick[i];
    if (tc.card.suit === ledSuit && RANK_ORDER[tc.card.rank] > RANK_ORDER[winner.card.rank]) {
      winner = tc;
    }
  }
  return winner.player;
}

function canPlayCard(card: Card, hand: Card[], ledSuit: Suit | null): boolean {
  if (!ledSuit) return true; // leading
  if (card.suit === ledSuit) return true;
  const hasSuit = hand.some((c) => c.suit === ledSuit);
  if (!hasSuit) return true; // can play anything
  // Special: Kout can always be played
  if (isKout(card)) return true;
  return false;
}

// ─── AI Logic ─────────────────────────────────────────────────────────────────
function aiChooseCard(
  player: PlayerId,
  hand: Card[],
  trick: TrickCard[],
  difficulty: Difficulty,
  tricksWon: Record<PlayerId, number>
): Card {
  const ledSuit = trick.length > 0 ? trick[0].card.suit : null;
  const valid = hand.filter((c) => canPlayCard(c, hand, ledSuit));

  if (valid.length === 0) return hand[0];

  if (difficulty === "easy") {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // Medium / Hard
  // If we can win with Kout
  const koutCard = valid.find(isKout);

  if (difficulty === "hard") {
    // Find who is leading (most tricks)
    const maxTricks = Math.max(...PLAYERS.map((p) => tricksWon[p]));
    const leaders = PLAYERS.filter((p) => tricksWon[p] === maxTricks && p !== player);

    // Play Kout aggressively if leader is opponent
    if (koutCard && leaders.length > 0) return koutCard;

    // If we have exactly 5 tricks (approaching kout penalty), throw low cards
    const myTricks = tricksWon[player];
    if (myTricks === 5 && trick.length === 0) {
      const sorted = [...valid].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
      return sorted[0];
    }
  }

  // Try to win the trick
  if (ledSuit) {
    const suitCards = valid.filter((c) => c.suit === ledSuit);
    if (suitCards.length > 0) {
      const currentWinner = determineTrickWinner(trick);
      const winnerIsOpponent = currentWinner !== player;

      if (winnerIsOpponent) {
        // Try to beat with highest
        const sorted = suitCards.sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
        return sorted[0];
      } else {
        // Already winning, play low
        const sorted = suitCards.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
        return sorted[0];
      }
    }
    // Can't follow suit - play lowest
    const sorted = [...valid].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
    return sorted[0];
  }

  // Leading - play medium card
  const sorted = [...valid].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid];
}

// ─── Initial State ────────────────────────────────────────────────────────────
function createInitialState(difficulty: Difficulty = "medium"): GameState {
  return {
    phase: "dealing",
    hands: { You: [], AI_1: [], AI_2: [], AI_3: [] },
    currentTrick: [],
    tricksWon: { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 },
    scores: { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 },
    roundNumber: 1,
    currentPlayer: "You",
    message: "Dealing cards...",
    lastTrickWinner: null,
    ledSuit: null,
    koutPlayed: false,
    invalidPlay: "",
    difficulty,
    roundHistory: [],
    showInstructions: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function KoutBo6Game() {
  const [gs, setGs] = useState<GameState>(createInitialState("medium"));
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const safe = (fn: () => void, ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, ms);
  };

  const dealRound = useCallback((prevScores: Record<PlayerId, number>, round: number, difficulty: Difficulty, history: Array<Record<PlayerId, number>>) => {
    const deck = shuffle(buildFullDeck());
    const hands: Record<PlayerId, Card[]> = {
      You: deck.slice(0, 13),
      AI_1: deck.slice(13, 26),
      AI_2: deck.slice(26, 39),
      AI_3: deck.slice(39, 52),
    };
    setGs((prev) => ({
      ...prev,
      phase: "playing",
      hands,
      currentTrick: [],
      tricksWon: { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 },
      scores: prevScores,
      roundNumber: round,
      currentPlayer: "You",
      message: "Round " + round + " — Your turn to lead",
      lastTrickWinner: null,
      ledSuit: null,
      koutPlayed: false,
      invalidPlay: "",
      roundHistory: history,
    }));
  }, []);

  useEffect(() => {
    safe(() => dealRound({ You: 0, AI_1: 0, AI_2: 0, AI_3: 0 }, 1, gs.difficulty, []), 500);
  }, []);

  // AI auto-play
  useEffect(() => {
    if (gs.phase !== "playing" || gs.currentPlayer === "You") return;
    safe(() => {
      setGs((prev) => {
        if (prev.currentPlayer === "You") return prev;
        const player = prev.currentPlayer;
        const card = aiChooseCard(player, prev.hands[player], prev.currentTrick, prev.difficulty, prev.tricksWon);
        return playCardLogic(prev, player, card);
      });
    }, 750);
  }, [gs.phase, gs.currentPlayer, gs.currentTrick.length]);
  // Sound: gameover via phase change
  const koutPrevPhase = React.useRef("");
  React.useEffect(() => {
    if (koutPrevPhase.current !== gs.phase) {
      if (gs.phase === "gameOver") {
        const scores = Object.values(gs.scores) as number[];
        const maxScore = Math.max(...scores);
        if ((gs.scores.You ?? 0) >= maxScore) sfxVictory(); else sfxGameOver();
      }
      koutPrevPhase.current = gs.phase;
    }
  }, [gs.phase, gs.scores]);


  function playCardLogic(prev: GameState, player: PlayerId, card: Card): GameState {
    const newHand = prev.hands[player].filter((c) => c.id !== card.id);
    const newTrick: TrickCard[] = [...prev.currentTrick, { player, card }];
    const newHands = { ...prev.hands, [player]: newHand };

    const ledSuit = newTrick.length === 1 ? card.suit : prev.ledSuit;
    const koutPlayed = prev.koutPlayed || isKout(card);

    if (newTrick.length < 4) {
      const next = nextPlayer(player);
      return {
        ...prev,
        hands: newHands,
        currentTrick: newTrick,
        currentPlayer: next,
        ledSuit,
        koutPlayed,
        invalidPlay: "",
        message: `${PLAYER_LABELS[next] === "You" ? "Your" : PLAYER_LABELS[next] + "'s"} turn`,
      };
    }

    // Trick complete
    const winner = determineTrickWinner(newTrick);
  if (winner === "You") sfxWin()
    const newTricksWon = { ...prev.tricksWon, [winner]: prev.tricksWon[winner] + 1 };
    const totalPlayed = Object.values(newTricksWon).reduce((s, v) => s + v, 0);

    const wonMsg = isKout(card)
      ? `KOUT! ${PLAYER_LABELS[winner]} played 6♥ and wins the trick!`
      : `${PLAYER_LABELS[winner]} wins the trick`;

    if (totalPlayed === TOTAL_TRICKS) {
      // Round over — calculate
      const roundPts: Record<PlayerId, number> = { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 };
      for (const p of PLAYERS) {
        const tricks = newTricksWon[p];
        if (tricks === 6) {
          roundPts[p] = 0; // Kout penalty
        } else if (tricks === TOTAL_TRICKS) {
          roundPts[p] = 26; // Won all = Kout Bo 6
        } else {
          roundPts[p] = tricks;
        }
      }
      const newScores = { ...prev.scores };
      for (const p of PLAYERS) newScores[p] += roundPts[p];
      const newHistory = [...prev.roundHistory, roundPts];

      const gameOver = prev.roundNumber >= TOTAL_ROUNDS;
      return {
        ...prev,
        hands: newHands,
        currentTrick: newTrick,
        tricksWon: newTricksWon,
        scores: newScores,
        lastTrickWinner: winner,
        phase: gameOver ? "gameOver" : "roundEnd",
        message: wonMsg,
        koutPlayed,
        roundHistory: newHistory,
        ledSuit: null,
      };
    }

    return {
      ...prev,
      hands: newHands,
      currentTrick: [],
      tricksWon: newTricksWon,
      lastTrickWinner: winner,
      currentPlayer: winner,
      ledSuit: null,
      koutPlayed: false,
      invalidPlay: "",
      message: wonMsg + ` (${PLAYER_LABELS[winner]} leads next)`,
    };
  }

  function handleCardClick(card: Card) {
    if (gs.phase !== "playing" || gs.currentPlayer !== "You") return;
    if (!canPlayCard(card, gs.hands.You, gs.ledSuit)) {
      setGs((prev) => ({
        ...prev,
        invalidPlay: `Must follow suit: ${prev.ledSuit}`,
      }));
      safe(() => setGs((p) => ({ ...p, invalidPlay: "" })), 1500);
      return;
    }
    sfxCardPlay()
  setGs((prev) => playCardLogic(prev, "You", card));
  }

  function nextRound() {
    dealRound(gs.scores, gs.roundNumber + 1, gs.difficulty, gs.roundHistory);
  }

  function resetGame(diff?: Difficulty) {
    const d = diff || gs.difficulty;
    safe(() => dealRound({ You: 0, AI_1: 0, AI_2: 0, AI_3: 0 }, 1, d, []), 200);
  }

  // ─── Card Render ─────────────────────────────────────────────────────────────
  function renderCard(card: Card, onClick?: () => void, faceDown = false, highlight = false, small = false) {
    const isRed = SUIT_RED[card.suit];
    const isK = isKout(card);
    const sz = small ? "w-9 h-13" : "w-12 h-18";
    const w = small ? "w-9" : "w-12";
    const h = small ? "h-13" : "h-18";

    if (faceDown) {
      return (
        <div
          key={card.id}
          className={`${w} ${h} rounded-md border border-gray-600 bg-gradient-to-br from-indigo-900 to-indigo-700 shadow`}
          style={{ width: small ? 36 : 48, height: small ? 52 : 68 }}
        />
      );
    }

    return (
      <div
        key={card.id}
        onClick={onClick}
        className={`rounded-lg border-2 shadow-md flex flex-col items-center justify-between transition-all duration-150 select-none
          ${onClick ? "cursor-pointer hover:-translate-y-3 hover:shadow-xl active:scale-95" : "cursor-default"}
          ${isK ? "border-yellow-400 bg-gradient-to-b from-yellow-50 to-orange-50 ring-2 ring-yellow-400" : highlight ? "border-green-400 bg-green-50" : "bg-white border-gray-300"}
        `}
        style={{ width: small ? 36 : 52, height: small ? 52 : 74, padding: "3px" }}
      >
        <span className={`font-bold leading-none ${small ? "text-xs" : "text-sm"} ${isRed ? "text-red-600" : "text-gray-900"}`}>
          {card.rank}
        </span>
        <span className={`${small ? "text-base" : "text-xl"} ${isRed ? "text-red-600" : "text-gray-900"} ${isK ? "animate-pulse" : ""}`}>
          {card.suit}
        </span>
        <span className={`font-bold leading-none rotate-180 ${small ? "text-xs" : "text-sm"} ${isRed ? "text-red-600" : "text-gray-900"}`}>
          {card.rank}
        </span>
      </div>
    );
  }

  function renderPlayerHand(player: PlayerId, faceDown: boolean) {
    return gs.hands[player].map((card) =>
      renderCard(
        card,
        player === "You" && !faceDown ? () => handleCardClick(card) : undefined,
        faceDown,
        gs.ledSuit !== null && card.suit === gs.ledSuit && player === "You"
      )
    );
  }

  function renderPlayerInfo(player: PlayerId) {
    const isCurrent = gs.currentPlayer === player;
    return (
      <div className={`rounded-xl p-2 text-center border-2 transition-all ${isCurrent ? PLAYER_COLORS[player] + " scale-105" : "bg-gray-900 border-gray-700"}`}>
        <p className={`font-bold text-sm ${isCurrent ? "text-white" : "text-gray-300"}`}>
          {PLAYER_LABELS[player]}
        </p>
        <p className={`text-xs ${isCurrent ? "text-yellow-300" : "text-gray-500"}`}>
          Tricks: {gs.tricksWon[player]} | Score: {gs.scores[player]}
        </p>
        {gs.tricksWon[player] === 6 && gs.phase === "roundEnd" && (
          <p className="text-red-400 text-xs font-bold animate-pulse">KOUT! (0 pts)</p>
        )}
        {isCurrent && <p className="text-yellow-400 text-xs animate-pulse font-bold">PLAYING...</p>}
      </div>
    );
  }

  const winner = gs.phase === "gameOver"
    ? PLAYERS.reduce((a, b) => gs.scores[a] > gs.scores[b] ? a : b)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-3 font-sans select-none">
      {/* Title */}
      <div className="flex items-center gap-4 mb-3">
        <div>
          <h1 className="text-3xl font-bold text-yellow-400">كوت بو 6</h1>
          <p className="text-indigo-300 text-sm text-center">Kout Bo 6</p>
        </div>
        <div className="flex gap-2">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => resetGame(d)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                gs.difficulty === d
                  ? "bg-yellow-600 text-black"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <div className="bg-black/40 rounded-lg px-3 py-1 border border-indigo-700">
          <p className="text-indigo-300 text-xs">Round {gs.roundNumber}/{TOTAL_ROUNDS}</p>
        </div>
        <button
          onClick={() => setGs((p) => ({ ...p, showInstructions: !p.showInstructions }))}
          className="w-7 h-7 rounded-full bg-indigo-800 text-white text-xs font-bold hover:bg-indigo-700 border border-indigo-500"
        >
          ?
        </button>
      </div>

      {gs.showInstructions && (
        <div className="mb-3 bg-black/70 rounded-xl p-4 border border-indigo-700 max-w-lg text-xs text-gray-300">
          <p className="font-bold text-yellow-400 mb-1">How to Play Kout Bo 6</p>
          <ul className="list-disc list-inside space-y-1">
            <li>4 players, 13 cards each, no trump</li>
            <li>Follow suit if possible; highest card of led suit wins</li>
            <li>The 6♥ (KOUT) beats ALL cards when played</li>
            <li>Each trick = 1 point; win ALL 13 tricks = 26 points</li>
            <li>Win exactly 6 tricks = 0 points (KOUT penalty!)</li>
            <li>4 rounds, highest total score wins</li>
          </ul>
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex gap-2 mb-3">
        {PLAYERS.map((p) => (
          <div
            key={p}
            className={`rounded-lg px-3 py-1 text-center border ${p === "You" ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-900/50"}`}
          >
            <p className={`text-xs font-bold ${p === "You" ? "text-blue-300" : "text-gray-400"}`}>
              {PLAYER_LABELS[p]}
            </p>
            <p className={`text-xl font-bold ${p === "You" ? "text-blue-200" : "text-white"}`}>
              {gs.scores[p]}
            </p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="w-full max-w-3xl bg-green-900/40 rounded-3xl border-2 border-green-800 shadow-2xl p-4">
        {/* Top player */}
        <div className="flex flex-col items-center mb-2">
          {renderPlayerInfo("AI_2")}
          <div className="flex gap-1 mt-2 flex-wrap justify-center">
            {renderPlayerHand("AI_2", true)}
          </div>
        </div>

        {/* Middle: left, center, right */}
        <div className="flex items-start justify-between gap-2">
          {/* Left */}
          <div className="flex flex-col items-center">
            {renderPlayerInfo("AI_1")}
            <div className="flex flex-col gap-1 mt-1">
              {gs.hands.AI_1.map((card) => renderCard(card, undefined, true, false, true))}
            </div>
          </div>

          {/* Center trick area */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[180px]">
            {/* Kout indicator */}
            <div className="mb-2 flex items-center gap-2">
              <div className={`w-8 h-11 rounded-md border-2 flex flex-col items-center justify-center
                ${gs.koutPlayed ? "border-yellow-400 bg-yellow-900/50" : "border-gray-700 bg-gray-900/30"}`}
                style={{ fontSize: 18 }}>
                <span className="text-red-500 text-xs font-bold">6</span>
                <span className="text-red-500">♥</span>
              </div>
              <div className="text-xs text-gray-400">
                {gs.koutPlayed ? (
                  <span className="text-yellow-400 font-bold">KOUT active!</span>
                ) : (
                  "6♥ = beats all"
                )}
              </div>
            </div>

            {/* Current trick */}
            <div className="relative w-full flex items-center justify-center min-h-[100px]">
              {gs.currentTrick.length > 0 ? (
                <div className="flex gap-3 flex-wrap justify-center">
                  {gs.currentTrick.map((tc) => (
                    <div key={tc.player} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{PLAYER_LABELS[tc.player]}</span>
                      {renderCard(tc.card)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-green-700 text-sm italic">
                  {gs.phase === "playing" ? (gs.currentPlayer === "You" ? "Your lead" : "Waiting...") : ""}
                </div>
              )}
            </div>

            {/* Led suit indicator */}
            {gs.ledSuit && gs.phase === "playing" && (
              <div className="mt-2 flex items-center gap-1">
                <span className="text-gray-400 text-xs">Led suit:</span>
                <span
                  className="text-xl font-bold"
                  style={{ color: SUIT_RED[gs.ledSuit] ? "#ef4444" : "#e5e7eb" }}
                >
                  {gs.ledSuit}
                </span>
              </div>
            )}

            {/* Message */}
            <div className={`mt-2 rounded-lg px-4 py-2 max-w-xs text-center border
              ${gs.invalidPlay ? "bg-red-900/50 border-red-600" : "bg-black/30 border-gray-700"}`}>
              <p className={`text-sm ${gs.invalidPlay ? "text-red-300" : "text-gray-300"}`}>
                {gs.invalidPlay || gs.message}
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col items-center">
            {renderPlayerInfo("AI_3")}
            <div className="flex flex-col gap-1 mt-1">
              {gs.hands.AI_3.map((card) => renderCard(card, undefined, true, false, true))}
            </div>
          </div>
        </div>

        {/* Bottom - You */}
        <div className="flex flex-col items-center mt-2">
          <div className="flex gap-1 flex-wrap justify-center mb-2">
            {renderPlayerHand("You", false)}
          </div>
          {renderPlayerInfo("You")}
          {gs.currentPlayer === "You" && gs.phase === "playing" && gs.ledSuit && (
            <p className="text-yellow-400 text-xs mt-1 font-semibold animate-pulse">
              Follow suit {gs.ledSuit} if you have it!
            </p>
          )}
        </div>
      </div>

      {/* Tricks count */}
      <div className="mt-3 flex gap-3">
        {PLAYERS.map((p) => (
          <div key={p} className="text-center">
            <p className="text-xs text-gray-500">{PLAYER_LABELS[p]}</p>
            <div className="flex gap-0.5 justify-center mt-0.5">
              {Array.from({ length: gs.tricksWon[p] }).map((_, i) => (
                <div key={i} className={`w-2 h-3 rounded-sm ${p === "You" ? "bg-blue-500" : "bg-gray-500"}`} />
              ))}
              {Array.from({ length: Math.max(0, TOTAL_TRICKS - gs.tricksWon[p]) }).map((_, i) => (
                <div key={i} className="w-2 h-3 rounded-sm bg-gray-800 border border-gray-700" />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{gs.tricksWon[p]}/13</p>
          </div>
        ))}
      </div>

      {/* Round History */}
      {gs.roundHistory.length > 0 && (
        <div className="mt-3 bg-black/40 rounded-xl p-3 border border-gray-700 max-w-lg w-full">
          <p className="text-gray-400 text-xs font-bold text-center mb-2">Round History</p>
          <table className="w-full text-xs text-center">
            <thead>
              <tr>
                <th className="text-gray-500 pr-2">Rnd</th>
                {PLAYERS.map((p) => (
                  <th key={p} className={`${p === "You" ? "text-blue-400" : "text-gray-400"}`}>
                    {PLAYER_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gs.roundHistory.map((rh, i) => (
                <tr key={i}>
                  <td className="text-gray-500">{i + 1}</td>
                  {PLAYERS.map((p) => (
                    <td
                      key={p}
                      className={`${rh[p] === 0 ? "text-red-400 font-bold" : rh[p] === 26 ? "text-yellow-400 font-bold" : p === "You" ? "text-blue-300" : "text-gray-300"}`}
                    >
                      {rh[p] === 0 ? "KOUT" : rh[p] === 26 ? "26!" : rh[p]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Round End Modal */}
      {gs.phase === "roundEnd" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-8 border-2 border-indigo-500 max-w-md w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">Round {gs.roundNumber} Over</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLAYERS.map((p) => {
                const rh = gs.roundHistory[gs.roundHistory.length - 1];
                const pts = rh ? rh[p] : 0;
                return (
                  <div key={p} className={`rounded-xl p-3 border ${p === "You" ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-800"}`}>
                    <p className={`font-bold ${p === "You" ? "text-blue-300" : "text-gray-300"}`}>
                      {PLAYER_LABELS[p]}
                    </p>
                    <p className="text-gray-400 text-xs">Tricks: {gs.tricksWon[p]}</p>
                    <p className={`text-xl font-bold ${pts === 0 ? "text-red-400" : pts === 26 ? "text-yellow-400" : "text-white"}`}>
                      +{pts} pts
                    </p>
                    {pts === 0 && <p className="text-red-400 text-xs">KOUT penalty!</p>}
                    {pts === 26 && <p className="text-yellow-400 text-xs">All tricks!</p>}
                    <p className="text-gray-400 text-xs mt-1">Total: {gs.scores[p]}</p>
                  </div>
                );
              })}
            </div>
            <button
              onClick={nextRound}
              className="px-8 py-3 bg-indigo-700 text-white font-bold rounded-xl hover:bg-indigo-600 transition-colors text-lg"
            >
              Round {gs.roundNumber + 1}
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gs.phase === "gameOver" && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-8 border-2 border-yellow-500 max-w-md w-full text-center shadow-2xl">
            <h2 className="text-3xl font-bold text-yellow-400 mb-2">Game Over!</h2>
            <p className="text-white text-xl mb-4">
              {winner === "You" ? "You Win!" : `${PLAYER_LABELS[winner!]} Wins!`}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLAYERS.sort((a, b) => gs.scores[b] - gs.scores[a]).map((p, rank) => (
                <div
                  key={p}
                  className={`rounded-xl p-3 border ${
                    p === winner
                      ? "border-yellow-500 bg-yellow-900/30"
                      : p === "You"
                      ? "border-blue-500 bg-blue-900/20"
                      : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <p className="text-gray-400 text-xs">#{rank + 1}</p>
                  <p className={`font-bold ${p === winner ? "text-yellow-300" : p === "You" ? "text-blue-300" : "text-gray-300"}`}>
                    {PLAYER_LABELS[p]}
                  </p>
                  <p className={`text-2xl font-bold ${p === winner ? "text-yellow-400" : "text-white"}`}>
                    {gs.scores[p]}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => resetGame(d)}
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    d === "hard"
                      ? "bg-red-700 text-white hover:bg-red-600"
                      : d === "medium"
                      ? "bg-yellow-600 text-black hover:bg-yellow-500"
                      : "bg-green-700 text-white hover:bg-green-600"
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
