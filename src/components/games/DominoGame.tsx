"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Domino {
  id: string;
  left: number;
  right: number;
}

interface ChainTile {
  domino: Domino;
  orientation: "normal" | "flipped";
}

type Phase = "menu" | "playing" | "roundEnd" | "gameOver";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildSet(): Domino[] {
  const tiles: Domino[] = [];
  for (let i = 0; i <= 6; i++)
    for (let j = i; j <= 6; j++)
      tiles.push({ id: `${i}-${j}`, left: i, right: j });
  return tiles;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pipCount(tiles: Domino[]): number {
  return tiles.reduce((s, t) => s + t.left + t.right, 0);
}

function canPlay(tile: Domino, leftEnd: number, rightEnd: number): boolean {
  return (
    tile.left === leftEnd ||
    tile.right === leftEnd ||
    tile.left === rightEnd ||
    tile.right === rightEnd
  );
}

function lowestDouble(hand: Domino[]): Domino | undefined {
  return hand
    .filter((t) => t.left === t.right)
    .sort((a, b) => a.left - b.left)[0];
}

function aiPickTile(
  hand: Domino[],
  leftEnd: number,
  rightEnd: number
): Domino | null {
  const valid = hand.filter((t) => canPlay(t, leftEnd, rightEnd));
  if (!valid.length) return null;
  return valid.sort((a, b) => b.left + b.right - (a.left + a.right))[0];
}

function calcEnds(ch: ChainTile[]): { leftEnd: number; rightEnd: number } {
  if (ch.length === 0) return { leftEnd: -1, rightEnd: -1 };
  const first = ch[0];
  const last = ch[ch.length - 1];
  return {
    leftEnd:
      first.orientation === "normal" ? first.domino.left : first.domino.right,
    rightEnd:
      last.orientation === "normal" ? last.domino.right : last.domino.left,
  };
}

function appendToChain(
  ch: ChainTile[],
  tile: Domino,
  onLeft: boolean,
  leftEnd: number,
  rightEnd: number
): ChainTile[] | null {
  const end = onLeft ? leftEnd : rightEnd;
  let orientation: "normal" | "flipped";
  if (onLeft) {
    if (tile.right === end) orientation = "normal";
    else if (tile.left === end) orientation = "flipped";
    else return null;
  } else {
    if (tile.left === end) orientation = "normal";
    else if (tile.right === end) orientation = "flipped";
    else return null;
  }
  const ct: ChainTile = { domino: tile, orientation };
  return onLeft ? [ct, ...ch] : [...ch, ct];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WIN_SCORE = 100;

// ─── Pip dot positions ────────────────────────────────────────────────────────
const DOT_POS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

// ─── Domino Tile Component ────────────────────────────────────────────────────
function DominoTile({
  left,
  right,
  horizontal = true,
  faceDown = false,
  highlight = false,
  selected = false,
  onClick,
  small = false,
}: {
  left: number;
  right: number;
  horizontal?: boolean;
  faceDown?: boolean;
  highlight?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const sw = small ? 28 : 36;
  const sh = small ? 14 : 18;
  const dotR = small ? 2.5 : 3.5;

  if (faceDown) {
    return (
      <div
        style={{
          width: horizontal ? sw * 2 + 3 : sh,
          height: horizontal ? sh : sw * 2 + 3,
          background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
          borderRadius: 4,
          border: "2px solid #3949ab",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          flexShrink: 0,
        }}
      />
    );
  }

  const HalfTile = ({ value }: { value: number }) => {
    const positions = DOT_POS[value] || [];
    return (
      <div
        style={{
          width: horizontal ? sw : sh,
          height: horizontal ? sh : sw,
          position: "relative",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {positions.map(([x, y], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: dotR * 2,
              height: dotR * 2,
              borderRadius: "50%",
              background: "#1a1a2e",
              left: `calc(${x}% - ${dotR}px)`,
              top: `calc(${y}% - ${dotR}px)`,
            }}
          />
        ))}
      </div>
    );
  };

  const dividerStyle: React.CSSProperties = horizontal
    ? {
        width: 2,
        height: sh * 0.7,
        background: "#999",
        borderRadius: 1,
        flexShrink: 0,
      }
    : {
        width: sw * 0.7,
        height: 2,
        background: "#999",
        borderRadius: 1,
        flexShrink: 0,
      };

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        background: "white",
        border: `2px solid ${
          highlight ? "#00e676" : selected ? "#ffd700" : "#999"
        }`,
        borderRadius: 5,
        boxShadow: highlight
          ? "0 0 12px #00e676, 0 2px 6px rgba(0,0,0,0.3)"
          : "0 2px 6px rgba(0,0,0,0.3)",
        cursor: onClick ? "pointer" : "default",
        transform:
          highlight && onClick
            ? "translateY(-5px)"
            : selected
            ? "translateY(-3px)"
            : "none",
        transition: "transform 0.15s, box-shadow 0.15s",
        padding: "2px 3px",
        gap: 2,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <HalfTile value={left} />
      <div style={dividerStyle} />
      <HalfTile value={right} />
    </div>
  );
}

// ─── Game State Interface ─────────────────────────────────────────────────────
interface GameState {
  playerHand: Domino[];
  aiHand: Domino[];
  boneyard: Domino[];
  chain: ChainTile[];
  leftEnd: number;
  rightEnd: number;
  isPlayerTurn: boolean;
  passCount: number;
  canDraw: boolean;
  message: string;
  playerScore: number;
  aiScore: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DominoGame() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [gs, setGs] = useState<GameState>({
    playerHand: [],
    aiHand: [],
    boneyard: [],
    chain: [],
    leftEnd: -1,
    rightEnd: -1,
    isPlayerTurn: true,
    passCount: 0,
    canDraw: false,
    message: "",
    playerScore: 0,
    aiScore: 0,
  });
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState("");
  const chainRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
  };

  // ── Check round end ──────────────────────────────────────────────────────────
  const checkRoundEnd = useCallback(
    (state: GameState): boolean => {
      const { playerHand, aiHand, passCount, playerScore, aiScore } = state;
      if (playerHand.length === 0) {
        const bonus = pipCount(aiHand);
        const newPs = playerScore + bonus;
        setRoundResult(
          `You win the round! +${bonus} points (AI's remaining pips)`
        );
        setGs((g) => ({ ...g, playerScore: newPs }));
        setPhase(
          newPs >= WIN_SCORE || aiScore >= WIN_SCORE ? "gameOver" : "roundEnd"
        );
        return true;
      }
      if (aiHand.length === 0) {
        const bonus = pipCount(playerHand);
        const newAs = aiScore + bonus;
        setRoundResult(
          `AI wins the round! +${bonus} points (your remaining pips)`
        );
        setGs((g) => ({ ...g, aiScore: newAs }));
        setPhase(
          playerScore >= WIN_SCORE || newAs >= WIN_SCORE
            ? "gameOver"
            : "roundEnd"
        );
        return true;
      }
      if (passCount >= 2) {
        const pPips = pipCount(playerHand);
        const aPips = pipCount(aiHand);
        if (pPips < aPips) {
          const bonus = aPips - pPips;
          const newPs = playerScore + bonus;
          setRoundResult(
            `Blocked! You win with lower pips. +${bonus} points`
          );
          setGs((g) => ({ ...g, playerScore: newPs }));
          setPhase(
            newPs >= WIN_SCORE || aiScore >= WIN_SCORE
              ? "gameOver"
              : "roundEnd"
          );
        } else if (aPips < pPips) {
          const bonus = pPips - aPips;
          const newAs = aiScore + bonus;
          setRoundResult(
            `Blocked! AI wins with lower pips. +${bonus} points to AI`
          );
          setGs((g) => ({ ...g, aiScore: newAs }));
          setPhase(
            playerScore >= WIN_SCORE || newAs >= WIN_SCORE
              ? "gameOver"
              : "roundEnd"
          );
        } else {
          setRoundResult("Blocked — tie round! No points awarded.");
          setPhase("roundEnd");
        }
        return true;
      }
      return false;
    },
    []
  );

  // ── Deal ─────────────────────────────────────────────────────────────────────
  const deal = useCallback(
    (playerScore: number, aiScore: number) => {
      const tiles = shuffle(buildSet());
      const playerHand = tiles.slice(0, 7);
      const aiHand = tiles.slice(7, 14);
      const boneyard = tiles.slice(14);

      const pDouble = lowestDouble(playerHand);
      const aDouble = lowestDouble(aiHand);

      let chain: ChainTile[] = [];
      let leftEnd = -1;
      let rightEnd = -1;
      let finalPlayerHand = playerHand;
      let finalAiHand = aiHand;
      let isPlayerTurn = true;
      let message = "";

      if (pDouble && (!aDouble || pDouble.left <= aDouble.left)) {
        chain = [{ domino: pDouble, orientation: "normal" }];
        leftEnd = pDouble.left;
        rightEnd = pDouble.right;
        finalPlayerHand = playerHand.filter((t) => t.id !== pDouble.id);
        isPlayerTurn = false;
        message = `You started with ${pDouble.left}|${pDouble.left}. AI's turn.`;
      } else if (aDouble) {
        chain = [{ domino: aDouble, orientation: "normal" }];
        leftEnd = aDouble.left;
        rightEnd = aDouble.right;
        finalAiHand = aiHand.filter((t) => t.id !== aDouble.id);
        isPlayerTurn = false;
        message = `AI started with ${aDouble.left}|${aDouble.left}.`;
      } else {
        isPlayerTurn = true;
        message = "No doubles! You go first — play any tile.";
      }

      setSelectedTile(null);
      setGs({
        playerHand: finalPlayerHand,
        aiHand: finalAiHand,
        boneyard,
        chain,
        leftEnd,
        rightEnd,
        isPlayerTurn,
        passCount: 0,
        canDraw: false,
        message,
        playerScore,
        aiScore,
      });
      setPhase("playing");
    },
    []
  );

  // ── Place tile onto chain (pure function) ────────────────────────────────────
  function placeTileOnChain(
    tile: Domino,
    chain: ChainTile[],
    leftEnd: number,
    rightEnd: number
  ): { chain: ChainTile[]; leftEnd: number; rightEnd: number } | null {
    if (chain.length === 0) {
      const newChain: ChainTile[] = [
        { domino: tile, orientation: "normal" },
      ];
      return { chain: newChain, leftEnd: tile.left, rightEnd: tile.right };
    }
    // Try right end first
    const rightResult = appendToChain(chain, tile, false, leftEnd, rightEnd);
    if (rightResult) {
      const ends = calcEnds(rightResult);
      return { chain: rightResult, ...ends };
    }
    // Try left end
    const leftResult = appendToChain(chain, tile, true, leftEnd, rightEnd);
    if (leftResult) {
      const ends = calcEnds(leftResult);
      return { chain: leftResult, ...ends };
    }
    return null;
  }

  // ── Human: click tile ────────────────────────────────────────────────────────
  const handleTileClick = (tile: Domino) => {
    if (!gs.isPlayerTurn || phase !== "playing") return;

    const { chain, leftEnd, rightEnd, playerHand, aiHand, passCount, playerScore, aiScore } = gs;

    // First move (no chain yet) — any tile is valid
    if (chain.length === 0) {
      const result = placeTileOnChain(tile, chain, leftEnd, rightEnd);
      if (!result) return;
      const newPlayerHand = playerHand.filter((t) => t.id !== tile.id);
      const newState: GameState = {
        ...gs,
        chain: result.chain,
        leftEnd: result.leftEnd,
        rightEnd: result.rightEnd,
        playerHand: newPlayerHand,
        isPlayerTurn: false,
        canDraw: false,
        passCount: 0,
        message: "AI's turn...",
        selectedTile: null,
      } as GameState & { selectedTile: null };
      setSelectedTile(null);
      if (!checkRoundEnd({ ...newState, passCount: 0 })) setGs(newState);
      return;
    }

    if (!canPlay(tile, leftEnd, rightEnd)) return;

    // Two-click mechanic: first click selects, second plays
    if (selectedTile !== tile.id) {
      setSelectedTile(tile.id);
      return;
    }

    const result = placeTileOnChain(tile, chain, leftEnd, rightEnd);
    if (!result) { setSelectedTile(null); return; }

    const newPlayerHand = playerHand.filter((t) => t.id !== tile.id);
    const newState: GameState = {
      ...gs,
      chain: result.chain,
      leftEnd: result.leftEnd,
      rightEnd: result.rightEnd,
      playerHand: newPlayerHand,
      isPlayerTurn: false,
      canDraw: false,
      passCount: 0,
      message: "AI's turn...",
    };
    setSelectedTile(null);
    if (!checkRoundEnd(newState)) setGs(newState);
  };

  // ── Human: draw ──────────────────────────────────────────────────────────────
  const handleDraw = () => {
    if (!gs.isPlayerTurn || gs.boneyard.length === 0) return;
    const drawn = gs.boneyard[0];
    const newBoneyard = gs.boneyard.slice(1);
    const newHand = [...gs.playerHand, drawn];

    if (canPlay(drawn, gs.leftEnd, gs.rightEnd)) {
      setGs({
        ...gs,
        playerHand: newHand,
        boneyard: newBoneyard,
        canDraw: false,
        message: "Drew a tile — now play it or another valid tile.",
      });
    } else if (newBoneyard.length === 0) {
      const newPassCount = gs.passCount + 1;
      const newState: GameState = {
        ...gs,
        playerHand: newHand,
        boneyard: newBoneyard,
        canDraw: false,
        passCount: newPassCount,
        isPlayerTurn: false,
        message: "Boneyard empty — passing turn.",
      };
      if (!checkRoundEnd(newState)) setGs(newState);
    } else {
      setGs({
        ...gs,
        playerHand: newHand,
        boneyard: newBoneyard,
        message: "No match yet — draw again.",
      });
    }
  };

  // ── AI turn ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || gs.isPlayerTurn) return;

    clearTimer();
    aiTimerRef.current = setTimeout(() => {
      setGs((prev) => {
        let { aiHand, boneyard, chain, leftEnd, rightEnd, passCount, playerHand, playerScore, aiScore } = prev;

        // First tile situation
        if (chain.length === 0) {
          const ld = lowestDouble(aiHand) || aiHand[0];
          if (!ld) {
            return { ...prev, isPlayerTurn: true, message: "Your turn — play any tile." };
          }
          const newChain: ChainTile[] = [{ domino: ld, orientation: "normal" }];
          const newAiHand = aiHand.filter((t) => t.id !== ld.id);
          const newState: GameState = {
            ...prev,
            chain: newChain,
            leftEnd: ld.left,
            rightEnd: ld.right,
            aiHand: newAiHand,
            isPlayerTurn: true,
            passCount: 0,
            message: `AI played ${ld.left}|${ld.left}. Your turn.`,
          };
          checkRoundEnd(newState);
          return newState;
        }

        // Try to play
        let played = aiPickTile(aiHand, leftEnd, rightEnd);
        if (played) {
          const result = placeTileOnChain(played, chain, leftEnd, rightEnd);
          if (!result) {
            // Shouldn't happen, but handle gracefully
            return { ...prev, isPlayerTurn: true, message: "Your turn." };
          }
          const newAiHand = aiHand.filter((t) => t.id !== played!.id);
          const hasValidForPlayer = playerHand.some((t) =>
            canPlay(t, result.leftEnd, result.rightEnd)
          );
          const newState: GameState = {
            ...prev,
            chain: result.chain,
            leftEnd: result.leftEnd,
            rightEnd: result.rightEnd,
            aiHand: newAiHand,
            isPlayerTurn: true,
            passCount: 0,
            canDraw: !hasValidForPlayer && boneyard.length > 0,
            message: hasValidForPlayer
              ? `AI played ${played.left}|${played.right}. Your turn — play a highlighted tile.`
              : boneyard.length > 0
              ? `AI played ${played.left}|${played.right}. No valid tiles — draw from boneyard.`
              : `AI played ${played.left}|${played.right}. No moves available — pass.`,
          };
          if (!checkRoundEnd(newState)) {
            if (!hasValidForPlayer && boneyard.length === 0) {
              const passState: GameState = { ...newState, isPlayerTurn: false, passCount: newState.passCount + 1 };
              if (!checkRoundEnd(passState)) return passState;
              return passState;
            }
          }
          return newState;
        }

        // Draw from boneyard until can play or empty
        let drew = false;
        while (boneyard.length > 0) {
          const drawn = boneyard[0];
          boneyard = boneyard.slice(1);
          aiHand = [...aiHand, drawn];
          if (canPlay(drawn, leftEnd, rightEnd)) {
            // Play drawn tile
            const result = placeTileOnChain(drawn, chain, leftEnd, rightEnd);
            if (result) {
              chain = result.chain;
              leftEnd = result.leftEnd;
              rightEnd = result.rightEnd;
              aiHand = aiHand.filter((t) => t.id !== drawn.id);
              drew = true;
              played = drawn;
              break;
            }
          }
        }

        if (drew && played) {
          const hasValidForPlayer = playerHand.some((t) =>
            canPlay(t, leftEnd, rightEnd)
          );
          const newState: GameState = {
            ...prev,
            chain,
            leftEnd,
            rightEnd,
            aiHand,
            boneyard,
            isPlayerTurn: true,
            passCount: 0,
            canDraw: !hasValidForPlayer && boneyard.length > 0,
            message: `AI drew and played ${played.left}|${played.right}. Your turn.`,
          };
          if (!checkRoundEnd(newState)) return newState;
          return newState;
        }

        // AI passes
        const newPassCount = passCount + 1;
        const hasValidForPlayer = playerHand.some((t) =>
          canPlay(t, leftEnd, rightEnd)
        );
        const newState: GameState = {
          ...prev,
          aiHand,
          boneyard,
          isPlayerTurn: true,
          passCount: newPassCount,
          canDraw: !hasValidForPlayer && boneyard.length > 0,
          message: "AI has no moves — passing. Your turn.",
        };
        if (!checkRoundEnd(newState)) return newState;
        return newState;

        function placeTileOnChain(
          tile: Domino,
          ch: ChainTile[],
          le: number,
          re: number
        ): { chain: ChainTile[]; leftEnd: number; rightEnd: number } | null {
          if (ch.length === 0) {
            return {
              chain: [{ domino: tile, orientation: "normal" }],
              leftEnd: tile.left,
              rightEnd: tile.right,
            };
          }
          const rightResult = appendToChain(ch, tile, false, le, re);
          if (rightResult) return { chain: rightResult, ...calcEnds(rightResult) };
          const leftResult = appendToChain(ch, tile, true, le, re);
          if (leftResult) return { chain: leftResult, ...calcEnds(leftResult) };
          return null;
        }
      });
    }, 800);

    return clearTimer;
  }, [gs.isPlayerTurn, phase, checkRoundEnd]);

  // ── Scroll chain ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (chainRef.current) {
      chainRef.current.scrollLeft = chainRef.current.scrollWidth;
    }
  }, [gs.chain]);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (phase === "menu") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #1b2838 0%, #2a475e 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', sans-serif",
          color: "#fff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 8 }}>🁣</div>
        <h1
          style={{
            fontSize: 42,
            color: "#ffd700",
            margin: "0 0 8px",
            textShadow: "0 0 20px rgba(255,215,0,0.5)",
          }}
        >
          Dominoes
        </h1>
        <p style={{ color: "#90caf9", margin: "0 0 32px" }}>
          Classic Draw Game — First to {WIN_SCORE} points wins!
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 32,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <DominoTile key={n} left={n} right={n} horizontal small />
          ))}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            padding: "20px 28px",
            border: "1px solid rgba(255,255,255,0.1)",
            maxWidth: 380,
            width: "100%",
            marginBottom: 28,
          }}
        >
          <h3
            style={{
              margin: "0 0 12px",
              color: "#ffd700",
              textAlign: "center",
            }}
          >
            How to Play
          </h3>
          <ul
            style={{
              color: "#b0bec5",
              lineHeight: 1.9,
              paddingLeft: 20,
              margin: 0,
              fontSize: 14,
            }}
          >
            <li>7 tiles each, rest in boneyard</li>
            <li>Lowest double goes first</li>
            <li>Match tile ends to play</li>
            <li>No match? Draw from boneyard</li>
            <li>Win round: +opponent's pip count</li>
            <li>Block win: lower pip total wins</li>
            <li>First to {WIN_SCORE} points wins!</li>
          </ul>
        </div>

        <button
          onClick={() => deal(0, 0)}
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
          }}
        >
          Play Now
        </button>
      </div>
    );
  }

  if (phase === "roundEnd" || phase === "gameOver") {
    const isGame = phase === "gameOver";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #1b2838 0%, #2a475e 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', sans-serif",
          color: "#fff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 64 }}>{isGame ? "🏆" : "🎯"}</div>
        <h1 style={{ fontSize: 32, color: "#ffd700", margin: "8px 0" }}>
          {isGame ? "Game Over!" : "Round Complete!"}
        </h1>
        <p
          style={{
            color: "#e0e0e0",
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          {roundResult}
        </p>

        <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
          {[
            { name: "You", score: gs.playerScore },
            { name: "AI", score: gs.aiScore },
          ].map((p) => (
            <div
              key={p.name}
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "20px 32px",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: "bold",
                  color: "#ffd700",
                }}
              >
                {p.score}
              </div>
              <div style={{ fontSize: 12, color: "#90caf9" }}>
                / {WIN_SCORE} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 8,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  overflow: "hidden",
                  width: 120,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (p.score / WIN_SCORE) * 100
                    )}%`,
                    height: "100%",
                    background: "#ffd700",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {isGame ? (
          <button
            onClick={() => setPhase("menu")}
            style={{
              padding: "14px 48px",
              background:
                "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
              color: "#1a1a2e",
              border: "none",
              borderRadius: 12,
              fontSize: 18,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Main Menu
          </button>
        ) : (
          <button
            onClick={() => deal(gs.playerScore, gs.aiScore)}
            style={{
              padding: "14px 48px",
              background:
                "linear-gradient(135deg, #ffd700 0%, #ff9800 100%)",
              color: "#1a1a2e",
              border: "none",
              borderRadius: 12,
              fontSize: 18,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Next Round
          </button>
        )}
      </div>
    );
  }

  // ─── Playing ───────────────────────────────────────────────────────────────
  const playerValidTiles =
    gs.isPlayerTurn && gs.chain.length > 0
      ? new Set(
          gs.playerHand
            .filter((t) => canPlay(t, gs.leftEnd, gs.rightEnd))
            .map((t) => t.id)
        )
      : gs.chain.length === 0 && gs.isPlayerTurn
      ? new Set(gs.playerHand.map((t) => t.id))
      : new Set<string>();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1b2838 0%, #2a475e 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', sans-serif",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
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
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← Menu
        </button>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#90caf9" }}>You</div>
            <div
              style={{
                fontWeight: "bold",
                color: "#ffd700",
                fontSize: 20,
              }}
            >
              {gs.playerScore}
            </div>
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#666",
              alignSelf: "center",
            }}
          >
            vs
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#90caf9" }}>AI</div>
            <div
              style={{
                fontWeight: "bold",
                color: "#e74c3c",
                fontSize: 20,
              }}
            >
              {gs.aiScore}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#90caf9" }}>Boneyard</div>
          <div style={{ fontWeight: "bold" }}>
            {gs.boneyard.length} tiles
          </div>
        </div>
      </div>

      {/* AI hand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 16px",
          gap: 4,
          minHeight: 80,
          background: "rgba(0,0,0,0.2)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{ fontSize: 13, color: "#90caf9", marginRight: 8 }}
        >
          AI ({gs.aiHand.length})
        </div>
        {gs.aiHand.map((t) => (
          <DominoTile
            key={t.id}
            left={t.left}
            right={t.right}
            faceDown
            small
          />
        ))}
        {!gs.isPlayerTurn && (
          <div
            style={{
              marginLeft: 12,
              fontSize: 13,
              color: "#ffd700",
              animation: "pulse 1s infinite",
            }}
          >
            thinking...
          </div>
        )}
      </div>

      {/* Chain area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "8px",
          minHeight: 120,
        }}
      >
        {gs.message && (
          <div
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#e0e0e0",
              marginBottom: 8,
              padding: "4px 16px",
            }}
          >
            {gs.message}
          </div>
        )}

        {gs.chain.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: 16,
              padding: 32,
              border: "2px dashed rgba(255,255,255,0.1)",
              borderRadius: 12,
              margin: "0 16px",
            }}
          >
            {gs.isPlayerTurn
              ? "Play any tile to start the chain"
              : "Waiting for AI to start..."}
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
                padding: "0 16px",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "3px 12px",
                  fontSize: 14,
                  color: "#ffd700",
                  border: "1px solid rgba(255,215,0,0.3)",
                }}
              >
                ← {gs.leftEnd}
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "3px 12px",
                  fontSize: 14,
                  color: "#ffd700",
                  border: "1px solid rgba(255,215,0,0.3)",
                }}
              >
                {gs.rightEnd} →
              </div>
            </div>
            <div
              ref={chainRef}
              style={{
                display: "flex",
                gap: 3,
                overflowX: "auto",
                overflowY: "visible",
                padding: "8px 16px",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.2) transparent",
              }}
            >
              {gs.chain.map(({ domino, orientation }, i) => {
                const l =
                  orientation === "normal" ? domino.left : domino.right;
                const r =
                  orientation === "normal" ? domino.right : domino.left;
                return (
                  <DominoTile
                    key={`${domino.id}-${i}`}
                    left={l}
                    right={r}
                    horizontal
                    small
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Player hand */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: gs.isPlayerTurn ? "#00e676" : "#90caf9",
              fontWeight: "bold",
            }}
          >
            {gs.isPlayerTurn ? "Your Turn" : "Waiting..."}
          </span>
          <span style={{ fontSize: 12, color: "#666" }}>
            ({gs.playerHand.length} tiles)
          </span>
          {gs.canDraw && gs.boneyard.length > 0 && (
            <button
              onClick={handleDraw}
              style={{
                marginLeft: "auto",
                padding: "6px 16px",
                background: "rgba(0,180,216,0.2)",
                color: "#00b4d8",
                border: "1px solid #00b4d8",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: "bold",
              }}
            >
              Draw ({gs.boneyard.length})
            </button>
          )}
          {selectedTile && (
            <div
              style={{
                marginLeft: "auto",
                fontSize: 12,
                color: "#ffd700",
              }}
            >
              Click the same tile again to play it
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            minHeight: 56,
          }}
        >
          {gs.playerHand.map((tile) => {
            const isValid = playerValidTiles.has(tile.id);
            const isSel = selectedTile === tile.id;
            return (
              <DominoTile
                key={tile.id}
                left={tile.left}
                right={tile.right}
                highlight={isValid && gs.isPlayerTurn}
                selected={isSel}
                onClick={
                  gs.isPlayerTurn ? () => handleTileClick(tile) : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
