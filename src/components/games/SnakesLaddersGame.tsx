"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "menu" | "playing" | "gameOver";

interface Player {
  id: number;
  name: string;
  color: string;
  isHuman: boolean;
  position: number; // 0 = start (off board), 1-100 = squares
}

// ─── Board Constants ──────────────────────────────────────────────────────────
const LADDERS: Record<number, number> = {
  4: 14, 9: 31, 20: 38, 28: 84,
  40: 59, 51: 67, 63: 81, 71: 91,
};
const SNAKES: Record<number, number> = {
  17: 7, 54: 34, 62: 19, 64: 60,
  87: 24, 93: 73, 95: 75, 99: 78,
};

const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const PLAYER_NAMES = ["You", "AI-1", "AI-2", "AI-3"];

// ─── Board layout ─────────────────────────────────────────────────────────────
// Square 1 is bottom-left, 100 is top-left (snake layout)
// Row 0 = top (91-100), row 9 = bottom (1-10)
function squareToGrid(sq: number): { row: number; col: number } {
  const idx = sq - 1; // 0-based
  const row = 9 - Math.floor(idx / 10);
  const rowNum = Math.floor(idx / 10); // 0-based from bottom
  const posInRow = idx % 10;
  // Even rows (from bottom): left to right; odd rows: right to left
  const col = rowNum % 2 === 0 ? posInRow : 9 - posInRow;
  return { row, col };
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ["#ffd700", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"][i % 6],
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    size: 8 + Math.random() * 8,
  }));

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.id % 3 === 0 ? "50%" : 2,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Dice face component ──────────────────────────────────────────────────────
const DICE_DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

function AnimatedDice({ value, rolling }: { value: number; rolling: boolean }) {
  const positions = DICE_DOT_POSITIONS[value] || DICE_DOT_POSITIONS[1];
  return (
    <div style={{
      width: 64, height: 64,
      background: rolling ? "linear-gradient(135deg, #f0f0f0, #e0e0e0)" : "#fff",
      borderRadius: 12,
      border: "3px solid #333",
      position: "relative",
      boxShadow: rolling
        ? "0 0 20px rgba(255,215,0,0.8), 2px 4px 10px rgba(0,0,0,0.4)"
        : "3px 4px 10px rgba(0,0,0,0.4)",
      transition: "all 0.1s",
      animation: rolling ? "dice-roll 0.1s infinite" : "none",
    }}>
      {positions.map(([x, y], i) => (
        <div key={i} style={{
          position: "absolute",
          width: 10, height: 10,
          borderRadius: "50%",
          background: "#1a1a2e",
          left: `calc(${x}% - 5px)`,
          top: `calc(${y}% - 5px)`,
          boxShadow: "inset 1px 1px 2px rgba(255,255,255,0.3)",
        }} />
      ))}
      <style>{`
        @keyframes dice-roll {
          0% { transform: rotate(-5deg) scale(0.95); }
          50% { transform: rotate(5deg) scale(1.05); }
          100% { transform: rotate(-5deg) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SnakesLaddersGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [numPlayers, setNumPlayers] = useState(2);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [message, setMessage] = useState("");
  const [winner, setWinner] = useState<Player | null>(null);
  const [flashSquare, setFlashSquare] = useState<{ sq: number; type: "snake" | "ladder" } | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };

  // ── Start ─────────────────────────────────────────────────────────────────────
  const startGame = () => {
    const ps: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
      id: i,
      name: PLAYER_NAMES[i],
      color: PLAYER_COLORS[i],
      isHuman: i === 0,
      position: 0,
    }));
    setPlayers(ps);
    setCurrentIdx(0);
    setDice(1);
    setRolled(false);
    setMessage("Your turn — roll the dice!");
    setWinner(null);
    setFlashSquare(null);
    setPhase("playing");
  };

  // ── Roll ──────────────────────────────────────────────────────────────────────
  const rollDice = useCallback(() => {
    if (rolled || rolling) return;
    setRolling(true);
    let frames = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      frames++;
      if (frames >= 10) {
        clearInterval(interval);
        const finalVal = Math.floor(Math.random() * 6) + 1;
        setDice(finalVal);
        setRolling(false);
        setRolled(true);

        // Move current player
        setPlayers((prev) => {
          const player = prev[currentIdx];
          let newPos = player.position + finalVal;

          if (newPos > 100) {
            // Bounce back
            newPos = 100 - (newPos - 100);
            setMessage(`${player.name} rolled ${finalVal} — bounced back to ${newPos}!`);
          } else if (newPos === 100) {
            // Win!
            const updated = prev.map((p, i) => i === currentIdx ? { ...p, position: 100 } : p);
            setWinner(updated[currentIdx]);
            setMessage(`${player.name} wins! 🎉`);
            setPhase("gameOver");
            return updated;
          } else {
            setMessage(`${player.name} rolled ${finalVal} → square ${newPos}`);
          }

          // Check snake or ladder
          let flashType: "snake" | "ladder" | null = null;
          let flashSq = newPos;
          const ladder = LADDERS[newPos];
          const snake = SNAKES[newPos];

          if (ladder) {
            flashType = "ladder";
            flashSq = newPos;
            setTimeout(() => {
              setFlashSquare({ sq: newPos, type: "ladder" });
              setTimeout(() => {
                setPlayers((p2) => p2.map((pl, i) => i === currentIdx ? { ...pl, position: ladder } : pl));
                setMessage(`${player.name} climbed a ladder! ${newPos} → ${ladder} 🪜`);
                setFlashSquare(null);
                setTimeout(() => advanceTurn(currentIdx), 800);
              }, 800);
            }, 300);
          } else if (snake) {
            flashType = "snake";
            flashSq = newPos;
            setTimeout(() => {
              setFlashSquare({ sq: newPos, type: "snake" });
              setTimeout(() => {
                setPlayers((p2) => p2.map((pl, i) => i === currentIdx ? { ...pl, position: snake } : pl));
                setMessage(`${player.name} hit a snake! ${newPos} → ${snake} 🐍`);
                setFlashSquare(null);
                setTimeout(() => advanceTurn(currentIdx), 800);
              }, 800);
            }, 300);
          } else {
            setTimeout(() => advanceTurn(currentIdx), 600);
          }

          return prev.map((p, i) => i === currentIdx ? { ...p, position: newPos } : p);
        });
      }
    }, 70);
  }, [rolled, rolling, currentIdx]);

  // ── Advance turn ──────────────────────────────────────────────────────────────
  const advanceTurn = useCallback((fromIdx: number) => {
    setRolled(false);
    setPlayers((prev) => {
      const nextIdx = (fromIdx + 1) % prev.length;
      setCurrentIdx(nextIdx);
      setMessage(`${prev[nextIdx].name}'s turn${prev[nextIdx].isHuman ? " — roll the dice!" : ""}`);
      return prev;
    });
  }, []);

  // ── AI auto-play ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || rolled || rolling) return;
    const player = players[currentIdx];
    if (!player || player.isHuman) return;

    clearTimer();
    aiTimerRef.current = setTimeout(() => {
      rollDice();
    }, 700);

    return clearTimer;
  }, [phase, rolled, rolling, currentIdx, players, rollDice]);

  // ─── Draw board ───────────────────────────────────────────────────────────────
  const CELL_SIZE = 52;

  const renderBoard = () => {
    const cells: React.ReactNode[] = [];

    // Build token map
    const tokenMap = new Map<number, Player[]>();
    for (const p of players) {
      if (p.position > 0) {
        if (!tokenMap.has(p.position)) tokenMap.set(p.position, []);
        tokenMap.get(p.position)!.push(p);
      }
    }

    for (let sq = 1; sq <= 100; sq++) {
      const { row, col } = squareToGrid(sq);
      const isLadderBottom = sq in LADDERS;
      const isLadderTop = Object.values(LADDERS).includes(sq);
      const isSnakeHead = sq in SNAKES;
      const isSnakeTail = Object.values(SNAKES).includes(sq);
      const tokensHere = tokenMap.get(sq) || [];
      const isFlash = flashSquare?.sq === sq;
      const flashIsLadder = flashSquare?.type === "ladder";

      let cellBg = "#f5f5f5";
      if ((row + col) % 2 === 0) cellBg = "#e8f4f8";
      if (isLadderBottom) cellBg = "#c8e6c9";
      if (isSnakeHead) cellBg = "#ffcdd2";
      if (isFlash) cellBg = flashIsLadder ? "#00e676" : "#ff5252";

      cells.push(
        <div
          key={sq}
          style={{
            gridRow: row + 1,
            gridColumn: col + 1,
            width: CELL_SIZE,
            height: CELL_SIZE,
            background: cellBg,
            border: "1px solid #ccc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "background 0.3s",
            overflow: "hidden",
          }}
        >
          {/* Square number */}
          <div style={{
            position: "absolute", top: 1, left: 3,
            fontSize: 9, color: "#666", fontWeight: "bold",
          }}>
            {sq}
          </div>

          {/* Ladder indicator */}
          {isLadderBottom && (
            <div style={{
              position: "absolute", top: 0, right: 0,
              fontSize: 11, color: "#27ae60",
              background: "rgba(39,174,96,0.15)",
              padding: "1px 3px",
              borderRadius: "0 0 0 4px",
            }}>
              🪜{LADDERS[sq]}
            </div>
          )}

          {/* Snake indicator */}
          {isSnakeHead && (
            <div style={{
              position: "absolute", top: 0, right: 0,
              fontSize: 11, color: "#e74c3c",
              background: "rgba(231,76,60,0.15)",
              padding: "1px 3px",
              borderRadius: "0 0 0 4px",
            }}>
              🐍{SNAKES[sq]}
            </div>
          )}

          {/* Tokens */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", alignItems: "center", padding: "12px 2px 2px" }}>
            {tokensHere.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  width: 14, height: 14,
                  borderRadius: "50%",
                  background: p.color,
                  border: "1.5px solid rgba(255,255,255,0.8)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                  flexShrink: 0,
                }}
                title={p.name}
              />
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  // ─── Snake/Ladder legend ──────────────────────────────────────────────────────
  const renderLegend = () => (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      borderRadius: 12, padding: "12px 16px",
      border: "1px solid rgba(255,255,255,0.1)",
      fontSize: 12,
    }}>
      <div style={{ color: "#ffd700", fontWeight: "bold", marginBottom: 8 }}>Ladders 🪜</div>
      {Object.entries(LADDERS).map(([from, to]) => (
        <div key={from} style={{ color: "#c8e6c9", marginBottom: 2 }}>
          {from} → {to}
        </div>
      ))}
      <div style={{ color: "#ffd700", fontWeight: "bold", margin: "8px 0" }}>Snakes 🐍</div>
      {Object.entries(SNAKES).map(([from, to]) => (
        <div key={from} style={{ color: "#ffcdd2", marginBottom: 2 }}>
          {from} → {to}
        </div>
      ))}
    </div>
  );

  // ─── Menu ─────────────────────────────────────────────────────────────────────
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
          Snakes & Ladders
        </h1>
        <p style={{ color: "#90caf9", margin: "0 0 32px", fontSize: 16 }}>Classic Board Game</p>

        <div style={{
          background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px 28px",
          border: "1px solid rgba(255,255,255,0.1)", maxWidth: 380, width: "100%", marginBottom: 24,
        }}>
          <h3 style={{ margin: "0 0 12px", color: "#ffd700", textAlign: "center" }}>Rules</h3>
          <ul style={{ color: "#b0bec5", lineHeight: 1.9, paddingLeft: 20, margin: 0, fontSize: 14 }}>
            <li>Roll dice and move forward</li>
            <li>Land on ladder bottom — climb up!</li>
            <li>Land on snake head — slide down!</li>
            <li>Must roll exact number to reach 100</li>
            <li>Overshoot? Bounce back!</li>
            <li>First to reach 100 wins!</li>
          </ul>
        </div>

        <div style={{ marginBottom: 28 }}>
          <p style={{ color: "#90caf9", marginBottom: 12, textAlign: "center" }}>Number of Players</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {[2, 3, 4].map((n) => (
              <button key={n} onClick={() => setNumPlayers(n)} style={{
                padding: "12px 24px", borderRadius: 10,
                border: `2px solid ${numPlayers === n ? "#ffd700" : "rgba(255,255,255,0.2)"}`,
                background: numPlayers === n ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                color: numPlayers === n ? "#ffd700" : "#fff",
                cursor: "pointer", fontSize: 16, fontWeight: numPlayers === n ? "bold" : "normal",
              }}>
                {n}P
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {Array.from({ length: numPlayers }, (_, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: PLAYER_COLORS[i], border: "3px solid rgba(255,255,255,0.4)",
              }} />
              <span style={{ fontSize: 11, color: "#b0bec5" }}>{PLAYER_NAMES[i]}</span>
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

  // ─── Game Over ────────────────────────────────────────────────────────────────
  if (phase === "gameOver" && winner) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif", color: "#fff", padding: 20,
      }}>
        <Confetti />
        <div style={{ fontSize: 80 }}>🏆</div>
        <h1 style={{ fontSize: 40, color: "#ffd700", margin: "8px 0", textAlign: "center" }}>
          {winner.name} Wins!
        </h1>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: winner.color, margin: "16px auto",
          border: "4px solid #fff",
          boxShadow: `0 0 30px ${winner.color}`,
        }} />
        <p style={{ color: "#90caf9", margin: "0 0 32px", fontSize: 16 }}>
          Reached square 100!
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 32 }}>
          {players.sort((a, b) => b.position - a.position).map((p) => (
            <div key={p.id} style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 12,
              padding: "12px 20px", textAlign: "center",
              border: `1px solid ${p.id === winner.id ? "#ffd700" : "rgba(255,255,255,0.1)"}`,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: p.color, margin: "0 auto 6px",
              }} />
              <div style={{ fontWeight: "bold", fontSize: 14 }}>{p.name}</div>
              <div style={{ color: "#90caf9", fontSize: 13 }}>sq. {p.position}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={startGame} style={{
            padding: "14px 40px",
            background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
            color: "#1a1a2e", border: "none", borderRadius: 12,
            fontSize: 18, fontWeight: "bold", cursor: "pointer",
          }}>
            Play Again
          </button>
          <button onClick={() => setPhase("menu")} style={{
            padding: "14px 40px",
            background: "rgba(255,255,255,0.1)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12,
            fontSize: 18, fontWeight: "bold", cursor: "pointer",
          }}>
            Menu
          </button>
        </div>
      </div>
    );
  }

  // ─── Playing ──────────────────────────────────────────────────────────────────
  const currentPlayer = players[currentIdx];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Segoe UI', sans-serif", color: "#fff", padding: "10px 8px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", maxWidth: 720, marginBottom: 10,
      }}>
        <button onClick={() => setPhase("menu")} style={{
          background: "rgba(255,255,255,0.1)", color: "#fff", border: "none",
          borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13,
        }}>← Menu</button>
        <h2 style={{ margin: 0, color: "#ffd700", fontSize: 18 }}>Snakes & Ladders</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {players.map((p) => (
            <div key={p.id} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "4px 8px", borderRadius: 8,
              background: currentPlayer?.id === p.id ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${currentPlayer?.id === p.id ? "#ffd700" : "rgba(255,255,255,0.1)"}`,
              fontSize: 11,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, marginBottom: 2 }} />
              <span>{p.name}</span>
              <span style={{ color: "#ffd700" }}>{p.position}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: "rgba(0,0,0,0.4)", borderRadius: 20, padding: "6px 20px",
          marginBottom: 10, fontSize: 14, color: "#e0e0e0",
          border: "1px solid rgba(255,255,255,0.1)",
          maxWidth: 580, textAlign: "center",
        }}>
          {message}
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Board */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(10, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(10, ${CELL_SIZE}px)`,
          border: "3px solid #333",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {renderBoard()}
        </div>

        {/* Right panel */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 12, minWidth: 160,
        }}>
          {/* Dice + roll */}
          <div style={{
            background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px 24px",
            border: "1px solid rgba(255,255,255,0.1)", display: "flex",
            flexDirection: "column", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontSize: 13, color: "#90caf9" }}>Current Turn</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: currentPlayer?.color ?? "#fff" }} />
              <span style={{ fontWeight: "bold" }}>{currentPlayer?.name}</span>
            </div>
            <AnimatedDice value={dice} rolling={rolling} />
            {currentPlayer?.isHuman && !rolled && !rolling && (
              <button onClick={rollDice} style={{
                padding: "12px 28px",
                background: "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
                color: "#1a1a2e", border: "none", borderRadius: 10,
                fontSize: 16, fontWeight: "bold", cursor: "pointer",
                boxShadow: "0 4px 12px rgba(255,215,0,0.4)",
              }}>
                Roll!
              </button>
            )}
            {rolling && (
              <div style={{ fontSize: 14, color: "#ffd700", animation: "pulse 0.3s infinite" }}>Rolling...</div>
            )}
            {rolled && !rolling && currentPlayer?.isHuman && (
              <div style={{ fontSize: 13, color: "#00e676" }}>Moved!</div>
            )}
          </div>

          {/* Player progress */}
          <div style={{
            background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 16px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{ fontSize: 13, color: "#90caf9", marginBottom: 8, textAlign: "center" }}>Progress</div>
            {players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${p.position}%`,
                    height: "100%", background: p.color, borderRadius: 4,
                    transition: "width 0.5s",
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "#b0bec5", minWidth: 24 }}>{p.position}</span>
              </div>
            ))}
          </div>

          {/* Legend (small) */}
          <div style={{
            background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.1)", fontSize: 11,
          }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
              <span style={{ color: "#c8e6c9" }}>🪜 Ladder = climb up</span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ color: "#ffcdd2" }}>🐍 Snake = slide down</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
