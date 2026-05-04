import { NextRequest, NextResponse } from 'next/server'
import { getMovieDetails, getWatchProviders } from '@/lib/tmdb'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const movieId = parseInt(id, 10)

  if (isNaN(movieId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const [details, providers] = await Promise.all([
    getMovieDetails(movieId),
    getWatchProviders(movieId),
  ])

  if (!details) {
    return NextResponse.json({ error: 'Filme não encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    movie: details,
    providers: providers?.results?.BR ?? null,
  })
}
