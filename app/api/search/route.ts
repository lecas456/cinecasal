import { NextRequest, NextResponse } from 'next/server'
import { searchMovies, searchTv } from '@/lib/tmdb'
import type { MovieLike } from '@/types/tmdb'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return NextResponse.json([])
  }

  const [movies, tvShows] = await Promise.all([
    searchMovies(q.trim()),
    searchTv(q.trim()),
  ])

  const combined: MovieLike[] = [
    ...movies.map(m => ({ ...m, mediaType: 'movie' as const })),
    ...tvShows,
  ].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))

  return NextResponse.json(combined.slice(0, 20))
}
