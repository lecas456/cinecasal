import { NextResponse } from 'next/server'
import {
  getTrending,
  getTopStreamingMovies,
  getTopStreamingTv,
  getTopComedies,
  getTopAction,
  getTopAnime,
  getTopHorror,
  getTopSciFi,
} from '@/lib/tmdb'
import type { MovieLike } from '@/types/tmdb'

export async function GET() {
  const results = await Promise.allSettled([
    getTrending(),
    getTopStreamingMovies(),
    getTopStreamingTv(),
    getTopComedies(),
    getTopAction(),
    getTopAnime(),
    getTopHorror(),
    getTopSciFi(),
  ])

  const all: MovieLike[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        all.push({
          ...item,
          mediaType: (item as MovieLike).mediaType ?? 'movie',
        })
      }
    }
  }

  const seen = new Set<string>()
  const deduped = all.filter(item => {
    const key = `${item.mediaType ?? 'movie'}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json(deduped, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
  })
}
