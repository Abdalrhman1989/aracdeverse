"use client"
import React, { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import type { GameMeta } from "@/types/game"
import type { CategoryInfo } from "@/lib/games"
import { GameCard } from "@/components/ui/GameCard"
import { GameGrid } from "@/components/ui/GameGrid"
import { Zap, Users, Globe, Trophy, Star, Play, ChevronRight, Sparkles, TrendingUp, Gamepad2, Shield, Clock, Volume2, VolumeX } from "lucide-react"

interface Top10Item { rank: number; id: string; icon: string; name: string; genre: string; plays: string; color: string }
interface Props {
  featuredGame: GameMeta
  hotGames: GameMeta[]
  multiGames: GameMeta[]
  newGames: GameMeta[]
  topGames: GameMeta[]
  marqueeGames: GameMeta[]
  top10: Top10Item[]
  categories: CategoryInfo[]
  totalGames: number
}

// ─── 3D Tilt Card Wrapper ─────────────────────────────────────────────────────
function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale3d(1.02,1.02,1.02)`
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)'
  }, [])
  return (
    <div ref={ref} className={className} style={{ ...style, transition: 'transform 0.15s ease', transformStyle: 'preserve-3d', willChange: 'transform' }}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  )
}

// ─── Particle canvas ──────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    window.addEventListener("resize", onResize)
    interface Particle { x:number;y:number;vx:number;vy:number;r:number;alpha:number;color:string;pulse:number }
    const colors = ["#8b5cf6","#06b6d4","#10b981","#f97316","#ec4899","#fbbf24"]
    const particles: Particle[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2 + 0.5, alpha: Math.random() * 0.5 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
      pulse: Math.random() * Math.PI * 2
    }))
    let raf: number; let t = 0
    const animate = () => {
      t += 0.01
      ctx.clearRect(0, 0, w, h)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.02
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        const r = p.r * (0.8 + 0.4 * Math.sin(p.pulse))
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
      })
      ctx.lineWidth = 0.3
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 100) {
            ctx.globalAlpha = (1 - d / 100) * 0.12
            ctx.strokeStyle = "#8b5cf6"
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.55 }} />
}

// ─── Floating orbs ────────────────────────────────────────────────────────────
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[
        { size: 600, x: "8%",   y: "18%",  color: "rgba(139,92,246,0.13)", delay: 0 },
        { size: 450, x: "82%",  y: "8%",   color: "rgba(6,182,212,0.11)",  delay: 2 },
        { size: 380, x: "62%",  y: "72%",  color: "rgba(236,72,153,0.09)", delay: 4 },
        { size: 320, x: "4%",   y: "78%",  color: "rgba(16,185,129,0.09)", delay: 1 },
        { size: 280, x: "92%",  y: "58%",  color: "rgba(249,115,22,0.09)", delay: 3 },
        { size: 200, x: "50%",  y: "40%",  color: "rgba(251,191,36,0.07)", delay: 5 },
      ].map((orb, i) => (
        <div key={i} className="absolute rounded-full blur-3xl animate-orb"
          style={{ width: orb.size, height: orb.size, left: orb.x, top: orb.y, background: orb.color, animationDelay: `${orb.delay}s`, transform: "translate(-50%,-50%)" }} />
      ))}
    </div>
  )
}

// ─── Marquee ──────────────────────────────────────────────────────────────────
function GameMarquee({ games }: { games: GameMeta[] }) {
  const doubled = [...games, ...games]
  return (
    <div className="relative overflow-hidden py-3 my-2" style={{ maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)" }}>
      <div className="flex gap-3 animate-marquee" style={{ width: "max-content" }}>
        {doubled.map((g, i) => (
          <Link key={i} href={`/play/${g.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-full shrink-0 transition-all hover:scale-110 hover:brightness-125 group"
            style={{ background: `linear-gradient(135deg,${g.bgGradient[0]}CC,${g.bgGradient[1]}CC)`, border: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="text-base">{g.icon}</span>
            <span className="text-xs font-rajdhani font-bold text-white/80 group-hover:text-white whitespace-nowrap">{g.title}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, color, icon }: { value: string; label: string; color: string; icon: React.ReactNode }) {
  const [count, setCount] = useState("0")
  const target = value.replace(/[^0-9.]/g, "")
  const suffix = value.replace(/[0-9.]/g, "")
  useEffect(() => {
    let start = 0; const end = parseFloat(target); if (isNaN(end)) { setCount(value); return }
    const dur = 1800; const step = dur / 60
    const timer = setInterval(() => {
      start += end / (dur / step)
      if (start >= end) { setCount(value); clearInterval(timer) }
      else setCount(Math.floor(start) + suffix)
    }, step)
    return () => clearInterval(timer)
  }, [])
  return (
    <TiltCard className="relative flex flex-col items-center justify-center p-6 rounded-2xl overflow-hidden group cursor-default"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(10px)" }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}22, transparent 70%)` }} />
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ boxShadow: `0 0 30px ${color}33`, border: `1px solid ${color}44` }} />
      <div className="mb-2 opacity-60" style={{ color }}>{icon}</div>
      <span className="font-orbitron font-black text-3xl sm:text-4xl mb-1" style={{ color }}>{count}</span>
      <span className="text-xs text-white/40 uppercase tracking-widest font-rajdhani">{label}</span>
    </TiltCard>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, href, accentColor = "#8b5cf6" }: { icon?: string; title: string; href?: string; accentColor?: string }) {
  return (
    <div className="flex items-center justify-between mb-6 mt-16">
      <div className="flex items-center gap-3">
        <div className="w-1 h-7 rounded-full" style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }} />
        <h2 className="font-orbitron font-bold text-xl text-white">{icon} {title}</h2>
      </div>
      {href && (
        <Link href={href}
          className="flex items-center gap-1 text-sm font-rajdhani font-semibold transition-all hover:gap-2"
          style={{ color: accentColor }}>
          See All <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

// ─── Featured hero card ───────────────────────────────────────────────────────
function FeaturedCard({ game }: { game: GameMeta }) {
  const [hovered, setHovered] = useState(false)
  return (
    <TiltCard className="block relative rounded-3xl overflow-hidden cursor-pointer"
      style={{ background: `linear-gradient(135deg,${game.bgGradient[0]},${game.bgGradient[1]})`, border: "1px solid rgba(255,255,255,0.12)", minHeight: 280 }}>
      <Link href={`/play/${game.id}`} className="block h-full"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {/* Animated glow */}
        <div className="absolute inset-0 transition-opacity duration-500 rounded-3xl"
          style={{ background: `radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.4), transparent 60%)`, opacity: hovered ? 1 : 0.6 }} />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)" }} />
        <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto] min-h-[280px]">
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-rajdhani font-bold tracking-widest uppercase mb-5 w-fit"
              style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24" }}>
              <Star className="w-3 h-3 fill-current" /> Game of the Week
            </div>
            <h2 className="font-orbitron font-black text-4xl sm:text-5xl text-white mb-3 leading-tight">{game.title}</h2>
            <p className="text-white/60 text-sm mb-6 max-w-sm font-rajdhani leading-relaxed">{game.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-rajdhani font-bold text-white text-sm transition-all duration-300 group-hover:scale-105"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", boxShadow: hovered ? "0 10px 50px rgba(139,92,246,0.7)" : "0 4px 20px rgba(139,92,246,0.35)" }}>
                <Play className="w-4 h-4 fill-current" /> Play Free Now
              </div>
              <div className="flex items-center gap-1.5 text-neon-yellow text-sm font-rajdhani font-bold">
                <Star className="w-4 h-4 fill-current" /> {game.rating}
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center justify-center p-10 text-[130px] transition-transform duration-500"
            style={{ transform: hovered ? 'scale(1.15) rotate(8deg)' : 'scale(1) rotate(0deg)', filter: hovered ? 'drop-shadow(0 0 30px rgba(139,92,246,0.6))' : 'none' }}>
            {game.icon}
          </div>
        </div>
        <div className="absolute top-4 right-4 opacity-40">
          <Sparkles className="w-5 h-5 text-neon-yellow" />
        </div>
      </Link>
    </TiltCard>
  )
}

// ─── Category card (upgraded 3D) ─────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { color: string; bg: string; gradient: string; icon: string }> = {
  arcade:      { color: "#f97316", bg: "rgba(249,115,22,0.1)",   gradient: "linear-gradient(135deg,rgba(249,115,22,0.2),rgba(249,115,22,0.05))", icon: "🕹️" },
  puzzle:      { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",   gradient: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.05))", icon: "🧩" },
  action:      { color: "#ef4444", bg: "rgba(239,68,68,0.1)",    gradient: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.05))",    icon: "⚡" },
  racing:      { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   gradient: "linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,191,36,0.05))", icon: "🏎️" },
  sports:      { color: "#10b981", bg: "rgba(16,185,129,0.1)",   gradient: "linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.05))", icon: "⚽" },
  shooting:    { color: "#ef4444", bg: "rgba(239,68,68,0.1)",    gradient: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.05))",   icon: "🎯" },
  strategy:    { color: "#06b6d4", bg: "rgba(6,182,212,0.1)",    gradient: "linear-gradient(135deg,rgba(6,182,212,0.2),rgba(6,182,212,0.05))",   icon: "♟️" },
  multiplayer: { color: "#ec4899", bg: "rgba(236,72,153,0.1)",   gradient: "linear-gradient(135deg,rgba(236,72,153,0.2),rgba(236,72,153,0.05))", icon: "🌍" },
  cards:       { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   gradient: "linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,191,36,0.05))", icon: "🃏" },
  arabic:      { color: "#10b981", bg: "rgba(16,185,129,0.1)",   gradient: "linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.05))", icon: "🌙" },
  board:       { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",   gradient: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.05))", icon: "🎲" },
  retro:       { color: "#f97316", bg: "rgba(249,115,22,0.1)",   gradient: "linear-gradient(135deg,rgba(249,115,22,0.2),rgba(249,115,22,0.05))", icon: "👾" },
  sandbox:     { color: "#10b981", bg: "rgba(16,185,129,0.1)",   gradient: "linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.05))", icon: "🏗️" },
  all:         { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",   gradient: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.05))", icon: "🎮" },
}

function CategoryCard({ category }: { category: CategoryInfo }) {
  const cfg = CATEGORY_CONFIG[category.id] ?? CATEGORY_CONFIG.all
  return (
    <TiltCard className="cursor-pointer">
      <Link href={`/games/${category.id}`}
        className="flex flex-col items-center gap-3 p-5 rounded-2xl font-rajdhani font-semibold transition-all duration-200 hover:brightness-115 group text-center"
        style={{ background: cfg.gradient, border: `1px solid ${cfg.color}33`, color: cfg.color }}>
        {/* Glow ring on hover */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform duration-300 group-hover:scale-110"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}55`, boxShadow: `0 4px 20px ${cfg.color}20` }}>
            {cfg.icon}
          </div>
        </div>
        <span className="text-sm font-bold">{category.label}</span>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold"
          style={{ background: `${cfg.color}20`, color: cfg.color }}>{category.count} games</span>
      </Link>
    </TiltCard>
  )
}

// ─── Top 10 row ───────────────────────────────────────────────────────────────
function Top10Row({ item, index }: { item: Top10Item; index: number }) {
  const medals = ["🥇","🥈","🥉"]
  return (
    <Link href={`/play/${item.id}`}
      className="flex items-center gap-4 px-5 py-4 transition-all duration-200 hover:bg-white/[0.04] group border-b last:border-0"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <div className="w-8 text-center font-orbitron font-bold text-sm shrink-0">
        {index < 3 ? <span className="text-xl">{medals[index]}</span> : <span style={{ color: item.color }}>{item.rank}</span>}
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${item.color}20`, border: `1px solid ${item.color}40` }}>
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-orbitron font-bold text-sm text-white truncate group-hover:text-neon-purple transition-colors">{item.name}</div>
        <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: `${item.color}99` }}>{item.genre}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-rajdhani font-bold text-sm" style={{ color: item.color }}>{item.plays}</div>
        <div className="text-xs text-white/30">plays</div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all shrink-0" />
    </Link>
  )
}

// ─── Why section card ─────────────────────────────────────────────────────────
function WhyCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <TiltCard className="flex gap-4 p-5 rounded-2xl group transition-transform duration-200 cursor-default"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <div className="font-orbitron font-bold text-sm text-white mb-1">{title}</div>
        <div className="text-sm text-white/50 font-rajdhani leading-relaxed">{desc}</div>
      </div>
    </TiltCard>
  )
}

// ─── Neon glitch text ─────────────────────────────────────────────────────────
function GlitchText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} style={{ position: 'relative' }} data-text={text}>
      {text}
    </span>
  )
}

// ─── Main HomeClient ──────────────────────────────────────────────────────────
export default function HomeClient({ featuredGame, hotGames, multiGames, newGames, topGames, marqueeGames, top10, categories, totalGames }: Props) {
  const [online] = useState(() => 3200 + Math.floor(Math.random() * 400))
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      {/* Particle background */}
      <ParticleField />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-10 overflow-hidden">
        <FloatingOrbs />

        {/* Parallax grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)", backgroundSize: "60px 60px", transform: `translateY(${scrollY * 0.15}px)` }} />

        {/* Glow behind text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.2) 0%, transparent 65%)" }} />

        {/* Live badge */}
        <div className="relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-8 backdrop-blur-sm animate-float"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.35)" }}>
          <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          <span className="text-neon-green text-xs font-rajdhani font-bold tracking-widest uppercase">
            {online.toLocaleString()} Players Online Now
          </span>
        </div>

        {/* Main headline with 3D depth */}
        <h1 className="relative font-orbitron font-black text-5xl sm:text-7xl lg:text-8xl leading-[1.05] mb-6 max-w-5xl"
          style={{ textShadow: '0 0 80px rgba(139,92,246,0.4), 0 4px 30px rgba(0,0,0,0.5)' }}>
          <span className="text-white">The Ultimate </span>
          <span style={{ background: "linear-gradient(135deg, #fff 0%, #c4b5fd 25%, #8b5cf6 55%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>
            Browser Gaming
          </span>
          <br />
          <span className="text-white">Universe</span>
        </h1>

        {/* Subheadline */}
        <p className="relative text-white/50 text-lg sm:text-xl max-w-2xl mx-auto mb-10 font-rajdhani leading-relaxed">
          {totalGames}+ browser games — play instantly. Solo adventures, 2-player battles & live online multiplayer. Zero downloads. Always free.
        </p>

        {/* CTA buttons */}
        <div className="relative flex flex-wrap justify-center gap-4 mb-16">
          <Link href="/games"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-rajdhani font-bold text-lg text-white transition-all duration-300 hover:-translate-y-1 hover:scale-105"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", boxShadow: "0 4px 30px rgba(139,92,246,0.45)" }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 12px 60px rgba(139,92,246,0.75)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 30px rgba(139,92,246,0.45)")}>
            <Gamepad2 className="w-5 h-5" />
            Browse {totalGames}+ Games
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/games/multiplayer"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-rajdhani font-bold text-lg transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
            style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.4)", color: "#06b6d4" }}>
            <Globe className="w-5 h-5" />
            Online Multiplayer
          </Link>
          <Link href={`/play/${featuredGame.id}`}
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-rajdhani font-bold text-lg transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)" }}>
            <Play className="w-5 h-5 fill-current" />
            Play Now
          </Link>
        </div>

        {/* Stats */}
        <div className="relative w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard value="500+" label="Free Games"      color="#8b5cf6" icon={<Gamepad2 className="w-5 h-5" />} />
          <StatCard value="12M+" label="Monthly Players" color="#06b6d4" icon={<Users className="w-5 h-5" />} />
          <StatCard value="100%" label="Free Forever"    color="#10b981" icon={<Shield className="w-5 h-5" />} />
          <StatCard value="40+"  label="New Games Added" color="#fbbf24" icon={<Sparkles className="w-5 h-5" />} />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40 animate-bounce">
          <div className="text-xs text-white/60 font-rajdhani tracking-widest uppercase">Scroll to explore</div>
          <div className="w-5 h-8 rounded-full border border-white/30 flex items-start justify-center p-1.5">
            <div className="w-1 h-2 rounded-full bg-white/50 animate-scroll-dot" />
          </div>
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────── */}
      <div className="relative py-2" style={{ background: "linear-gradient(to right, transparent, rgba(139,92,246,0.07) 20%, rgba(139,92,246,0.07) 80%, transparent)" }}>
        <GameMarquee games={marqueeGames} />
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="relative max-w-7xl mx-auto px-4 pb-20">

        {/* Featured game */}
        <div className="mt-16">
          <SectionHeader icon="⭐" title="Featured Game" href="/games" accentColor="#fbbf24" />
          <FeaturedCard game={featuredGame} />
        </div>

        {/* Hot games */}
        <SectionHeader icon="🔥" title="Most Played Today" href="/games" accentColor="#f97316" />
        <GameGrid games={hotGames} />

        {/* Two-column: Leaderboard + Quick picks */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-4">
          <div>
            <SectionHeader icon="🏆" title="Top 10 This Week" href="/leaderboard" accentColor="#fbbf24" />
            <div className="rounded-3xl overflow-hidden backdrop-blur-sm"
              style={{ background: "rgba(15,15,42,0.85)", border: "1px solid rgba(139,92,246,0.18)", boxShadow: "0 0 80px rgba(139,92,246,0.1)" }}>
              {top10.map((item, i) => <Top10Row key={item.id} item={item} index={i} />)}
            </div>
          </div>
          <div>
            <SectionHeader icon="✨" title="Quick Picks" accentColor="#10b981" />
            <div className="flex flex-col gap-3">
              {topGames.map(g => (
                <TiltCard key={g.id}>
                  <Link href={`/play/${g.id}`}
                    className="flex items-center gap-4 p-4 rounded-2xl group transition-all duration-200"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `linear-gradient(135deg,${g.bgGradient[0]},${g.bgGradient[1]})` }}>
                      {g.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-orbitron font-bold text-sm text-white truncate mb-1">{g.title}</div>
                      <div className="text-xs text-white/40 font-rajdhani uppercase">{g.category}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1 text-neon-yellow text-xs font-bold">
                        <Star className="w-3 h-3 fill-current" />{g.rating}
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        style={{ background: "#8b5cf6" }}>
                        <Play className="w-3.5 h-3.5 text-white fill-current" />
                      </div>
                    </div>
                  </Link>
                </TiltCard>
              ))}
              <Link href="/games" className="text-center py-3 rounded-2xl font-rajdhani font-semibold text-sm transition-all hover:brightness-125"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)", color: "#8b5cf6" }}>
                View All Games →
              </Link>
            </div>
          </div>
        </div>

        {/* 2-Player & Online */}
        <SectionHeader icon="🌍" title="2-Player & Online Games" href="/games/multiplayer" accentColor="#06b6d4" />
        <GameGrid games={multiGames} />

        {/* ── CATEGORIES (3D cards) ───────────────────────────────────── */}
        <SectionHeader icon="🎮" title="Browse by Category" accentColor="#8b5cf6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map(c => <CategoryCard key={c.id} category={c} />)}
        </div>

        {/* Card Games spotlight */}
        <SectionHeader icon="🃏" title="Card Games" href="/games/cards" accentColor="#fbbf24" />
        <div className="rounded-3xl p-6 mb-2" style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.06),rgba(139,92,246,0.04))", border: "1px solid rgba(251,191,36,0.15)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { id:'trix',title:'Trix',icon:'♠',color:'#8b5cf6',desc:'Arab Classic' },
              { id:'tarneeb',title:'Tarneeb',icon:'🃏',color:'#06b6d4',desc:'2v2 Trump Game' },
              { id:'baloot',title:'Baloot',icon:'🌟',color:'#fbbf24',desc:'Saudi Favorite' },
              { id:'oono',title:'OONO',icon:'🔴',color:'#ef4444',desc:'UNO Style' },
              { id:'blackjack',title:'Blackjack',icon:'🃏',color:'#10b981',desc:'Beat the Dealer' },
              { id:'basra',title:'Basra',icon:'🎴',color:'#f97316',desc:'Egyptian Fishing' },
              { id:'estimation',title:'Estimation',icon:'🎯',color:'#06b6d4',desc:'Bid & Win' },
              { id:'kout',title:'Kout Bo 6',icon:'💛',color:'#fbbf24',desc:'Gulf Trick Game' },
            ].map(g => (
              <TiltCard key={g.id}>
                <Link href={`/play/${g.id}`}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center group transition-all hover:brightness-115"
                  style={{ background: `${g.color}10`, border: `1px solid ${g.color}30`, color: g.color }}>
                  <span className="text-3xl group-hover:scale-125 transition-transform duration-300 inline-block">{g.icon}</span>
                  <span className="font-orbitron font-bold text-xs">{g.title}</span>
                  <span className="text-[10px] opacity-60 font-rajdhani">{g.desc}</span>
                </Link>
              </TiltCard>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link href="/games/cards" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-rajdhani font-bold text-sm transition-all hover:brightness-125"
              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
              View All Card Games <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* New Releases */}
        <SectionHeader icon="🆕" title="New Releases" href="/games" accentColor="#10b981" />
        <GameGrid games={newGames} />

        {/* Why ArcadeVerse */}
        <div className="mt-16 rounded-3xl p-8 sm:p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.1),rgba(6,182,212,0.05))", border: "1px solid rgba(139,92,246,0.18)" }}>
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)" }} />
          <div className="absolute -left-10 -bottom-10 w-60 h-60 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.14), transparent 70%)" }} />
          <div className="relative grid lg:grid-cols-2 gap-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-rajdhani font-bold tracking-widest uppercase mb-6"
                style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)", color: "#8b5cf6" }}>
                <Zap className="w-3 h-3" /> Why Players Love Us
              </div>
              <h2 className="font-orbitron font-black text-3xl text-white mb-8 leading-tight">
                Why 12M Players<br />
                <span style={{ color: "#8b5cf6" }}>Choose ArcadeVerse</span>
              </h2>
              <div className="grid gap-4">
                <WhyCard icon={<Globe className="w-5 h-5" />}      color="#06b6d4" title="Real Online Multiplayer"   desc="Challenge friends with a room code. Camera & voice chat included." />
                <WhyCard icon={<Zap className="w-5 h-5" />}        color="#fbbf24" title="Instant Loading"           desc="Games load in under 2 seconds. No downloads, no plugins." />
                <WhyCard icon={<Shield className="w-5 h-5" />}     color="#10b981" title="100% Safe & Free"          desc="Zero malware, zero fake buttons, zero subscriptions. Forever." />
                <WhyCard icon={<Clock className="w-5 h-5" />}      color="#f97316" title="Mobile Optimized"          desc="Touch controls, portrait & landscape. Perfect on any device." />
                <WhyCard icon={<TrendingUp className="w-5 h-5" />} color="#ec4899" title="New Games Weekly"          desc="Fresh games added regularly. Bookmark it and come back!" />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-orbitron font-bold text-xl text-white mb-2">Get New Game Alerts</h3>
              <p className="text-white/40 text-sm mb-6 font-rajdhani">Join 800,000+ players. No spam, ever. Unsubscribe anytime.</p>
              <div className="relative">
                <input type="email" placeholder="your@email.com"
                  className="w-full px-5 py-4 pr-32 rounded-2xl font-rajdhani text-white placeholder-white/30 outline-none text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.28)" }} />
                <button className="absolute right-2 top-2 bottom-2 px-5 rounded-xl font-rajdhani font-bold text-sm text-white"
                  style={{ background: "linear-gradient(135deg,#8b5cf6,#4f46e5)" }}>
                  Subscribe
                </button>
              </div>
              <div className="mt-8 grid grid-cols-4 gap-3">
                {hotGames.slice(0,4).map(g => (
                  <TiltCard key={g.id}>
                    <Link href={`/play/${g.id}`}
                      className="aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all hover:brightness-125"
                      style={{ background: `linear-gradient(135deg,${g.bgGradient[0]},${g.bgGradient[1]})`, border: "1px solid rgba(255,255,255,0.1)" }}>
                      {g.icon}
                    </Link>
                  </TiltCard>
                ))}
              </div>
              <p className="text-center text-white/25 text-xs mt-3 font-rajdhani">Click any game above to play instantly</p>
            </div>
          </div>
        </div>

        {/* Bottom CTA strip */}
        <div className="mt-12 rounded-3xl relative overflow-hidden p-10 text-center"
          style={{ background: "linear-gradient(135deg,#1a0a2e,#0a1a2e,#0a2e1a)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.25), transparent 60%)" }} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          <div className="relative">
            <div className="text-5xl mb-4 animate-float inline-block">🎮</div>
            <h2 className="font-orbitron font-black text-3xl sm:text-4xl text-white mb-3">Ready to Play?</h2>
            <p className="text-white/50 font-rajdhani mb-8 text-lg">Jump into any game instantly — no account needed.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/games" className="btn-primary text-base px-10 py-3.5">Browse All Games</Link>
              <Link href="/auth" className="btn-secondary text-base px-10 py-3.5">Create Free Account</Link>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
