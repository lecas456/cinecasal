import { NextResponse } from 'next/server'
import { getTrending, discoverMovies, discoverTv } from '@/lib/tmdb'
import type { MovieLike } from '@/types/tmdb'

const RECENT_FROM = `${new Date().getFullYear() - 4}-01-01`

export async function GET() {
  const [
    trendingResult,
    movies1, movies2, movies3,
    tv1, tv2, tv3,
  ] = await Promise.allSettled([
    getTrending(),
    discoverMovies({ sort_by: 'popularity.desc', 'primary_release_date.gte': RECENT_FROM, language: 'pt-BR', page: 1 }),
    discoverMovies({ sort_by: 'popularity.desc', 'primary_release_date.gte': RECENT_FROM, language: 'pt-BR', page: 2 }),
    discoverMovies({ sort_by: 'popularity.desc', 'primary_release_date.gte': RECENT_FROM, language: 'pt-BR', page: 3 }),
    discoverTv({ sort_by: 'popularity.desc', 'first_air_date.gte': RECENT_FROM, language: 'pt-BR', page: 1 }),
    discoverTv({ sort_by: 'popularity.desc', 'first_air_date.gte': RECENT_FROM, language: 'pt-BR', page: 2 }),
    discoverTv({ sort_by: 'popularity.desc', 'first_air_date.gte': RECENT_FROM, language: 'pt-BR', page: 3 }),
  ])

  const all: MovieLike[] = []

  if (trendingResult.status === 'fulfilled') {
    for (const item of trendingResult.value) {
      all.push({ ...item, mediaType: (item as MovieLike).mediaType ?? 'movie' })
    }
  }

  for (const r of [movies1, movies2, movies3]) {
    if (r.status === 'fulfilled') {
      for (const m of r.value.results) {
        all.push({
          id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          backdrop_path: m.backdrop_path,
          overview: m.overview,
          release_date: m.release_date,
          vote_average: m.vote_average,
          popularity: m.popularity,
          mediaType: 'movie',
        })
      }
    }
  }

  for (const r of [tv1, tv2, tv3]) {
    if (r.status === 'fulfilled') {
      for (const tv of r.value.results) {
        all.push({
          id: tv.id,
          title: tv.name,
          poster_path: tv.poster_path,
          backdrop_path: tv.backdrop_path,
          overview: tv.overview,
          release_date: tv.first_air_date,
          vote_average: tv.vote_average,
          popularity: tv.popularity,
          mediaType: 'tv',
        })
      }
    }
  }

  const seen = new Set<string>()
  const deduped = all.filter(item => {
    const key = `${item.mediaType}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json(deduped, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
  })
}
