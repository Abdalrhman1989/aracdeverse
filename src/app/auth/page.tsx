"use client"
import { useState, useCallback, useMemo } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

export const dynamic = 'force-dynamic'

export default function AuthPage() {
  const [mode, setMode] = useState<"login"|"signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  ), [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success("Welcome back!")
        router.push("/")
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success("Account created! Check your email to verify.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed")
    } finally {
      setLoading(false)
    }
  }, [mode, email, password, supabase, router])

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🚀</div>
          <h1 className="text-3xl font-orbitron text-neon-purple">
            {mode === "login" ? "Welcome Back" : "Join ArcadeVerse"}
          </h1>
          <p className="text-space-muted mt-2 font-rajdhani">
            {mode === "login" ? "Sign in to save scores and compete" : "Create your account to get started"}
          </p>
        </div>
        <div className="card-space p-8">
          <div className="flex rounded-lg bg-space-bg p-1 mb-6">
            {(["login", "signup"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={"flex-1 py-2 rounded-md text-sm font-rajdhani font-semibold transition-all " + (mode === m ? "bg-neon-purple text-white" : "text-space-muted hover:text-white")}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-rajdhani text-space-muted mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="input-space w-full" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-rajdhani text-space-muted mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="input-space w-full" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
              {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
          <p className="text-center text-space-muted text-sm mt-4 font-rajdhani">
            {mode === "login" ? "No account? " : "Already have one? "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-neon-purple hover:text-neon-blue transition-colors">
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="text-center text-xs text-space-muted mt-6 font-rajdhani">
          Play as guest • No account required for games
        </p>
      </div>
    </main>
  )
}