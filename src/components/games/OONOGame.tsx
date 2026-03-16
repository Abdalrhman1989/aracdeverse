"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound';
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type CardColor = "Red" | "Green" | "Blue" | "Yellow" | "Wild";
type CardType =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "Skip" | "Reverse" | "DrawTwo"
  | "Wild" | "WildDrawFour";
type PlayerId = "You" | "AI_1" | "AI_2" | "AI_3";
type Direction = 1 | -1;
type Phase = "playing" | "pickColor" | "roundOver" | "gameOver";
type Difficulty = "easy" | "medium" | "hard";

interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  value: number; // point value
}

interface GameState {
  phase: Phase;
  hands: Record<PlayerId, Card[]>;
  drawPile: Card[];
  discardPile: Card[];
  currentPlayer: PlayerId;
  direction: Direction;
  currentColor: CardColor; // active color (for wilds)
  pendingDrawCount: number; // stacked draw 2/4
  message: string;
  winner: PlayerId | null;
  roundWinner: PlayerId | null;
  scores: Record<PlayerId, number>;
  roundNumber: number;
  unoCallable: PlayerId | null; // who just went to 1 card
  unoCalled: boolean;
  difficulty: Difficulty;
  animatingCard: string | null;
  pickedColorFor: PlayerId | null; // who needs to pick a color
  lastPlayedCard: Card | null;
  showColorPicker: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYERS: PlayerId[] = ["You", "AI_1", "AI_2", "AI_3"];
const COLORS: CardColor[] = ["Red", "Green", "Blue", "Yellow"];

const PLAYER_LABELS: Record<PlayerId, string> = {
  You: "You",
  AI_1: "Alex",
  AI_2: "Maya",
  AI_3: "Zaid",
};

const COLOR_BG: Record<CardColor, string> = {
  Red: "bg-red-600",
  Green: "bg-green-600",
  Blue: "bg-blue-600",
  Yellow: "bg-yellow-500",
  Wild: "bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500",
};

const COLOR_BORDER: Record<CardColor, string> = {
  Red: "border-red-400",
  Green: "border-green-400",
  Blue: "border-blue-400",
  Yellow: "border-yellow-300",
  Wild: "border-purple-400",
};

const COLOR_TEXT: Record<CardColor, string> = {
  Red: "text-red-300",
  Green: "text-green-300",
  Blue: "text-blue-300",
  Yellow: "text-yellow-300",
  Wild: "text-purple-300",
};

const COLOR_HEX: Record<string, string> = {
  Red: "#dc2626",
  Green: "#16a34a",
  Blue: "#2563eb",
  Yellow: "#ca8a04",
  Wild: "#7c3aed",
};

function cardPointValue(type: CardType): number {
  if (type === "Wild" || type === "WildDrawFour") return 50;
  if (type === "Skip" || type === "Reverse" || type === "DrawTwo") return 20;
  return parseInt(type) || 0;
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;

  for (const color of COLORS) {
    // 0 once
    deck.push({ id: `${id++}`, color, type: "0", value: 0 });
    // 1-9 twice
    for (let n = 1; n <= 9; n++) {
      for (let j = 0; j < 2; j++) {
        deck.push({ id: `${id++}`, color, type: String(n) as CardType, value: n });
      }
    }
    // Skip, Reverse, DrawTwo x2
    for (const type of ["Skip", "Reverse", "DrawTwo"] as CardType[]) {
      for (let j = 0; j < 2; j++) {
        deck.push({ id: `${id++}`, color, type, value: 20 });
      }
    }
  }

  // Wild x4
  for (let j = 0; j < 4; j++) {
    deck.push({ id: `${id++}`, color: "Wild", type: "Wild", value: 50 });
  }
  // WildDrawFour x4
  for (let j = 0; j < 4; j++) {
    deck.push({ id: `${id++}`, color: "Wild", type: "WildDrawFour", value: 50 });
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

function canPlayCard(card: Card, topCard: Card, currentColor: CardColor): boolean {
  if (card.color === "Wild") return true;
  if (card.color === currentColor) return true;
  if (card.type === topCard.type) return true;
  return false;
}

function nextPlayerIndex(
  current: PlayerId,
  direction: Direction,
  skip = false
): PlayerId {
  const idx = PLAYERS.indexOf(current);
  let next = ((idx + direction + 4) % 4);
  if (skip) next = ((next + direction + 4) % 4);
  return PLAYERS[next];
}

function calcHandPoints(hand: Card[]): number {
  return hand.reduce((s, c) => s + c.value, 0);
}

// ─── AI Logic ─────────────────────────────────────────────────────────────────
function aiChooseCard(
  player: PlayerId,
  hand: Card[],
  topCard: Card,
  currentColor: CardColor,
  difficulty: Difficulty,
  opponents: Record<PlayerId, number>,
  pendingDraw: number
): Card | null {
  const valid = hand.filter((c) => canPlayCard(c, topCard, currentColor));
  if (valid.length === 0) return null;

  if (difficulty === "easy") {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // Medium / Hard: prefer action cards, save wilds
  const nonWilds = valid.filter((c) => c.color !== "Wild");
  const wilds = valid.filter((c) => c.color === "Wild");
  const draws = valid.filter((c) => c.type === "DrawTwo" || c.type === "WildDrawFour");
  const skips = valid.filter((c) => c.type === "Skip" || c.type === "Reverse");
  const numbers = valid.filter((c) => !["Skip", "Reverse", "DrawTwo", "Wild", "WildDrawFour"].includes(c.type));

  if (difficulty === "hard") {
    // Target player with fewest cards
    const nextP = nextPlayerIndex(player, 1);
    if (draws.length > 0) {
      // Prefer WildDraw4 if multiple opponents have few cards
      const wd4 = draws.find((c) => c.type === "WildDrawFour");
      if (wd4 && opponents[nextP] <= 3) return wd4;
      if (draws.length > 0) return draws[0];
    }
    if (skips.length > 0 && opponents[nextP] <= 2) return skips[0];
  }

  // Medium: play action cards, then numbers, then wilds (save them)
  if (draws.length > 0) return draws[0];
  if (skips.length > 0) return skips[0];
  if (numbers.length > 0) {
    // Play highest number to offload points
    return numbers.sort((a, b) => b.value - a.value)[0];
  }
  if (wilds.length > 0) return wilds[0];

  return valid[0];
}

function aiChooseColor(hand: Card[], difficulty: Difficulty): CardColor {
  if (difficulty === "easy") return COLORS[Math.floor(Math.random() * 4)];

  // Count colors in hand
  const counts: Record<CardColor, number> = { Red: 0, Green: 0, Blue: 0, Yellow: 0, Wild: 0 };
  for (const c of hand) {
    if (c.color !== "Wild") counts[c.color]++;
  }
  let best: CardColor = "Red";
  let bestCount = -1;
  for (const col of COLORS) {
    if (counts[col] > bestCount) {
      bestCount = counts[col];
      best = col;
    }
  }
  return best;
}

// ─── Initial State ────────────────────────────────────────────────────────────
function createInitialState(difficulty: Difficulty = "medium"): GameState {
  return {
    phase: "playing",
    hands: { You: [], AI_1: [], AI_2: [], AI_3: [] },
    drawPile: [],
    discardPile: [],
    currentPlayer: "You",
    direction: 1,
    currentColor: "Red",
    pendingDrawCount: 0,
    message: "Dealing...",
    winner: null,
    roundWinner: null,
    scores: { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 },
    roundNumber: 1,
    unoCallable: null,
    unoCalled: false,
    difficulty,
    animatingCard: null,
    pickedColorFor: null,
    lastPlayedCard: null,
    showColorPicker: false,
  };
}

function dealGame(difficulty: Difficulty, prevScores: Record<PlayerId, number>, round: number): GameState {
  let deck = shuffle(buildDeck());
  const hands: Record<PlayerId, Card[]> = { You: [], AI_1: [], AI_2: [], AI_3: [] };
  for (let i = 0; i < 7; i++) {
    for (const p of PLAYERS) {
      hands[p].push(deck.pop()!);
    }
  }

  // Top card must not be Wild
  let topCard: Card;
  do {
    topCard = deck.pop()!;
    if (topCard.color === "Wild") deck.unshift(topCard);
  } while (topCard.color === "Wild");

  return {
    phase: "playing",
    hands,
    drawPile: deck,
    discardPile: [topCard],
    currentPlayer: "You",
    direction: 1,
    currentColor: topCard.color as CardColor,
    pendingDrawCount: 0,
    message: "Your turn! Play a card or draw.",
    winner: null,
    roundWinner: null,
    scores: prevScores,
    roundNumber: round,
    unoCallable: null,
    unoCalled: false,
    difficulty,
    animatingCard: null,
    pickedColorFor: null,
    lastPlayedCard: topCard,
    showColorPicker: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OONOGame() {
  const [gs, setGs] = useState<GameState>(() => dealGame("medium", { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 }, 1));
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const safe = (fn: () => void, ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, ms);
  };

  // AI turn handler
  useEffect(() => {
    if (gs.phase !== "playing" || gs.currentPlayer === "You") return;
    if (gs.showColorPicker) return;

    safe(() => {
      setGs((prev) => {
        if (prev.currentPlayer === "You" || prev.phase !== "playing") return prev;
        return aiTurn(prev);
      });
    }, 900);
  }, [gs.phase, gs.currentPlayer, gs.showColorPicker, gs.discardPile.length]);
  // Sound effects for game phase changes
  const prevPhaseRef = React.useRef<Phase>("playing");
  React.useEffect(() => {
    if (prevPhaseRef.current !== gs.phase) {
      if (gs.phase === "gameOver") {
        if (gs.winner === "You") sfxVictory(); else sfxGameOver();
      } else if (gs.phase === "roundOver") {
        if (gs.roundWinner === "You") sfxWin(); else sfxLose();
      }
      prevPhaseRef.current = gs.phase;
    }
  }, [gs.phase, gs.winner, gs.roundWinner]);


  function drawCards(state: GameState, player: PlayerId, count: number): [GameState, Card[]] {
    let pile = [...state.drawPile];
    let discard = [...state.discardPile];

    if (pile.length < count) {
      // Reshuffle discard into draw pile (keep top card)
      const top = discard[discard.length - 1];
      const reshuffled = shuffle(discard.slice(0, -1));
      pile = [...reshuffled, ...pile];
      discard = [top];
    }

    const drawn: Card[] = [];
    for (let i = 0; i < Math.min(count, pile.length); i++) {
      drawn.push(pile.pop()!);
    }

    const newHands = {
      ...state.hands,
      [player]: [...state.hands[player], ...drawn],
    };

    return [{ ...state, drawPile: pile, discardPile: discard, hands: newHands }, drawn];
  }

  function applyCardEffect(
    state: GameState,
    player: PlayerId,
    card: Card,
    chosenColor?: CardColor
  ): GameState {
    let s = { ...state };
    const newDiscard = [...s.discardPile, card];
    const newHand = s.hands[player].filter((c) => c.id !== card.id);
    s = { ...s, discardPile: newDiscard, hands: { ...s.hands, [player]: newHand }, lastPlayedCard: card };

    // Check win condition
    if (newHand.length === 0) {
      // Calculate points from opponents
      let pts = 0;
      for (const p of PLAYERS) {
        if (p !== player) pts += calcHandPoints(s.hands[p]);
      }
      const newScores = { ...s.scores, [player]: s.scores[player] + pts };
      return {
        ...s,
        scores: newScores,
        roundWinner: player,
        phase: newScores[player] >= 500 ? "gameOver" : "roundOver",
        winner: newScores[player] >= 500 ? player : null,
        message: `${PLAYER_LABELS[player]} wins the round! +${pts} points`,
      };
    }

    // UNO detection
    const unoCallable = newHand.length === 1 ? player : null;

    // Handle card effects
    let currentColor: CardColor = card.color === "Wild" ? (chosenColor || "Red") : card.color;
    let direction = s.direction;
    let msg = "";
    let nextPl: PlayerId;

    switch (card.type) {
      case "Skip": {
        const skipped = nextPlayerIndex(player, s.direction);
        nextPl = nextPlayerIndex(player, s.direction, true);
        msg = `${PLAYER_LABELS[skipped]} is skipped! ${PLAYER_LABELS[nextPl]}'s turn`;
        break;
      }
      case "Reverse": {
        direction = (s.direction * -1) as Direction;
        // In 4-player, reverse also skips
        nextPl = nextPlayerIndex(player, direction);
        msg = `Direction reversed! ${PLAYER_LABELS[nextPl]}'s turn`;
        break;
      }
      case "DrawTwo": {
        const target = nextPlayerIndex(player, s.direction);
        let newS: GameState;
        [newS] = drawCards({ ...s, direction, hands: s.hands }, target, 2);
        nextPl = nextPlayerIndex(player, s.direction, true);
        msg = `${PLAYER_LABELS[target]} draws 2 and is skipped!`;
        return {
          ...newS,
          discardPile: newDiscard,
          currentColor,
          direction,
          currentPlayer: nextPl,
          unoCallable,
          unoCalled: false,
          message: msg,
          showColorPicker: false,
        };
      }
      case "Wild": {
        nextPl = nextPlayerIndex(player, s.direction);
        msg = `${PLAYER_LABELS[player]} changed color to ${chosenColor}!`;
        if (player === "You" && !chosenColor) {
          return { ...s, discardPile: newDiscard, hands: { ...s.hands, [player]: newHand }, showColorPicker: true, pickedColorFor: player, lastPlayedCard: card, unoCallable, message: "Pick a color!" };
        }
        break;
      }
      case "WildDrawFour": {
        const target = nextPlayerIndex(player, s.direction);
        let newS: GameState;
        [newS] = drawCards({ ...s, direction, hands: s.hands }, target, 4);
        nextPl = nextPlayerIndex(player, s.direction, true);
        msg = `${PLAYER_LABELS[target]} draws 4! Color: ${chosenColor}`;
        if (player === "You" && !chosenColor) {
          return { ...s, discardPile: newDiscard, hands: { ...s.hands, [player]: newHand }, showColorPicker: true, pickedColorFor: player, lastPlayedCard: card, unoCallable, message: "Pick a color!" };
        }
        return {
          ...newS,
          discardPile: newDiscard,
          currentColor: chosenColor || "Red",
          direction,
          currentPlayer: nextPl,
          unoCallable,
          unoCalled: false,
          message: msg,
          showColorPicker: false,
        };
      }
      default: {
        nextPl = nextPlayerIndex(player, s.direction);
        msg = `${PLAYER_LABELS[player]} played ${card.color} ${card.type}. ${PLAYER_LABELS[nextPl] === "You" ? "Your" : PLAYER_LABELS[nextPl] + "'s"} turn`;
      }
    }

    return {
      ...s,
      currentColor,
      direction,
      currentPlayer: nextPl,
      unoCallable,
      unoCalled: false,
      message: msg || `${PLAYER_LABELS[nextPl] === "You" ? "Your" : PLAYER_LABELS[nextPl] + "'s"} turn`,
      showColorPicker: false,
    };
  }

  function aiTurn(prev: GameState): GameState {
    const player = prev.currentPlayer;
    const hand = prev.hands[player];
    const topCard = prev.discardPile[prev.discardPile.length - 1];
    const opponentCounts: Record<PlayerId, number> = {
      You: prev.hands.You.length,
      AI_1: prev.hands.AI_1.length,
      AI_2: prev.hands.AI_2.length,
      AI_3: prev.hands.AI_3.length,
    };

    const card = aiChooseCard(player, hand, topCard, prev.currentColor, prev.difficulty, opponentCounts, prev.pendingDrawCount);

    if (!card) {
      // Draw a card
      const [newState, drawn] = drawCards(prev, player, 1);
      const drawnCard = drawn[0];
      let msg = `${PLAYER_LABELS[player]} draws a card`;

      if (drawnCard && canPlayCard(drawnCard, topCard, prev.currentColor)) {
        // Play the drawn card
        const afterPlay = applyCardEffect(
          newState,
          player,
          drawnCard,
          drawnCard.color === "Wild" ? aiChooseColor(newState.hands[player], prev.difficulty) : undefined
        );
        return { ...afterPlay, message: `${PLAYER_LABELS[player]} draws and plays ${drawnCard.color} ${drawnCard.type}` };
      }

      const next = nextPlayerIndex(player, prev.direction);
      return { ...newState, currentPlayer: next, message: msg };
    }

    const chosenColor = card.color === "Wild" ? aiChooseColor(hand.filter((c) => c.id !== card.id), prev.difficulty) : undefined;
    return applyCardEffect(prev, player, card, chosenColor);
  }

  function handleCardPlay(card: Card) {
    if (gs.phase !== "playing" || gs.currentPlayer !== "You") return;
    sfxCardPlay()
    if (gs.showColorPicker) return;

    const topCard = gs.discardPile[gs.discardPile.length - 1];
    if (!canPlayCard(card, topCard, gs.currentColor)) {
      setGs((prev) => ({ ...prev, message: "Cannot play that card! Match color or number." }));
      return;
    }

    if (card.color === "Wild") {
      // Show color picker
      setGs((prev) => ({
        ...prev,
        hands: { ...prev.hands, You: prev.hands.You },
        showColorPicker: true,
        pickedColorFor: "You",
        lastPlayedCard: card,
        message: "Pick a color!",
      }));
      return;
    }

    setGs((prev) => applyCardEffect(prev, "You", card));
  }

  function handleColorPick(color: CardColor) {
    setGs((prev) => {
      const card = prev.lastPlayedCard!;
      const player = prev.pickedColorFor!;
      return applyCardEffect(
        { ...prev, showColorPicker: false, pickedColorFor: null },
        player,
        card,
        color
      );
    });
  }

  function handleDraw() {
    if (gs.phase !== "playing" || gs.currentPlayer !== "You") return;
    sfxCardFlip()
    setGs((prev) => {
      const [newState, drawn] = drawCards(prev, "You", 1);
      const topCard = prev.discardPile[prev.discardPile.length - 1];
      const drawnCard = drawn[0];

      if (drawnCard && canPlayCard(drawnCard, topCard, prev.currentColor)) {
        return { ...newState, message: `You drew ${drawnCard.color} ${drawnCard.type}. You can play it!` };
      }

      const next = nextPlayerIndex("You", prev.direction);
      return { ...newState, currentPlayer: next, message: `You drew a card. ${PLAYER_LABELS[next]}'s turn` };
    });
  }

  function handleUnoCall() {
    if (!gs.unoCallable) return;
    if (gs.unoCallable === "You" && gs.hands.You.length === 1) {
      sfxUno()
      setGs((prev) => ({ ...prev, unoCalled: true, message: "UNO! You called it!" }));
    } else if (gs.unoCallable && gs.unoCallable !== "You" && !gs.unoCalled) {
      // Catch AI not calling UNO — draw 2 penalty
      setGs((prev) => {
        const [newState] = drawCards(prev, prev.unoCallable!, 2);
        return { ...newState, message: `Caught ${PLAYER_LABELS[prev.unoCallable!]}! They draw 2!`, unoCallable: null };
      });
    }
  }

  function startNewRound() {
    setGs((prev) => dealGame(prev.difficulty, prev.scores, prev.roundNumber + 1));
  }

  function resetGame(diff?: Difficulty) {
    const d = diff || gs.difficulty;
    setGs(dealGame(d, { You: 0, AI_1: 0, AI_2: 0, AI_3: 0 }, 1));
  }

  // ─── Card Rendering ───────────────────────────────────────────────────────────
  function getCardSymbol(type: CardType): string {
    switch (type) {
      case "Skip": return "⊘";
      case "Reverse": return "⇄";
      case "DrawTwo": return "+2";
      case "Wild": return "★";
      case "WildDrawFour": return "+4";
      default: return type;
    }
  }

  function renderCard(
    card: Card,
    onClick?: () => void,
    small = false,
    faceDown = false,
    highlighted = false
  ) {
    const w = small ? 32 : 56;
    const h = small ? 46 : 80;
    const isWild = card.color === "Wild";

    if (faceDown) {
      return (
        <div
          key={card.id}
          style={{ width: w, height: h, minWidth: w }}
          className="rounded-lg border-2 border-gray-600 bg-gradient-to-br from-gray-800 to-gray-700 shadow-md flex items-center justify-center"
        >
          <span className="text-gray-500 text-xs font-bold">OONO</span>
        </div>
      );
    }

    const bgStyle = isWild
      ? { background: "linear-gradient(135deg, #dc2626 25%, #ca8a04 50%, #16a34a 75%, #2563eb 100%)" }
      : { backgroundColor: COLOR_HEX[card.color] };

    const symbol = getCardSymbol(card.type);
    const isAction = ["Skip", "Reverse", "DrawTwo", "Wild", "WildDrawFour"].includes(card.type);

    return (
      <div
        key={card.id}
        onClick={onClick}
        style={{ width: w, height: h, minWidth: w, ...bgStyle }}
        className={`
          rounded-lg border-2 shadow-md flex flex-col items-center justify-between select-none transition-all duration-150
          ${onClick ? "cursor-pointer hover:-translate-y-3 hover:shadow-xl active:scale-95" : "cursor-default"}
          ${highlighted ? "ring-2 ring-white ring-offset-1 ring-offset-transparent -translate-y-2" : ""}
          ${card.color === "Wild" ? "border-white" : "border-white/30"}
        `}
      >
        <span
          className="text-white font-black leading-none"
          style={{ fontSize: small ? 10 : 14, paddingTop: 3, paddingLeft: 4, alignSelf: "flex-start" }}
        >
          {symbol}
        </span>
        <span
          className="text-white font-black drop-shadow"
          style={{ fontSize: small ? 14 : isAction ? 24 : 28 }}
        >
          {symbol}
        </span>
        <span
          className="text-white font-black leading-none rotate-180"
          style={{ fontSize: small ? 10 : 14, paddingBottom: 3, paddingRight: 4, alignSelf: "flex-end" }}
        >
          {symbol}
        </span>
      </div>
    );
  }

  const topCard = gs.discardPile[gs.discardPile.length - 1];
  const youHand = gs.hands.You;
  const validCards = topCard ? youHand.filter((c) => canPlayCard(c, topCard, gs.currentColor)) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex flex-col items-center justify-center p-3 font-sans select-none">
      {/* Header */}
      <div className="flex items-center gap-4 mb-3">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white tracking-tight">
            <span className="text-red-500">O</span>
            <span className="text-green-500">O</span>
            <span className="text-blue-500">N</span>
            <span className="text-yellow-500">O</span>
          </h1>
          <p className="text-gray-500 text-xs">UNO-Style Card Game</p>
        </div>

        {/* Difficulty */}
        <div className="flex gap-2">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => resetGame(d)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                gs.difficulty === d ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Scores */}
        <div className="flex gap-2">
          {PLAYERS.map((p) => (
            <div key={p} className={`rounded-lg px-2 py-1 text-center border ${p === "You" ? "border-white bg-white/10" : "border-gray-700 bg-gray-900/50"}`}>
              <p className="text-xs text-gray-400">{PLAYER_LABELS[p]}</p>
              <p className={`text-base font-bold ${p === "You" ? "text-white" : "text-gray-300"}`}>{gs.scores[p]}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-xs">First to 500 wins</p>
      </div>

      {/* Main layout */}
      <div className="w-full max-w-4xl bg-gray-900/50 rounded-3xl border border-gray-700 p-5 shadow-2xl">
        {/* AI Top (AI_2) */}
        <div className="flex flex-col items-center mb-3">
          <div className={`rounded-xl px-4 py-1 mb-2 flex items-center gap-2 border transition-all ${
            gs.currentPlayer === "AI_2" ? "bg-pink-900 border-pink-500 scale-105" : "bg-gray-800 border-gray-700"
          }`}>
            <div className="w-6 h-6 rounded-full bg-pink-700 flex items-center justify-center text-xs text-white font-bold">M</div>
            <span className={`font-semibold text-sm ${gs.currentPlayer === "AI_2" ? "text-pink-200" : "text-gray-400"}`}>
              {PLAYER_LABELS.AI_2}
            </span>
            <span className="text-gray-500 text-xs">{gs.hands.AI_2.length} cards</span>
            {gs.currentPlayer === "AI_2" && <span className="text-yellow-400 text-xs animate-pulse font-bold">PLAYING</span>}
            {gs.unoCallable === "AI_2" && !gs.unoCalled && (
              <button onClick={handleUnoCall} className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-bold animate-bounce">
                CATCH UNO!
              </button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap justify-center">
            {gs.hands.AI_2.map((card) => renderCard(card, undefined, true, true))}
          </div>
        </div>

        {/* Middle row */}
        <div className="flex items-center gap-3 justify-between">
          {/* AI Left (AI_1) */}
          <div className="flex flex-col items-center min-w-[80px]">
            <div className={`rounded-xl px-3 py-1 mb-2 border transition-all ${
              gs.currentPlayer === "AI_1" ? "bg-purple-900 border-purple-500 scale-105" : "bg-gray-800 border-gray-700"
            }`}>
              <p className={`font-semibold text-xs ${gs.currentPlayer === "AI_1" ? "text-purple-200" : "text-gray-400"}`}>
                {PLAYER_LABELS.AI_1}
              </p>
              <p className="text-gray-500 text-xs">{gs.hands.AI_1.length} cards</p>
              {gs.currentPlayer === "AI_1" && <p className="text-yellow-400 text-xs animate-pulse">PLAYING</p>}
              {gs.unoCallable === "AI_1" && !gs.unoCalled && (
                <button onClick={handleUnoCall} className="px-1 py-0.5 bg-red-600 text-white text-xs rounded font-bold animate-bounce">
                  CATCH!
                </button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {gs.hands.AI_1.map((card) => renderCard(card, undefined, true, true))}
            </div>
          </div>

          {/* Center: discard + draw + info */}
          <div className="flex-1 flex flex-col items-center gap-3">
            {/* Direction indicator */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">Direction:</span>
              <span className="text-white text-lg font-bold">
                {gs.direction === 1 ? "↻" : "↺"}
              </span>
            </div>

            {/* Active color */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">Active color:</span>
              <div
                className="w-5 h-5 rounded-full border-2 border-white"
                style={{ backgroundColor: COLOR_HEX[gs.currentColor] }}
              />
              <span className={`text-xs font-bold ${COLOR_TEXT[gs.currentColor]}`}>{gs.currentColor}</span>
            </div>

            {/* Piles */}
            <div className="flex gap-6 items-end">
              {/* Draw pile */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-gray-500 text-xs">Draw ({gs.drawPile.length})</span>
                <div
                  onClick={gs.currentPlayer === "You" && gs.phase === "playing" ? handleDraw : undefined}
                  className={`rounded-xl border-2 border-gray-600 bg-gradient-to-br from-gray-800 to-gray-700 shadow-lg flex items-center justify-center
                    ${gs.currentPlayer === "You" && gs.phase === "playing" ? "cursor-pointer hover:scale-105 hover:border-yellow-400 transition-all" : ""}`}
                  style={{ width: 56, height: 80 }}
                >
                  <span className="text-gray-400 font-black text-xs">DRAW</span>
                </div>
              </div>

              {/* Discard pile */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-gray-500 text-xs">Discard</span>
                {topCard && renderCard(topCard)}
              </div>
            </div>

            {/* Message */}
            <div className="bg-black/40 rounded-xl px-5 py-2 border border-gray-700 max-w-xs text-center">
              <p className="text-gray-200 text-sm">{gs.message}</p>
            </div>

            {/* UNO Button for player */}
            {gs.unoCallable === "You" && (
              <button
                onClick={handleUnoCall}
                className="px-6 py-2 bg-red-600 text-white font-black text-lg rounded-xl hover:bg-red-500 animate-bounce border-2 border-red-400 shadow-lg"
              >
                UNO!
              </button>
            )}
          </div>

          {/* AI Right (AI_3) */}
          <div className="flex flex-col items-center min-w-[80px]">
            <div className={`rounded-xl px-3 py-1 mb-2 border transition-all ${
              gs.currentPlayer === "AI_3" ? "bg-orange-900 border-orange-500 scale-105" : "bg-gray-800 border-gray-700"
            }`}>
              <p className={`font-semibold text-xs ${gs.currentPlayer === "AI_3" ? "text-orange-200" : "text-gray-400"}`}>
                {PLAYER_LABELS.AI_3}
              </p>
              <p className="text-gray-500 text-xs">{gs.hands.AI_3.length} cards</p>
              {gs.currentPlayer === "AI_3" && <p className="text-yellow-400 text-xs animate-pulse">PLAYING</p>}
              {gs.unoCallable === "AI_3" && !gs.unoCalled && (
                <button onClick={handleUnoCall} className="px-1 py-0.5 bg-red-600 text-white text-xs rounded font-bold animate-bounce">
                  CATCH!
                </button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {gs.hands.AI_3.map((card) => renderCard(card, undefined, true, true))}
            </div>
          </div>
        </div>

        {/* Bottom - You */}
        <div className="flex flex-col items-center mt-4">
          <div className={`rounded-xl px-4 py-1 mb-2 flex items-center gap-2 border transition-all ${
            gs.currentPlayer === "You" ? "bg-blue-900 border-blue-400 scale-105" : "bg-gray-800 border-gray-700"
          }`}>
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold">Y</div>
            <span className={`font-semibold text-sm ${gs.currentPlayer === "You" ? "text-blue-200" : "text-gray-400"}`}>You</span>
            <span className="text-gray-500 text-xs">{youHand.length} cards</span>
            {gs.currentPlayer === "You" && gs.phase === "playing" && (
              <span className="text-yellow-400 text-xs font-bold animate-pulse">YOUR TURN</span>
            )}
          </div>
          <div className="flex gap-1 flex-wrap justify-center">
            {youHand.map((card) =>
              renderCard(
                card,
                gs.currentPlayer === "You" && gs.phase === "playing" ? () => handleCardPlay(card) : undefined,
                false,
                false,
                validCards.some((c) => c.id === card.id) && gs.currentPlayer === "You"
              )
            )}
          </div>
          {gs.currentPlayer === "You" && gs.phase === "playing" && (
            <p className="text-gray-500 text-xs mt-2">
              {validCards.length > 0
                ? `${validCards.length} playable card${validCards.length > 1 ? "s" : ""} (highlighted)`
                : "No playable cards — click DRAW pile"}
            </p>
          )}
        </div>
      </div>

      {/* Color Picker Modal */}
      {gs.showColorPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-8 border-2 border-white/20 shadow-2xl text-center">
            <h3 className="text-white font-bold text-xl mb-4">Pick a Color</h3>
            <div className="grid grid-cols-2 gap-4">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorPick(color)}
                  className="w-24 h-24 rounded-2xl font-bold text-white text-lg hover:scale-110 transition-all border-2 border-white/30 shadow-lg"
                  style={{ backgroundColor: COLOR_HEX[color] }}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Round Over Modal */}
      {gs.phase === "roundOver" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-8 border-2 border-yellow-500 max-w-md w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-yellow-400 mb-1">Round {gs.roundNumber} Over!</h2>
            <p className="text-white text-lg mb-4">
              {gs.roundWinner === "You" ? "You won this round!" : `${PLAYER_LABELS[gs.roundWinner!]} won!`}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PLAYERS.map((p) => (
                <div key={p} className={`rounded-xl p-3 border ${p === "You" ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-800"}`}>
                  <p className={`font-bold ${p === "You" ? "text-blue-300" : "text-gray-300"}`}>{PLAYER_LABELS[p]}</p>
                  <p className="text-gray-400 text-xs">{gs.hands[p].length} cards left</p>
                  <p className="text-white text-xl font-bold">{gs.scores[p]}</p>
                  <p className="text-gray-400 text-xs">/ 500</p>
                </div>
              ))}
            </div>
            <p className="text-gray-400 text-sm mb-4">{gs.message}</p>
            <button
              onClick={startNewRound}
              className="px-8 py-3 bg-yellow-600 text-black font-bold rounded-xl hover:bg-yellow-500 transition-colors text-lg"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gs.phase === "gameOver" && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-10 border-2 border-yellow-500 max-w-md w-full text-center shadow-2xl">
            <div className="text-5xl mb-3">
              {gs.winner === "You" ? "🏆" : ""}
            </div>
            <h2 className="text-3xl font-black text-yellow-400 mb-2">
              {gs.winner === "You" ? "YOU WIN!" : `${PLAYER_LABELS[gs.winner!]} Wins!`}
            </h2>
            <p className="text-gray-300 mb-6">First to 500 points!</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLAYERS.sort((a, b) => gs.scores[b] - gs.scores[a]).map((p, rank) => (
                <div
                  key={p}
                  className={`rounded-xl p-3 border ${
                    p === gs.winner
                      ? "border-yellow-500 bg-yellow-900/30"
                      : p === "You"
                      ? "border-blue-500 bg-blue-900/20"
                      : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <p className="text-gray-500 text-xs">#{rank + 1}</p>
                  <p className={`font-bold ${p === gs.winner ? "text-yellow-300" : p === "You" ? "text-blue-300" : "text-gray-300"}`}>
                    {PLAYER_LABELS[p]}
                  </p>
                  <p className={`text-2xl font-bold ${p === gs.winner ? "text-yellow-400" : "text-white"}`}>
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
                      ? "bg-yellow-500 text-black hover:bg-yellow-400"
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
