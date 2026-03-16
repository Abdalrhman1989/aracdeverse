import Link from 'next/link'
import { CATEGORIES } from '@/lib/games'

export function Footer() {
  return (
    <footer className="relative z-10 border-t mt-20" style={{ borderColor: 'rgba(139,92,246,0.18)' }}>
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-orbitron font-black text-lg tracking-widest neon-text mb-3">ARCADEVERSE</div>
            <p className="text-space-dim text-sm leading-relaxed max-w-xs">The #1 free online gaming platform. 40+ games including real online 2-player. No downloads, no login required.</p>
          </div>
          <div>
            <h4 className="font-orbitron text-xs font-bold text-white tracking-widest uppercase mb-4">Categories</h4>
            <ul className="space-y-2">
              {CATEGORIES.filter(c => c.id !== 'all').slice(0,7).map(c => (
                <li key={c.id}><Link href={`/games/${c.id}`} className="text-space-dim text-sm hover:text-neon-purple transition-colors">{c.icon} {c.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-orbitron text-xs font-bold text-white tracking-widest uppercase mb-4">Top Games</h4>
            <ul className="space-y-2">
              {[['pacman','Pac-Man Clone'],['snake2p','Snake Battle Online'],['tetris','Tetris Classic'],['platformer','Pixel Dash'],['airhockey','Air Hockey 2P']].map(([id,name]) => (
                <li key={id}><Link href={`/play/${id}`} className="text-space-dim text-sm hover:text-neon-purple transition-colors">{name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-orbitron text-xs font-bold text-white tracking-widest uppercase mb-4">Company</h4>
            <ul className="space-y-2">
              {['About Us','Blog','Advertise','Submit a Game','Privacy Policy','Terms of Service','Contact'].map(l => (
                <li key={l}><a href="#" className="text-space-dim text-sm hover:text-neon-purple transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(139,92,246,0.18)' }}>
          <p className="text-space-dim text-xs">© 2025 ArcadeVerse · All Rights Reserved · Free Online Games</p>
          <div className="flex gap-4">
            {['Privacy','Terms','Sitemap','DMCA'].map(l => <a key={l} href="#" className="text-space-dim text-xs hover:text-neon-purple transition-colors">{l}</a>)}
          </div>
        </div>
      </div>
    </footer>
  )
}
