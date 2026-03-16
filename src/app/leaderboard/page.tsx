import { Metadata } from "next"
import { createServerClient } from "@/lib/supabase-server"
import { GAMES } from "@/lib/games"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Leaderboard | ArcadeVerse",
  description: "Top scores across all ArcadeVerse games. Compete globally!",
}

export const revalidate = 60

async function getLeaderboard(gameId?: string) {
  const supabase = await createServerClient()
  let query = supabase
    .from("scores")
    .select("score, game_id, created_at, profiles(username, avatar_url)")
    .order("score", { ascending: false })
    .limit(50)

  if (gameId) query = query.eq("game_id", gameId)
  const { data } = await query
  return data || []
}

async function getTopScorers() {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from("profiles")
    .select("username, total_score, games_played, avatar_url")
    .order("total_score", { ascending: false })
    .limit(20)
  return data || []
}

export default async function LeaderboardPage({ searchParams }: { searchParams?: { game?: string } }) {
  const gameId = searchParams?.game
  const [scores, topScorers] = await Promise.all([getLeaderboard(gameId), getTopScorers()])
  const game = gameId ? GAMES.find(g => g.id === gameId) : null

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-orbitron sec-title mb-3">
          {game ? `${game.icon} ${game.title}` : "🏆 Global Leaderboard"}
        </h1>
        <p className="text-space-muted font-rajdhani">
          {game ? `Top scores for ${game.title}` : "Top players across all ArcadeVerse games"}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Top Scores */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-orbitron text-neon-purple mb-4">
            {game ? "Best Scores" : "Latest High Scores"}
          </h2>
          {!gameId && (
            <div className="flex flex-wrap gap-2 mb-6">
              <Link href="/leaderboard" className={"text-xs px-3 py-1 rounded-full border transition-all " + (!gameId ? "border-neon-purple bg-neon-purple/20 text-white" : "border-space-border text-space-muted hover:border-neon-purple/50")}>All Games</Link>
              {GAMES.filter(g => g.type === "canvas").slice(0, 10).map(g => (
                <Link key={g.id} href={`/leaderboard?game=${g.id}`}
                  className={"text-xs px-3 py-1 rounded-full border transition-all border-space-border text-space-muted hover:border-neon-purple/50"}>
                  {g.icon} {g.title}
                </Link>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {scores.length === 0 ? (
              <div className="card-space p-8 text-center">
                <div className="text-4xl mb-3">🎮</div>
                <p className="text-space-muted font-rajdhani">No scores yet. Be the first to play!</p>
                <Link href="/games" className="btn-primary mt-4 inline-block px-6 py-2">Browse Games</Link>
              </div>
            ) : (scores as { score: number; game_id: string; created_at: string; profiles: { username: string; avatar_url: string }[] | null }[]).map((s, i) => {
              const g = GAMES.find(gm => gm.id === s.game_id)
              const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
              return (
                <div key={i} className={"flex items-center gap-4 p-4 rounded-xl border transition-all " + (i < 3 ? "border-neon-yellow/30 bg-neon-yellow/5" : "border-space-border bg-space-surface hover:border-neon-purple/30")}>
                  <div className={"w-8 h-8 flex items-center justify-center font-orbitron font-bold rounded-full " + (i === 0 ? "bg-neon-yellow text-black" : i === 1 ? "bg-gray-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "text-space-muted text-sm")}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-neon-purple/20 flex items-center justify-center text-xs font-orbitron text-neon-purple">
                    {(profile?.username || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-rajdhani font-semibold text-white truncate">{profile?.username || "Anonymous"}</div>
                    {!gameId && g && <div className="text-xs text-space-muted">{g.icon} {g.title}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-orbitron font-bold text-neon-purple">{s.score.toLocaleString()}</div>
                    <div className="text-xs text-space-muted">{new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Players */}
        <div>
          <h2 className="text-xl font-orbitron text-neon-blue mb-4">Top Players</h2>
          <div className="space-y-2">
            {topScorers.map((p: { username: string; total_score: number; games_played: number }, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-space-border bg-space-surface hover:border-neon-blue/30 transition-all">
                <div className="w-6 text-center font-orbitron text-xs text-space-muted">{i + 1}</div>
                <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center text-xs font-orbitron text-neon-blue">
                  {(p.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-rajdhani font-semibold text-white text-sm truncate">{p.username}</div>
                  <div className="text-xs text-space-muted">{p.games_played} games</div>
                </div>
                <div className="font-orbitron text-sm text-neon-blue">{(p.total_score || 0).toLocaleString()}</div>
              </div>
            ))}
            {topScorers.length === 0 && (
              <div className="card-space p-6 text-center">
                <p className="text-space-muted text-sm font-rajdhani">Create an account to appear here!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}