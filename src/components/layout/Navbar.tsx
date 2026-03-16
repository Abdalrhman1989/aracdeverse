'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, Search, Gamepad2, LogIn, User } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/',              label: 'Home',       icon: '🏠' },
  { href: '/games/action',  label: 'Action',     icon: '⚔️' },
  { href: '/games/puzzle',  label: 'Puzzle',     icon: '🧩' },
  { href: '/games/racing',  label: 'Racing',     icon: '🏎️' },
  { href: '/games/2player', label: '2-Player',   icon: '👥' },
  { href: '/games',         label: 'All Games',  icon: '🎮', cta: true },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [query,    setQuery]    = useState('')
  const router = useRouter()
  const { user } = useAuthStore()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) { router.push(`/games?q=${encodeURIComponent(query)}`); setMenuOpen(false) }
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(3,3,10,0.94)', backdropFilter: 'blur(20px)', borderColor: 'rgba(139,92,246,0.18)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="font-orbitron font-black text-lg tracking-widest neon-text shrink-0 mr-2">
            ARCADEVERSE
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 rounded-full px-4 py-2 min-w-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.18)' }}>
            <Search className="w-4 h-4 text-space-dim shrink-0" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search 40+ games..."
              className="bg-transparent outline-none text-space-text text-sm w-full min-w-0 font-rajdhani"
            />
          </form>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-rajdhani font-semibold transition-all',
                l.cta ? 'btn-primary !text-xs !px-4 !py-2' : 'text-space-muted hover:text-white hover:bg-white/5'
              )}>
                {l.icon} {l.label}
              </Link>
            ))}
          </div>

          {/* Auth */}
          <div className="hidden lg:block shrink-0">
            {user ? (
              <Link href="/auth" className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-rajdhani font-semibold text-space-muted hover:text-white transition-colors">
                <User className="w-4 h-4" /> Profile
              </Link>
            ) : (
              <Link href="/auth" className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-rajdhani font-semibold btn-secondary">
                <LogIn className="w-4 h-4" /> Sign In
              </Link>
            )}
          </div>

          {/* Hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 rounded-lg text-space-muted" aria-label="Menu">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 top-16 z-40 lg:hidden overflow-y-auto" style={{ background: 'rgba(3,3,10,0.97)', backdropFilter: 'blur(16px)' }}>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl font-rajdhani font-semibold text-space-muted card-space hover:text-white transition-colors">
                  <span className="text-xl">{l.icon}</span>{l.label}
                </Link>
              ))}
            </div>
            <Link href="/auth" onClick={() => setMenuOpen(false)} className="w-full btn-primary justify-center mt-2">
              <LogIn className="w-4 h-4" /> {user ? 'My Profile' : 'Sign In / Register'}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
