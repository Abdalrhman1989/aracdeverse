"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Color = "red" | "green" | "blue" | "yellow";
type GameMode = "2p" | "4p";
type Difficulty = "Easy" | "Hard";
type Phase = "menu" | "playing" | "gameOver";

interface Token {
  id: string;        // e.g. "red-0"
  color: Color;
  index: number;     // -1 = home base, 0-51 = outer path, 52-56 = home column, 57 = finished
  position: number;  // step from start (0-57), -1 = base
}

interface PlayerState {
  color: Color;
  name: string;
  isHuman: boolean;
  tokens: Token[];
  finished: number;
}

// ─── Board Layout ─────────────────────────────────────────────────────────────
// Outer path: 52 cells, shared. Each color starts at a different offset.
// Indices into the outer path (0-51) for each color's start:
const COLOR_START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
// Safe squares on outer path
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
// Home column entrance: color enters home column when they reach this outer index
const HOME_ENTRY: Record<Color, number> = { red: 51, green: 12, yellow: 25, blue: 38 };

// ─── Board Grid (15x15) cell type helper ─────────────────────────────────────
type CellType =
  | "empty"
  | "path"
  | "safe"
  | "home-col-red" | "home-col-green" | "home-col-blue" | "home-col-yellow"
  | "base-red" | "base-green" | "base-blue" | "base-yellow"
  | "center"
  | "start-red" | "start-green" | "start-blue" | "start-yellow";

interface Cell {
  type: CellType;
  outerIndex?: number;    // 0-51 for path cells
  homeColIndex?: number;  // 0-4 for home column
  homeColColor?: Color;
  baseSlot?: number;      // 0-3 for base cells
  baseColor?: Color;
}

// Build the 15x15 board grid
// Standard Ludo board layout
const GRID_SIZE = 15;

// Outer path coordinates [row, col] in order 0-51
const OUTER_PATH: [number, number][] = [
  // Red start side (bottom-left going up left col)
  [6,1],[5,1],[4,1],[3,1],[2,1],[1,1],
  // Top row going right
  [0,1],[0,2],[0,3],[0,4],[0,5],
  // Right of top going down
  [0,6],[1,6],[2,6],
  // Green start (top-right going right)
  [2,7],[2,8],
  [1,8],[0,8],[0,9],[0,10],[0,11],[0,12],[0,13],
  // Right column going down
  [1,13],[2,13],[3,13],[4,13],[5,13],
  // Right of yellow side
  [6,13],[6,12],[6,11],[6,10],[6,9],[6,8],
  // Yellow start side going down
  [7,8],[8,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],
  [9,13],[10,13],[11,13],[12,13],[13,13],
  // Bottom going left
  [14,13],[14,12],[14,11],[14,10],[14,9],[14,8],
  // Blue start side going up
  [13,8],[12,8],
  [12,7],[12,6],
  [13,6],[14,6],[14,5],[14,4],[14,3],[14,2],[14,1],
  // Left going up
  [13,1],[12,1],[11,1],[10,1],[9,1],[8,1],
  // Red side going right
  [8,2],[8,3],[8,4],[8,5],[8,6],[7,6],
];

// Home column coordinates
const HOME_COL: Record<Color, [number, number][]> = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7]],
};

// Base slot coordinates
const BASE_SLOTS: Record<Color, [number, number][]> = {
  red:    [[10,2],[10,4],[12,2],[12,4]],
  green:  [[2,10],[2,12],[4,10],[4,12]],
  yellow: [[10,10],[10,12],[12,10],[12,12]],
  blue:   [[2,2],[2,4],[4,2],[4,4]],
};

// Starting squares (outer path index = COLOR_START[color])
const START_OUTER: Record<Color, [number, number]> = {
  red: OUTER_PATH[0],
  green: OUTER_PATH[13],
  yellow: OUTER_PATH[26],
  blue: OUTER_PATH[39],
};

const COLOR_BG: Record<Color, string> = {
  red: "#e74c3c",
  green: "#27ae60",
  blue: "#2980b9",
  yellow: "#f39c12",
};

const COLOR_LIGHT: Record<Color, string> = {
  red: "#fadbd8",
  green: "#d5f5e3",
  blue: "#d6eaf8",
  yellow: "#fef9e7",
};

// ─── Build grid map ───────────────────────────────────────────────────────────
function buildGridMap(): Map<string, Cell> {
  const map = new Map<string, Cell>();

  // Mark outer path
  OUTER_PATH.forEach(([r, c], i) => {
    const key = `${r},${c}`;
    let type: CellType = "path";
    if (SAFE_SQUARES.has(i)) type = "safe";
    // Check if it's a starting square
    for (const color of ["red","green","blue","yellow"] as Color[]) {
      if (COLOR_START[color] === i) type = `start-${color}` as CellType;
    }
    map.set(key, { type, outerIndex: i });
  });

  // Mark home columns
  for (const color of ["red","green","blue","yellow"] as Color[]) {
    HOME_COL[color].forEach(([r, c], i) => {
      map.set(`${r},${c}`, { type: `home-col-${color}` as CellType, homeColIndex: i, homeColColor: color });
    });
  }

  // Mark base slots
  for (const color of ["red","green","blue","yellow"] as Color[]) {
    BASE_SLOTS[color].forEach(([r, c], i) => {
      map.set(`${r},${c}`, { type: `base-${color}` as CellType, baseSlot: i, baseColor: color });
    });
  }

  // Center
  for (let r = 6; r <= 8; r++)
    for (let c = 6; c <= 8; c++)
      map.set(`${r},${c}`, { type: "center" });

  return map;
}

const GRID_MAP = buildGridMap();

// ─── Token movement helpers ───────────────────────────────────────────────────
// Returns new step after moving `dice` from current step
// step: -1 = base, 0-51 = outer path relative to color, 52-56 = home col, 57 = done
function getOuterIndex(color: Color, step: number): number {
  return (COLOR_START[color] + step) % 52;
}

function canMoveToken(token: Token, dice: number): boolean {
  if (token.position === 57) return false;
  if (token.position === -1) return dice === 6;
  const newPos = token.position + dice;
  if (newPos > 57) return false;
  return true;
}

function moveToken(token: Token, dice: number): Token {
  if (token.position === -1 && dice === 6) {
    return { ...token, position: 0 };
  }
  return { ...token, position: token.position + dice };
}

function tokenGridPos(token: Token, color: Color): [number, number] | null {
  if (token.position === -1) {
    const slot = parseInt(token.id.split("-")[1]);
    return BASE_SLOTS[color][slot] ?? null;
  }
  if (token.position === 57) return null;
  if (token.position >= 52) {
    const col = HOME_COL[color][token.position - 52];
    return col ?? null;
  }
  const outerIdx = getOuterIndex(color, token.position);
  return OUTER_PATH[outerIdx] ?? null;
}

function isSafePosition(token: Token, color: Color): boolean {
  if (token.position === -1) return true;
  if (token.position >= 52) return true;
  const outerIdx = getOuterIndex(color, token.position);
  return SAFE_SQUARES.has(outerIdx);
}

// ─── AI token selection ───────────────────────────────────────────────────────
function aiSelectToken(
  tokens: Token[],
  dice: number,
  color: Color,
  difficulty: Difficulty,
  allPlayers: PlayerState[]
): Token | null {
  const movable = tokens.filter((t) => canMoveToken(t, dice));
  if (movable.length === 0) return null;
  if (difficulty === "Easy") return movable[Math.floor(Math.random() * movable.length)];
  // Hard: prefer farthest-along token, or exit from base, or capture
  const ranked = movable.sort((a, b) => b.position - a.position);
  return ranked[0];
}

// ─── Initial State ────────────────────────────────────────────────────────────
function makeTokens(color: Color): Token[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `${color}-${i}`,
    color,
    index: -1,
    position: -1,
  }));
}

function makePlayer(color: Color, name: string, isHuman: boolean): PlayerState {
  return { color, name, isHuman, tokens: makeTokens(color), finished: 0 };
}

// ─── Dice component ───────────────────────────────────────────────────────────
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function DiceFace({ value, rolling }: { value: number; rolling: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
  };
  const positions = dots[value] || dots[1];
  return (
    <div style={{
      width: 52, height: 52,
      background: rolling ? "#fff3" : "#fff",
      borderRadius: 10,
      border: "2px solid #333",
      position: "relative",
      boxShadow: "2px 2px 6px rgba(0,0,0,0.4)",
      transition: "background 0.1s",
    }}>
      {positions.map(([x, y], i) => (
        <div key={i} style={{
          position: "absolute",
          width: 10, height: 10,
          borderRadius: "50%",
          background: "#1a1a2e",
          left: `calc(${x}% - 5px)`,
          top: `calc(${y}% - 5px)`,
        }} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LudoGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [mode, setMode] = useState<GameMode>("4p");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [validTokenIds, setValidTokenIds] = useState<Set<string>>(new Set());
  const [extraTurn, setExtraTurn] = useState(false);
  const [message, setMessage] = useState("");
  const [winner, setWinner] = useState<PlayerState | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };

  // ── Setup ───────────────────────────────────────────────────────────────────
  const startGame = () => {
    const ps: PlayerState[] =
      mode === "2p"
        ? [makePlayer("red", "You", true), makePlayer("blue", "AI", false)]
        : [
            makePlayer("red", "You", true),
            makePlayer("green", "AI-1", false),
            makePlayer("yellow", "AI-2", false),
            makePlayer("blue", "AI-3", false),
          ];
    setPlayers(ps);
    setCurrentPlayerIdx(0);
    setDice(1);
    setRolled(false);
    setValidTokenIds(new Set());
    setExtraTurn(false);
    setMessage("Your turn — roll the dice!");
    setWinner(null);
    setPhase("playing");
  };

  // ── Roll dice ───────────────────────────────────────────────────────────────
  const rollDice = useCallback(() => {
    if (rolled || rolling) return;
    setRolling(true);
    let frames = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      frames++;
      if (frames >= 8) {
        clearInterval(interval);
        const finalDice = Math.floor(Math.random() * 6) + 1;
        setDice(finalDice);
        setRolling(false);
        setRolled(true);

        setPlayers((prev) => {
          const player = prev[currentPlayerIdx];
          const movable = player.tokens.filter((t) => canMoveToken(t, finalDice));
          if (movable.length === 0) {
            setMessage(`${player.name} rolled ${finalDice} — no moves available, passing.`);
            setTimeout(() => advanceTurn(prev, currentPlayerIdx, finalDice === 6), 900);
          } else {
            setValidTokenIds(new Set(movable.map((t) => t.id)));
            setMessage(`${player.name} rolled ${finalDice} — select a token to move.`);
          }
          return prev;
        });
      }
    }, 80);
  }, [rolled, rolling, currentPlayerIdx]);

  // ── Advance turn ────────────────────────────────────────────────────────────
  const advanceTurn = useCallback(
    (currentPlayers: PlayerState[], fromIdx: number, bonusTurn: boolean) => {
      setRolled(false);
      setValidTokenIds(new Set());
      setExtraTurn(false);
      if (bonusTurn) {
        setMessage(`${currentPlayers[fromIdx].name} rolled 6 — extra turn!`);
        setCurrentPlayerIdx(fromIdx);
      } else {
        const next = (fromIdx + 1) % currentPlayers.length;
        setCurrentPlayerIdx(next);
        setMessage(`${currentPlayers[next].name}'s turn${currentPlayers[next].isHuman ? " — roll the dice!" : ""}`);
      }
    },
    []
  );

  // ── Move token ──────────────────────────────────────────────────────────────
  const doMoveToken = useCallback(
    (tokenId: string) => {
      setPlayers((prev) => {
        const playerIdx = prev.findIndex((p) =>
          p.tokens.some((t) => t.id === tokenId)
        );
        if (playerIdx === -1) return prev;
        const player = prev[playerIdx];
        const tokenIdx = player.tokens.findIndex((t) => t.id === tokenId);
        const token = player.tokens[tokenIdx];

        const movedToken = moveToken(token, dice);
        let gotBonus = dice === 6;
        let captureMsg = "";

        // Check for capture (only on outer path, non-safe)
        const newPos = movedToken.position;
        let updated = [...prev];
        if (newPos >= 0 && newPos < 52) {
          const outerIdx = getOuterIndex(player.color, newPos);
          if (!SAFE_SQUARES.has(outerIdx)) {
            for (let pi = 0; pi < updated.length; pi++) {
              if (pi === playerIdx) continue;
              const opponent = updated[pi];
              const hitTokens = opponent.tokens.filter((ot) => {
                if (ot.position < 0 || ot.position >= 52) return false;
                return getOuterIndex(opponent.color, ot.position) === outerIdx;
              });
              if (hitTokens.length > 0) {
                gotBonus = true;
                captureMsg = ` Captured ${opponent.name}'s token!`;
                const newOpTokens = opponent.tokens.map((ot) =>
                  hitTokens.some((h) => h.id === ot.id) ? { ...ot, position: -1 } : ot
                );
                updated[pi] = { ...opponent, tokens: newOpTokens };
              }
            }
          }
        }

        // Check if finished
        const isFinished = movedToken.position === 57;
        const newTokens = player.tokens.map((t, i) =>
          i === tokenIdx ? movedToken : t
        );
        const finishedCount = newTokens.filter((t) => t.position === 57).length;
        updated[playerIdx] = { ...player, tokens: newTokens, finished: finishedCount };

        if (finishedCount === 4) {
          setWinner(updated[playerIdx]);
          setPhase("gameOver");
          setMessage(`${player.name} wins! 🎉`);
          return updated;
        }

        setMessage(`${player.name} moved.${captureMsg}`);
        setValidTokenIds(new Set());
        setTimeout(() => advanceTurn(updated, playerIdx, gotBonus), 400);
        return updated;
      });
    },
    [dice, advanceTurn]
  );

  // ── AI turn ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !rolled) return;
    const player = players[currentPlayerIdx];
    if (!player || player.isHuman) return;

    clearTimer();
    aiTimerRef.current = setTimeout(() => {
      const token = aiSelectToken(player.tokens, dice, player.color, difficulty, players);
      if (token) {
        doMoveToken(token.id);
      } else {
        advanceTurn(players, currentPlayerIdx, false);
        setRolled(false);
        setValidTokenIds(new Set());
      }
    }, 500);

    return clearTimer;
  }, [phase, rolled, currentPlayerIdx, players, dice, difficulty, doMoveToken, advanceTurn]);

  // ── AI auto-roll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || rolled || rolling) return;
    const player = players[currentPlayerIdx];
    if (!player || player.isHuman) return;

    clearTimer();
    aiTimerRef.current = setTimeout(() => {
      rollDice();
    }, 600);

    return clearTimer;
  }, [phase, rolled, rolling, currentPlayerIdx, players, rollDice]);

  // ─── Render board ────────────────────────────────────────────────────────────
  const getCellStyle = (cell: Cell | undefined): React.CSSProperties => {
    if (!cell) return { background: "#fff" };
    switch (cell.type) {
      case "path": return { background: "#f0f0f0", border: "1px solid #ccc" };
      case "safe": return { background: "#c8e6c9", border: "1px solid #81c784" };
      case "start-red": return { background: COLOR_LIGHT.red, border: `2px solid ${COLOR_BG.red}` };
      case "start-green": return { background: COLOR_LIGHT.green, border: `2px solid ${COLOR_BG.green}` };
      case "start-blue": return { background: COLOR_LIGHT.blue, border: `2px solid ${COLOR_BG.blue}` };
      case "start-yellow": return { background: COLOR_LIGHT.yellow, border: `2px solid ${COLOR_BG.yellow}` };
      case "home-col-red": return { background: "#ffcdd2", border: "1px solid #e57373" };
      case "home-col-green": return { background: "#c8e6c9", border: "1px solid #81c784" };
      case "home-col-blue": return { background: "#bbdefb", border: "1px solid #64b5f6" };
      case "home-col-yellow": return { background: "#fff9c4", border: "1px solid #fff176" };
      case "base-red": return { background: COLOR_BG.red };
      case "base-green": return { background: COLOR_BG.green };
      case "base-blue": return { background: COLOR_BG.blue };
      case "base-yellow": return { background: COLOR_BG.yellow };
      case "center": return { background: "linear-gradient(135deg, #ffd700, #ff9800)" };
      default: return { background: "#e8e8e8" };
    }
  };

  const cellSize = 36;

  const renderBoard = () => {
    const cells: React.ReactNode[] = [];

    // Build token map: gridKey -> tokens
    const tokenMap = new Map<string, { token: Token; player: PlayerState }[]>();
    for (const player of players) {
      for (const token of player.tokens) {
        const pos = tokenGridPos(token, player.color);
        if (pos) {
          const key = `${pos[0]},${pos[1]}`;
          if (!tokenMap.has(key)) tokenMap.set(key, []);
          tokenMap.get(key)!.push({ token, player });
        }
      }
    }

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const key = `${r},${c}`;
        const cell = GRID_MAP.get(key);
        const tokensHere = tokenMap.get(key) || [];
        const isValid = tokensHere.some((tp) => validTokenIds.has(tp.token.id));

        cells.push(
          <div
            key={key}
            style={{
              gridRow: r + 1,
              gridColumn: c + 1,
              width: cellSize,
              height: cellSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              ...getCellStyle(cell),
              ...(isValid ? { boxShadow: "0 0 8px #ffd700", zIndex: 2 } : {}),
            }}
          >
            {/* Safe star indicator */}
            {cell?.type === "safe" && tokensHere.length === 0 && (
              <span style={{ fontSize: 12, color: "#388e3c", position: "absolute" }}>★</span>
            )}
            {/* Base circle background */}
            {cell?.type.startsWith("base-") && (
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "rgba(255,255,255,0.4)",
                border: "2px solid rgba(255,255,255,0.6)",
              }} />
            )}
            {/* Center triangle */}
            {cell?.type === "center" && r === 7 && c === 7 && (
              <span style={{ fontSize: 20 }}>🏠</span>
            )}
            {/* Tokens */}
            {tokensHere.map(({ token, player }, idx) => {
              const isValidToken = validTokenIds.has(token.id);
              return (
                <div
                  key={token.id}
                  onClick={() => {
                    if (isValidToken && currentPlayerIdx === players.indexOf(player)) {
                      doMoveToken(token.id);
                    }
                  }}
                  style={{
                    width: 20, height: 20,
                    borderRadius: "50%",
                    background: COLOR_BG[player.color],
                    border: `2px solid ${isValidToken ? "#ffd700" : "rgba(255,255,255,0.6)"}`,
                    boxShadow: isValidToken ? "0 0 8px #ffd700" : "0 1px 3px rgba(0,0,0,0.4)",
                    cursor: isValidToken ? "pointer" : "default",
                    position: "absolute",
                    transform: `translate(${idx * 5 - (tokensHere.length - 1) * 2.5}px, ${idx * -3}px)`,
                    zIndex: isValidToken ? 10 : 5,
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    color: "#fff",
                    fontWeight: "bold",
                  }}
                >
                  {tokensHere.length > 1 ? idx + 1 : ""}
                </div>
              );
            })}
          </div>
        );
      }
    }
    return cells;
  };

  // ─── Menu ─────────────────────────────────────────────────────────────────
  if (phase === "menu") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif", color: "#fff", padding: 20,
      }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🎲</div>
        <h1 style={{ fontSize: 42, margin: "0 0 8px", color: "#ffd700", textShadow: "0 0 20px rgba(255,215,0,0.5)" }}>
          Ludo
        </h1>
        <p style={{ color: "#90caf9", margin: "0 0 32px", fontSize: 16 }}>Classic Board Game</p>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {(["2p","4p"] as GameMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "14px 32px", borderRadius: 12,
              border: `2px solid ${mode === m ? "#ffd700" : "rgba(255,255,255,0.2)"}`,
              background: mode === m ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
              color: mode === m ? "#ffd700" : "#fff", cursor: "pointer",
              fontSize: 16, fontWeight: mode === m ? "bold" : "normal",
            }}>
              {m === "2p" ? "2 Players" : "4 Players"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
          {(["Easy","Hard"] as Difficulty[]).map((d) => (
            <button key={d} onClick={() => setDifficulty(d)} style={{
              padding: "10px 24px", borderRadius: 10,
              border: `2px solid ${difficulty === d ? "#00e676" : "rgba(255,255,255,0.2)"}`,
              background: difficulty === d ? "rgba(0,230,118,0.1)" : "rgba(255,255,255,0.05)",
              color: difficulty === d ? "#00e676" : "#b0bec5", cursor: "pointer",
              fontSize: 14,
            }}>
              {d === "Easy" ? "Easy (Random AI)" : "Hard (Strategic AI)"}
            </button>
          ))}
        </div>

        <div style={{
          background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px 28px",
          border: "1px solid rgba(255,255,255,0.1)", maxWidth: 380, width: "100%", marginBottom: 28,
        }}>
          <h3 style={{ margin: "0 0 12px", color: "#ffd700", textAlign: "center" }}>Rules</h3>
          <ul style={{ color: "#b0bec5", lineHeight: 1.9, paddingLeft: 20, margin: 0, fontSize: 14 }}>
            <li>Roll 6 to bring a token out of base</li>
            <li>Roll 6 again for an extra turn</li>
            <li>Land on enemy = send them home!</li>
            <li>Star squares are safe zones</li>
            <li>Get all 4 tokens to center to win</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {(["red","green","blue","yellow"] as Color[]).slice(0, mode === "2p" ? 2 : 4).map((c) => (
            <div key={c} style={{
              width: 40, height: 40, borderRadius: "50%",
              background: COLOR_BG[c], border: "3px solid rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: "bold", fontSize: 11,
            }}>
              {c === "red" ? "YOU" : "AI"}
            </div>
          ))}
        </div>

        <button onClick={startGame} style={{
          padding: "16px 56px",
          background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
          color: "#1a1a2e", border: "none", borderRadius: 12,
          fontSize: 20, fontWeight: "bold", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(255,215,0,0.4)",
        }}>
          Start Game
        </button>
      </div>
    );
  }

  // ─── Game Over ─────────────────────────────────────────────────────────────
  if (phase === "gameOver" && winner) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif", color: "#fff",
      }}>
        <div style={{ fontSize: 80 }}>🏆</div>
        <h1 style={{ fontSize: 40, color: "#ffd700", margin: "8px 0" }}>{winner.name} Wins!</h1>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: COLOR_BG[winner.color], margin: "16px auto", border: "4px solid #fff" }} />
        <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
          {players.map((p) => (
            <div key={p.color} style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 12,
              padding: "12px 20px", textAlign: "center", border: `1px solid ${COLOR_BG[p.color]}`,
            }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLOR_BG[p.color], margin: "0 auto 8px" }} />
              <div style={{ fontWeight: "bold" }}>{p.name}</div>
              <div style={{ color: "#ffd700", fontSize: 14 }}>{p.finished}/4 home</div>
            </div>
          ))}
        </div>
        <button onClick={() => setPhase("menu")} style={{
          marginTop: 32, padding: "14px 48px",
          background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
          color: "#1a1a2e", border: "none", borderRadius: 12,
          fontSize: 18, fontWeight: "bold", cursor: "pointer",
        }}>
          Play Again
        </button>
      </div>
    );
  }

  // ─── Playing ───────────────────────────────────────────────────────────────
  const currentPlayer = players[currentPlayerIdx];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Segoe UI', sans-serif", color: "#fff", padding: "12px 8px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", maxWidth: 700, marginBottom: 10,
      }}>
        <button onClick={() => setPhase("menu")} style={{
          background: "rgba(255,255,255,0.1)", color: "#fff", border: "none",
          borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13,
        }}>← Menu</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", color: "#ffd700" }}>Ludo</div>
          <div style={{ fontSize: 12, color: "#90caf9" }}>{difficulty} · {mode === "2p" ? "2 Players" : "4 Players"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {players.map((p) => (
            <div key={p.color} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 8px", borderRadius: 8,
              background: currentPlayer?.color === p.color ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${currentPlayer?.color === p.color ? "#ffd700" : "rgba(255,255,255,0.1)"}`,
              fontSize: 12,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR_BG[p.color] }} />
              <span>{p.finished}/4</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message */}
      <div style={{
        background: "rgba(0,0,0,0.4)", borderRadius: 20, padding: "6px 20px",
        marginBottom: 10, fontSize: 14, color: "#e0e0e0",
        border: "1px solid rgba(255,255,255,0.1)",
        maxWidth: 580, textAlign: "center",
      }}>
        {message}
      </div>

      {/* Board + controls */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Board */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
          border: "3px solid #333",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {renderBoard()}
        </div>

        {/* Controls */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px 24px",
          border: "1px solid rgba(255,255,255,0.1)", minWidth: 160,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#90caf9", marginBottom: 4 }}>Current Turn</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: COLOR_BG[currentPlayer?.color ?? "red"] }} />
              <span style={{ fontWeight: "bold" }}>{currentPlayer?.name}</span>
            </div>
          </div>

          <DiceFace value={dice} rolling={rolling} />

          {currentPlayer?.isHuman && !rolled && !rolling && (
            <button onClick={rollDice} style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
              color: "#1a1a2e", border: "none", borderRadius: 10,
              fontSize: 16, fontWeight: "bold", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(255,215,0,0.4)",
            }}>
              Roll!
            </button>
          )}

          {validTokenIds.size > 0 && currentPlayer?.isHuman && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#00e676" }}>
              Click a glowing token to move
            </div>
          )}

          {rolling && (
            <div style={{ fontSize: 13, color: "#90caf9", animation: "pulse 0.5s infinite" }}>
              Rolling...
            </div>
          )}

          {/* Progress */}
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: 12, color: "#90caf9", marginBottom: 8, textAlign: "center" }}>Progress</div>
            {players.map((p) => (
              <div key={p.color} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLOR_BG[p.color], flexShrink: 0 }} />
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${(p.finished / 4) * 100}%`,
                    height: "100%", background: COLOR_BG[p.color], borderRadius: 4,
                    transition: "width 0.3s",
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "#b0bec5", minWidth: 24 }}>{p.finished}/4</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
