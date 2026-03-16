import type { Metadata } from 'next'
import { GAMES, CATEGORIES } from '@/lib/games'
import HomeClient from '@/components/home/HomeClient'

export const metadata: Metadata = {
  title: 'ArcadeVerse — Play 40+ Free Online Games',
  description: 'Play 40+ free browser games instantly. Snake, Tetris, Pac-Man, 2-player online multiplayer. No download, no login!',
}

const hotGames     = GAMES.filter(g => g.badge === 'hot').slice(0, 8)
const multiGames   = GAMES.filter(g => g.is2P || g.hasOnline || g.badge === 'online').slice(0, 8)
const newGames     = GAMES.filter(g => g.badge === 'new' || g.isNew).slice(0, 8)
const topGames     = GAMES.filter(g => g.badge === 'top' || g.badge === 'hot').slice(0, 4)
const featuredGame = GAMES.find(g => g.id === 'pacman') ?? GAMES[0]

const MARQUEE_GAMES = GAMES.filter(g => !!g.badge).slice(0, 16)

const TOP_10 = [
  { rank:1,  id:'minecraft-classic', icon:'⛏️', name:'Minecraft Classic',    genre:'Sandbox',    plays:'11M',  color:'#fbbf24' },
  { rank:2,  id:'agar-io',           icon:'🔵', name:'Agar.io',               genre:'Multiplayer', plays:'8.4M', color:'#06b6d4' },
  { rank:3,  id:'snake2p',           icon:'🐍', name:'Snake Battle Online',   genre:'Online 2P',  plays:'567K', color:'#8b5cf6' },
  { rank:4,  id:'wordle',            icon:'📝', name:'Wordle',                genre:'Puzzle',     plays:'6.7M', color:'#10b981' },
  { rank:5,  id:'pacman',            icon:'👾', name:'Pac-Man Clone',         genre:'Retro',      plays:'50K',  color:'#f97316' },
  { rank:6,  id:'krunker-io',        icon:'🎯', name:'Krunker.io',            genre:'Shooting',   plays:'5.2M', color:'#ef4444' },
  { rank:7,  id:'geometry-dash',     icon:'🔷', name:'Geometry Dash',         genre:'Action',     plays:'4.8M', color:'#06b6d4' },
  { rank:8,  id:'airhockey',         icon:'🏒', name:'Air Hockey 2P',         genre:'Sports',     plays:'412K', color:'#8b5cf6' },
  { rank:9,  id:'tetris',            icon:'🧱', name:'Tetris Classic',        genre:'Puzzle',     plays:'980K', color:'#ec4899' },
  { rank:10, id:'platformer',        icon:'🏃', name:'Pixel Dash',            genre:'Action',     plays:'35K',  color:'#fbbf24' },
]

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      <HomeClient
        featuredGame={featuredGame}
        hotGames={hotGames}
        multiGames={multiGames}
        newGames={newGames}
        topGames={topGames}
        marqueeGames={MARQUEE_GAMES}
        top10={TOP_10}
        categories={CATEGORIES}
        totalGames={GAMES.length}
      />
    </div>
  )
}