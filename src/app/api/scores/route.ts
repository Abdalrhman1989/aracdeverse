import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { GAMES } from "@/lib/games"

// Max reasonable scores per game (anti-cheat)
const MAX_SCORES: Record<string, number> = {
  snake: 5000, tetris: 100000, "2048": 50000, flappy: 500,
  "space-shooter": 20000, "brick-breaker": 15000, "memory-match": 2000,
  "dino-run": 3000, "whack-a-mole": 1500, "fruit-catcher": 2000,
  default: 99999999,
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { gameId, score } = body

    if (!gameId || typeof score !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const game = GAMES.find(g => g.id === gameId)
    if (!game) return NextResponse.json({ error: "Unknown game" }, { status: 400 })

    const maxScore = MAX_SCORES[gameId] ?? MAX_SCORES.default
    if (score < 0 || score > maxScore) {
      return NextResponse.json({ error: "Score out of range" }, { status: 400 })
    }

    const { error } = await supabase.from("scores").insert({ user_id: user.id, game_id: gameId, score })
    if (error) throw error

    // Update total_score on profile
    await supabase.rpc("increment_profile_score", { uid: user.id, pts: score }).maybeSingle()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Score submission error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get("gameId")
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100)

  const supabase = await createServerClient()
  let query = supabase
    .from("scores")
    .select("score, game_id, created_at, profiles(username)")
    .order("score", { ascending: false })
    .limit(limit)

  if (gameId) query = query.eq("game_id", gameId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scores: data })
}