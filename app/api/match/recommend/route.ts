import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverMovies, discoverTv, getWatchProviders, getTvWatchProviders } from '@/lib/tmdb'
import type { MovieLike } from '@/types/tmdb'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await request.json() as { sessionId: string }

  const { data: session } = await supabase
    .from('match_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.leader_id !== user.id) return NextResponse.json({ error: 'Only leader can fetch' }, { status: 403 })

  const shownIds = new Set<number>(session.shown_ids ?? [])

  const randomPage = Math.floor(Math.random() * 10) + 1
  const [movieRes, tvRes] = await Promise.all([
    discoverMovies({
      watch_region: 'BR',
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc',
      page: randomPage,
    }),
    discoverTv({
      watch_region: 'BR',
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc',
      page: randomPage,
    }),
  ])

  const candidates: MovieLike[] = [
    ...movieRes.results
      .filter(m => !shownIds.has(m.id) && (m.vote_average ?? 0) >= 6)
      .map(m => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        overview: m.overview,
        release_date: m.release_date,
        vote_average: m.vote_average,
        popularity: m.popularity,
        mediaType: 'movie' as const,
      })),
    ...tvRes.results
      .filter(tv => !shownIds.has(tv.id) && (tv.vote_average ?? 0) >= 6)
      .map(tv => ({
        id: tv.id,
        title: tv.name,
        poster_path: tv.poster_path,
        backdrop_path: tv.backdrop_path,
        overview: tv.overview,
        release_date: tv.first_air_date,
        vote_average: tv.vote_average,
        popularity: tv.popularity,
        mediaType: 'tv' as const,
      })),
  ]

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No more candidates' }, { status: 404 })
  }

  const picked = candidates.sort(() => Math.random() - 0.5)[0]

  const providersData = picked.mediaType === 'tv'
    ? await getTvWatchProviders(picked.id)
    : await getWatchProviders(picked.id)

  const movieData = { ...picked, providers: providersData?.results?.BR ?? null }

  const { error } = await supabase
    .from('match_sessions')
    .update({
      current_movie: movieData,
      leader_vote: null,
      partner_vote: null,
      status: 'active',
      shown_ids: [...(session.shown_ids ?? []), picked.id],
    })
    .eq('id', sessionId)

  if (error) return NextResponse.json({ error: 'DB update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
