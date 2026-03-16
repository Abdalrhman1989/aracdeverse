import { MetadataRoute } from "next"
import { GAMES, CATEGORIES } from "@/lib/games"

const BASE = "https://aracdeverse-next.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                    lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/games`,         lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/leaderboard`,   lastModified: now, changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE}/auth`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ]

  const categoryPages: MetadataRoute.Sitemap = CATEGORIES
    .filter(c => c.id !== 'all')
    .map(c => ({
      url: `${BASE}/games/${c.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

  const gamePages: MetadataRoute.Sitemap = GAMES.map(g => ({
    url: `${BASE}/play/${g.id}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: g.badge === 'hot' || g.badge === 'top' ? 0.85 : g.isNew ? 0.75 : 0.65,
  }))

  return [...staticPages, ...categoryPages, ...gamePages]
}