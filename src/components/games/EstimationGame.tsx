"use client"
import { sfxCardFlip, sfxCardPlay, sfxWin, sfxLose, sfxClick, sfxSlap, sfxDeal, sfxUno, sfxDice, sfxGameOver, sfxVictory, sfxNotify } from '@/lib/sound';
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = "spades" | "hearts" | "diamonds" | "clubs";
type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";
interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}
interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  hand: Card[];
  bid: number;
  tricks: number;
  score: number;
}
type Phase = "menu" | "bidding" | "playing" | "roundEnd" | "gameOver";
type Difficulty = "Easy" | "Medium" | "Hard";

// ─── Constants ────────────────────────────────────────────────────────────────
const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: Rank[] = [
  "2","3","4","5","6","7","8","9","10","J","Q","K","A",
];
const RANK_VALUE: Record<Rank, number> = {
  "2": 2,"3": 3,"4": 4,"5": 5,"6": 6,"7": 7,"8": 8,
  "9": 9,"10": 10,J: 11,Q: 12,K: 13,A: 14,
};
const WINNING_SCORE = 31;
const MAX_ROUNDS = 5;
const MAX_BID = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank, id: `${rank}-${suit}` });
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

function suitSymbol(suit: Suit): string {
  return { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" }[suit];
}

function suitColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds" ? "#e74c3c" : "#1a1a2e";
}

function cardSortValue(c: Card): number {
  return SUITS.indexOf(c.suit) * 100 + RANK_VALUE[c.rank];
}

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => cardSortValue(b) - cardSortValue(a));
}

function determineTrickWinner(
  trick: { card: Card; playerId: number }[],
  leadSuit: Suit
): number {
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const challenger = trick[i];
    const bIsTrump = best.card.suit === "spades";
    const cIsTrump = challenger.card.suit === "spades";
    if (cIsTrump && !bIsTrump) {
      best = challenger;
    } else if (!cIsTrump && bIsTrump) {
      // keep best
    } else if (
      challenger.card.suit === best.card.suit &&
      RANK_VALUE[challenger.card.rank] > RANK_VALUE[best.card.rank]
    ) {
      best = challenger;
    } else if (
      challenger.card.suit === leadSuit &&
      best.card.suit !== leadSuit &&
      !bIsTrump
    ) {
      best = challenger;
    }
  }
  return best.playerId;
}

// ─── AI Bidding ───────────────────────────────────────────────────────────────
function aiBid(hand: Card[], difficulty: Difficulty): number {
  const spades = hand.filter((c) => c.suit === "spades");
  const highCards = hand.filter(
    (c) => RANK_VALUE[c.rank] >= 11 || c.suit === "spades"
  );
  let estimate = Math.round(
    spades.length * 0.7 +
      hand.filter(
        (c) => c.suit !== "spades" && RANK_VALUE[c.rank] >= 12
      ).length *
        0.5
  );
  if (difficulty === "Easy") estimate += Math.floor(Math.random() * 3) - 1;
  if (difficulty === "Medium") estimate += Math.floor(Math.random() * 2) - 1;
  return Math.max(0, Math.min(MAX_BID, estimate));
}

// ─── AI Card Play ─────────────────────────────────────────────────────────────
function aiPlayCard(
  hand: Card[],
  trick: { card: Card; playerId: number }[],
  leadSuit: Suit | null,
  bid: number,
  tricks: number,
  difficulty: Difficulty
): Card {
  if (difficulty === "Easy") {
    if (leadSuit) {
      const followers = hand.filter((c) => c.suit === leadSuit);
      if (followers.length) return followers[Math.floor(Math.random() * followers.length)];
    }
    return hand[Math.floor(Math.random() * hand.length)];
  }

  const needTricks = bid - tricks;
  const validCards =
    leadSuit && hand.some((c) => c.suit === leadSuit)
      ? hand.filter((c) => c.suit === leadSuit)
      : hand;

  // Medium / Hard: try to win if need tricks, else throw low
  if (needTricks > 0) {
    // Try to win trick
    let best: Card | null = null;
    for (const c of validCards) {
      const simTrick = [...trick, { card: c, playerId: -1 }];
      const sl = trick.length === 0 ? c.suit : (trick[0].card.suit as Suit);
      const winner = determineTrickWinner(simTrick, sl);
      if (winner === -1) {
        if (!best || RANK_VALUE[c.rank] < RANK_VALUE[best.rank]) best = c;
      }
    }
    if (best) return best;
  }

  // Throw lowest card
  return validCards.sort(
    (a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]
  )[0];
}

// ─── Score Calculation ────────────────────────────────────────────────────────
function calcRoundScore(bid: number, tricks: number): number {
  if (tricks === bid) return 10 + bid;
  if (tricks > bid) return 10 + bid + (tricks - bid);
  return -(10 * (bid - tricks));
}

// ─── Initial State ────────────────────────────────────────────────────────────
function makeInitialPlayers(): Player[] {
  return [
    { id: 0, name: "You", isHuman: true, hand: [], bid: -1, tricks: 0, score: 0 },
    { id: 1, name: "Amir", isHuman: false, hand: [], bid: -1, tricks: 0, score: 0 },
    { id: 2, name: "Layla", isHuman: false, hand: [], bid: -1, tricks: 0, score: 0 },
    { id: 3, name: "Kareem", isHuman: false, hand: [], bid: -1, tricks: 0, score: 0 },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EstimationGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [players, setPlayers] = useState<Player[]>(makeInitialPlayers());
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [biddingOrder, setBiddingOrder] = useState<number[]>([]);
  const [biddingIndex, setBiddingIndex] = useState(0);
  const [trick, setTrick] = useState<{ card: Card; playerId: number }[]>([]);
  const [leadSuit, setLeadSuit] = useState<Suit | null>(null);
  const [round, setRound] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [message, setMessage] = useState("");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [roundScores, setRoundScores] = useState<number[][]>([]);
  const [trickWinner, setTrickWinner] = useState<number | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
  };

  // ── Deal cards ──────────────────────────────────────────────────────────────
  const dealCards = useCallback(
    (playerScores: number[]) => {
      const deck = shuffle(buildDeck());
      const newPlayers = makeInitialPlayers().map((p, i) => ({
        ...p,
        hand: sortHand(deck.slice(i * 13, i * 13 + 13)),
        score: playerScores[i] ?? 0,
        bid: -1,
        tricks: 0,
      }));
      setPlayers(newPlayers);
      const order = [0, 1, 2, 3];
      setBiddingOrder(order);
      setBiddingIndex(0);
      setPhase("bidding");
      setTrick([]);
      setLeadSuit(null);
      setMessage("Bidding phase - place your bid!");
    },
    []
  );

  const startGame = () => {
    setRound(1);
    setRoundScores([]);
    dealCards([0, 0, 0, 0]);
  };

  // ── AI Bidding loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "bidding") return;
    const bidder = biddingOrder[biddingIndex];
    if (bidder === undefined) return;
    const player = players[bidder];
    if (player.isHuman) return;

    const timer = setTimeout(() => {
      const bid = aiBid(player.hand, difficulty);
      setPlayers((prev) => {
        const next = [...prev];
        next[bidder] = { ...next[bidder], bid };
        return next;
      });
      const nextIndex = biddingIndex + 1;
      if (nextIndex >= biddingOrder.length) {
        setPhase("playing");
        setCurrentPlayer(0);
        setMessage("Your turn — play a card!");
      } else {
        setBiddingIndex(nextIndex);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [phase, biddingIndex, biddingOrder, players, difficulty]);

  // ── Human bid ───────────────────────────────────────────────────────────────
  const placeBid = (bid: number) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[0] = { ...next[0], bid };
      return next;
    });
    const nextIndex = biddingIndex + 1;
    if (nextIndex >= biddingOrder.length) {
      setPhase("playing");
      setCurrentPlayer(0);
      setMessage("Your turn — play a card!");
    } else {
      setBiddingIndex(nextIndex);
    }
  };

  // ── Valid cards for human ───────────────────────────────────────────────────
  const validCards = (hand: Card[]): Set<string> => {
    if (trick.length === 0) return new Set(hand.map((c) => c.id));
    const ls = leadSuit!;
    const hasLead = hand.some((c) => c.suit === ls);
    if (hasLead) return new Set(hand.filter((c) => c.suit === ls).map((c) => c.id));
    return new Set(hand.map((c) => c.id));
  };

  // ── Play a card ─────────────────────────────────────────────────────────────
  const playCard = useCallback(
    (playerId: number, card: Card) => {
    if (playerId === 0) sfxCardPlay()
      setPlayers((prev) => {
        const next = [...prev];
        next[playerId] = {
          ...next[playerId],
          hand: next[playerId].hand.filter((c) => c.id !== card.id),
        };
        return next;
      });

      const newTrick = [...trick, { card, playerId }];
      setTrick(newTrick);

      const ls = trick.length === 0 ? card.suit : leadSuit!;
      if (trick.length === 0) setLeadSuit(card.suit);

      if (newTrick.length === 4) {
        // Resolve trick
        const winnerId = determineTrickWinner(newTrick, ls);
        setTrickWinner(winnerId);
    if (winnerId === 0) sfxWin()
        setMessage(`${players[winnerId]?.name ?? "Player"} wins the trick!`);

        setTimeout(() => {
          setTrick([]);
          setLeadSuit(null);
          setTrickWinner(null);

          setPlayers((prev) => {
            const next = [...prev];
            next[winnerId] = {
              ...next[winnerId],
              tricks: next[winnerId].tricks + 1,
            };

            // Check if round is over
            if (next[0].hand.length === 0) {
              // End of round
              const scores = next.map((p) => calcRoundScore(p.bid, p.tricks));
              const updated = next.map((p, i) => ({
                ...p,
                score: p.score + scores[i],
              }));

              setRoundScores((rs) => [...rs, scores]);

              const winner = updated.find((p) => p.score >= WINNING_SCORE);
              if (winner || round >= MAX_ROUNDS) {
                setPlayers(updated);
                setPhase("gameOver");
    { const _upd = updated; const _ps = _upd.find(p => p.id === 0)?.score ?? 0; const _ms = Math.max(..._upd.map(p => p.score)); if (_ps >= _ms) sfxVictory(); else sfxGameOver(); }
                setMessage(
                  winner
                    ? `${winner.name} wins the game!`
                    : "Game over! Final scores:"
                );
              } else {
                setPlayers(updated);
                setPhase("roundEnd");
                setMessage(`Round ${round} complete!`);
              }
            } else {
              return next;
            }
            return next;
          });

          setCurrentPlayer(winnerId);
        }, 1200);
      } else {
        const nextPlayer = (playerId + 1) % 4;
        setCurrentPlayer(nextPlayer);
      }
    },
    [trick, leadSuit, players, round]
  );

  // ── AI play loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (trickWinner !== null) return;
    const player = players[currentPlayer];
    if (!player || player.isHuman || player.hand.length === 0) return;

    clearTimer();
    aiTimerRef.current = setTimeout(() => {
      const card = aiPlayCard(
        player.hand,
        trick,
        leadSuit,
        player.bid,
        player.tricks,
        difficulty
      );
      playCard(currentPlayer, card);
    }, 700);

    return clearTimer;
  }, [phase, currentPlayer, players, trick, leadSuit, difficulty, trickWinner, playCard]);

  // ── Human card click ────────────────────────────────────────────────────────
  const handleCardClick = (card: Card) => {
    if (currentPlayer !== 0 || phase !== "playing" || trickWinner !== null) return;
    const valid = validCards(players[0].hand);
    if (!valid.has(card.id)) return;
    playCard(0, card);
  };

  const nextRound = () => {
    const scores = players.map((p) => p.score);
    setRound((r) => r + 1);
    dealCards(scores);
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const renderCard = (
    card: Card,
    opts: {
      faceDown?: boolean;
      onClick?: () => void;
      isValid?: boolean;
      isPlayed?: boolean;
      small?: boolean;
      selected?: boolean;
    } = {}
  ) => {
    const { faceDown, onClick, isValid, isPlayed, small, selected } = opts;
    const size = small ? { w: 44, h: 60 } : { w: 64, h: 88 };

    if (faceDown) {
      return (
        <div
          key={card.id}
          style={{
            width: size.w,
            height: size.h,
            borderRadius: 6,
            background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
            border: "2px solid #3949ab",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            flexShrink: 0,
          }}
        />
      );
    }

    const color = suitColor(card.suit);
    const sym = suitSymbol(card.suit);
    return (
      <div
        key={card.id}
        onClick={onClick}
        style={{
          width: size.w,
          height: size.h,
          borderRadius: 6,
          background: isPlayed
            ? "linear-gradient(135deg, #fff9e6 0%, #fff3c4 100%)"
            : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
          border: `2px solid ${isValid ? "#00e676" : selected ? "#ffd700" : "#ccc"}`,
          boxShadow: isValid
            ? "0 0 12px #00e676, 0 2px 8px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.3)",
          cursor: onClick ? "pointer" : "default",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "3px 4px",
          userSelect: "none",
          transform: selected ? "translateY(-8px)" : isValid && onClick ? "translateY(-4px)" : "none",
          transition: "transform 0.15s, box-shadow 0.15s",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div style={{ color, fontSize: small ? 11 : 13, fontWeight: "bold", lineHeight: 1 }}>
          {card.rank}
          <br />
          <span style={{ fontSize: small ? 10 : 12 }}>{sym}</span>
        </div>
        <div
          style={{
            color,
            fontSize: small ? 18 : 24,
            textAlign: "center",
            lineHeight: 1,
            fontWeight: "bold",
          }}
        >
          {sym}
        </div>
        <div
          style={{
            color,
            fontSize: small ? 11 : 13,
            fontWeight: "bold",
            lineHeight: 1,
            transform: "rotate(180deg)",
            alignSelf: "flex-end",
          }}
        >
          {card.rank}
          <br />
          <span style={{ fontSize: small ? 10 : 12 }}>{sym}</span>
        </div>
      </div>
    );
  };

  const playerColors = ["#00b4d8", "#e74c3c", "#2ecc71", "#f39c12"];
  const positionLabels = ["Bottom (You)", "Right", "Top", "Left"];

  // ─── Menu ───────────────────────────────────────────────────────────────────
  if (phase === "menu") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', sans-serif",
          color: "#fff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 8 }}>🃏</div>
        <h1 style={{ fontSize: 42, margin: "0 0 8px", color: "#ffd700", textShadow: "0 0 20px rgba(255,215,0,0.5)" }}>
          Estimation
        </h1>
        <p style={{ color: "#90caf9", margin: "0 0 32px", fontSize: 16 }}>
          The Classic Trick-Taking Card Game
        </p>

        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            padding: "24px 32px",
            border: "1px solid rgba(255,255,255,0.1)",
            maxWidth: 400,
            width: "100%",
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: "0 0 16px", color: "#ffd700", textAlign: "center" }}>How to Play</h3>
          <ul style={{ textAlign: "left", color: "#b0bec5", lineHeight: 2, paddingLeft: 20, margin: 0 }}>
            <li>4 players, 13 cards each</li>
            <li>Spades are always trump</li>
            <li>Bid how many tricks you'll take</li>
            <li>Make your bid: +10 + bid pts</li>
            <li>Over bid: +1 per extra trick</li>
            <li>Under bid: -10 × shortage</li>
            <li>First to 31 points wins!</li>
          </ul>
        </div>

        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <p style={{ color: "#90caf9", marginBottom: 12 }}>Difficulty</p>
          <div style={{ display: "flex", gap: 12 }}>
            {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: `2px solid ${difficulty === d ? "#ffd700" : "rgba(255,255,255,0.2)"}`,
                  background: difficulty === d ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                  color: difficulty === d ? "#ffd700" : "#fff",
                  cursor: "pointer",
                  fontWeight: difficulty === d ? "bold" : "normal",
                  fontSize: 14,
                  transition: "all 0.2s",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          style={{
            padding: "16px 56px",
            background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
            color: "#1a1a2e",
            border: "none",
            borderRadius: 12,
            fontSize: 20,
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(255,215,0,0.4)",
            transition: "transform 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Deal Cards
        </button>
      </div>
    );
  }

  // ─── Game Over ──────────────────────────────────────────────────────────────
  if (phase === "gameOver") {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', sans-serif",
          color: "#fff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
        <h1 style={{ fontSize: 36, color: "#ffd700", margin: "0 0 8px" }}>Game Over!</h1>
        <p style={{ color: "#90caf9", margin: "0 0 32px" }}>{message}</p>

        <div style={{ width: "100%", maxWidth: 400, marginBottom: 32 }}>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              style={{
                background:
                  i === 0
                    ? "linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,152,0,0.2) 100%)"
                    : "rgba(255,255,255,0.05)",
                border: `1px solid ${i === 0 ? "#ffd700" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 12,
                padding: "16px 24px",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "4️⃣"}
                </span>
                <span style={{ fontWeight: "bold", color: i === 0 ? "#ffd700" : "#fff" }}>
                  {p.name}
                </span>
              </div>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: i === 0 ? "#ffd700" : "#b0bec5",
                }}
              >
                {p.score} pts
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setPhase("menu")}
          style={{
            padding: "14px 48px",
            background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
            color: "#1a1a2e",
            border: "none",
            borderRadius: 12,
            fontSize: 18,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Play Again
        </button>
      </div>
    );
  }

  // ─── Round End ──────────────────────────────────────────────────────────────
  if (phase === "roundEnd") {
    const lastRoundScores = roundScores[roundScores.length - 1] ?? [];
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', sans-serif",
          color: "#fff",
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 32, color: "#ffd700", margin: "0 0 8px" }}>
          Round {round} Complete
        </h1>
        <p style={{ color: "#90caf9", margin: "0 0 24px" }}>
          Next round starts now
        </p>

        <div style={{ width: "100%", maxWidth: 440, marginBottom: 32 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 8,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: 16,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ color: "#90caf9", fontWeight: "bold", fontSize: 13, textAlign: "center" }}>Player</div>
            <div style={{ color: "#90caf9", fontWeight: "bold", fontSize: 13, textAlign: "center" }}>Bid</div>
            <div style={{ color: "#90caf9", fontWeight: "bold", fontSize: 13, textAlign: "center" }}>Got</div>
            <div style={{ color: "#90caf9", fontWeight: "bold", fontSize: 13, textAlign: "center" }}>Pts</div>
            {players.map((p, i) => (
              <React.Fragment key={p.id}>
                <div style={{ textAlign: "center", fontWeight: "bold", padding: "8px 0" }}>{p.name}</div>
                <div style={{ textAlign: "center", padding: "8px 0" }}>{p.bid}</div>
                <div style={{ textAlign: "center", padding: "8px 0" }}>{p.tricks}</div>
                <div
                  style={{
                    textAlign: "center",
                    padding: "8px 0",
                    color: (lastRoundScores[i] ?? 0) >= 0 ? "#00e676" : "#e74c3c",
                    fontWeight: "bold",
                  }}
                >
                  {(lastRoundScores[i] ?? 0) > 0 ? "+" : ""}
                  {lastRoundScores[i] ?? 0}
                </div>
              </React.Fragment>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ color: "#ffd700", textAlign: "center", margin: "0 0 12px" }}>Total Scores</h3>
            {players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span>{p.name}</span>
                <span style={{ fontWeight: "bold", color: "#ffd700" }}>{p.score} / {WINNING_SCORE}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={nextRound}
          style={{
            padding: "14px 48px",
            background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
            color: "#1a1a2e",
            border: "none",
            borderRadius: 12,
            fontSize: 18,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Deal Round {round + 1}
        </button>
      </div>
    );
  }

  // ─── Main Game Table ─────────────────────────────────────────────────────────
  const human = players[0];
  const validSet = phase === "playing" && currentPlayer === 0 ? validCards(human.hand) : new Set<string>();

  // Bidding overlay
  const showBidding = phase === "bidding" && biddingOrder[biddingIndex] === 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a1628 0%, #1a2c42 50%, #0d2137 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          background: "rgba(0,0,0,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button
          onClick={() => setPhase("menu")}
          style={{
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 16px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← Menu
        </button>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: "#ffd700", fontWeight: "bold" }}>Round {round}/{MAX_ROUNDS}</span>
          <span style={{ color: "#90caf9", fontSize: 13 }}>Spades are Trump ♠</span>
          <span
            style={{
              background: "rgba(255,215,0,0.15)",
              border: "1px solid rgba(255,215,0,0.3)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 13,
              color: "#ffd700",
            }}
          >
            {difficulty}
          </span>
        </div>
        <div style={{ color: "#b0bec5", fontSize: 13 }}>Win at {WINNING_SCORE} pts</div>
      </div>

      {/* Score bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          padding: "8px 16px",
          background: "rgba(0,0,0,0.2)",
          flexWrap: "wrap",
        }}
      >
        {players.map((p, i) => (
          <div
            key={p.id}
            style={{
              background: currentPlayer === i && phase === "playing" ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${currentPlayer === i && phase === "playing" ? "#ffd700" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 8,
              padding: "6px 14px",
              textAlign: "center",
              minWidth: 90,
            }}
          >
            <div style={{ fontSize: 11, color: "#90caf9" }}>{p.name}</div>
            <div style={{ fontWeight: "bold", color: p.id === 0 ? "#00b4d8" : "#fff" }}>
              {p.score} pts
            </div>
            {p.bid !== -1 && (
              <div style={{ fontSize: 11, color: "#ffd700" }}>
                {p.tricks}/{p.bid} tricks
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Table area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          position: "relative",
        }}
      >
        {/* Top player (AI 2) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 20,
              fontSize: 13,
            }}
          >
            <span style={{ color: "#2ecc71" }}>●</span>
            <span>{players[2]?.name}</span>
            {players[2]?.bid !== -1 && (
              <span style={{ color: "#ffd700", fontSize: 12 }}>
                bid: {players[2].bid} | got: {players[2].tricks}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: -8, overflow: "hidden" }}>
            {players[2]?.hand.map((c) => (
              <div key={c.id} style={{ marginLeft: -12 }}>
                {renderCard(c, { faceDown: true, small: true })}
              </div>
            ))}
          </div>
        </div>

        {/* Middle row: left AI + trick area + right AI */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            maxWidth: 700,
            gap: 8,
          }}
        >
          {/* Left AI (player 3) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 20,
                fontSize: 12,
              }}
            >
              <span style={{ color: "#f39c12" }}>●</span>
              <span>{players[3]?.name}</span>
              {players[3]?.bid !== -1 && (
                <span style={{ color: "#ffd700", fontSize: 11 }}>
                  {players[3].bid}/{players[3].tricks}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: -10 }}>
              {players[3]?.hand.slice(0, 6).map((c) => (
                <div key={c.id} style={{ marginTop: -18 }}>
                  {renderCard(c, { faceDown: true, small: true })}
                </div>
              ))}
            </div>
          </div>

          {/* Trick area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
                padding: 16,
                minWidth: 260,
                minHeight: 140,
                position: "relative",
              }}
            >
              {/* Message */}
              {message && (
                <div
                  style={{
                    position: "absolute",
                    top: -28,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.7)",
                    color: trickWinner !== null ? "#ffd700" : "#fff",
                    padding: "4px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {message}
                </div>
              )}

              {/* Trick cards in positional layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateAreas: `". top ." "left . right" ". bottom ."`,
                  gridTemplateColumns: "70px 70px 70px",
                  gridTemplateRows: "70px 70px 70px",
                  gap: 4,
                  alignItems: "center",
                  justifyItems: "center",
                }}
              >
                {[
                  { area: "top", pid: 2 },
                  { area: "left", pid: 3 },
                  { area: "right", pid: 1 },
                  { area: "bottom", pid: 0 },
                ].map(({ area, pid }) => {
                  const played = trick.find((t) => t.playerId === pid);
                  return (
                    <div key={pid} style={{ gridArea: area }}>
                      {played
                        ? renderCard(played.card, { small: true, isPlayed: true })
                        : <div style={{ width: 44, height: 60, borderRadius: 6, border: "1px dashed rgba(255,255,255,0.15)" }} />
                      }
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead suit indicator */}
            {leadSuit && (
              <div
                style={{
                  color: suitColor(leadSuit),
                  fontSize: 13,
                  background: "rgba(0,0,0,0.3)",
                  padding: "3px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Lead: {suitSymbol(leadSuit)} {leadSuit}
              </div>
            )}
          </div>

          {/* Right AI (player 1) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 20,
                fontSize: 12,
              }}
            >
              <span style={{ color: "#e74c3c" }}>●</span>
              <span>{players[1]?.name}</span>
              {players[1]?.bid !== -1 && (
                <span style={{ color: "#ffd700", fontSize: 11 }}>
                  {players[1].bid}/{players[1].tricks}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: -10 }}>
              {players[1]?.hand.slice(0, 6).map((c) => (
                <div key={c.id} style={{ marginTop: -18 }}>
                  {renderCard(c, { faceDown: true, small: true })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Your hand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 14px",
              background: "rgba(0,180,216,0.1)",
              borderRadius: 20,
              fontSize: 13,
              border: "1px solid rgba(0,180,216,0.3)",
            }}
          >
            <span style={{ color: "#00b4d8" }}>● You</span>
            {human.bid !== -1 && (
              <span style={{ color: "#ffd700", fontSize: 12 }}>
                bid: {human.bid} | got: {human.tricks} trick{human.tricks !== 1 ? "s" : ""}
              </span>
            )}
            {currentPlayer === 0 && phase === "playing" && (
              <span style={{ color: "#00e676", fontSize: 12, animation: "pulse 1s infinite" }}>
                ← Your Turn
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 700,
            }}
          >
            {human.hand.map((card) => {
              const isValid = validSet.has(card.id);
              return renderCard(card, {
                onClick: isValid ? () => handleCardClick(card) : undefined,
                isValid,
                selected: selectedCard === card.id,
                key: card.id,
              } as Parameters<typeof renderCard>[1] & { key: string });
            })}
          </div>
        </div>
      </div>

      {/* Bidding overlay */}
      {showBidding && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1a2c42 0%, #0d2137 100%)",
              borderRadius: 20,
              padding: "32px 40px",
              border: "1px solid rgba(255,215,0,0.3)",
              maxWidth: 600,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <h2 style={{ textAlign: "center", color: "#ffd700", margin: "0 0 8px", fontSize: 24 }}>
              Place Your Bid
            </h2>
            <p style={{ textAlign: "center", color: "#90caf9", margin: "0 0 24px", fontSize: 14 }}>
              How many tricks will you take? (0 – {MAX_BID})
            </p>

            {/* Show AI bids so far */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {players.slice(1).map((p) =>
                p.bid !== -1 ? (
                  <div
                    key={p.id}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: "#b0bec5",
                    }}
                  >
                    {p.name}: <strong style={{ color: "#ffd700" }}>{p.bid}</strong>
                  </div>
                ) : null
              )}
            </div>

            {/* Your hand preview */}
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              {human.hand.map((card) => renderCard(card, { small: true }))}
            </div>

            {/* Bid buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {Array.from({ length: MAX_BID + 1 }, (_, i) => i).map((bid) => (
                <button
                  key={bid}
                  onClick={() => placeBid(bid)}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 12,
                    border: "2px solid rgba(255,215,0,0.3)",
                    background: "rgba(255,215,0,0.1)",
                    color: "#ffd700",
                    fontSize: 22,
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "rgba(255,215,0,0.25)";
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "rgba(255,215,0,0.1)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {bid}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI thinking indicator */}
      {phase === "bidding" && !showBidding && biddingIndex < biddingOrder.length && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "#90caf9",
            padding: "8px 20px",
            borderRadius: 20,
            fontSize: 13,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {players[biddingOrder[biddingIndex]]?.name} is thinking...
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
