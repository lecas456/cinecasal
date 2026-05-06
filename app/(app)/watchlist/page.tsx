import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMovieDetails, getTvDetails, IMAGE_BASE } from '@/lib/tmdb'
import { Bookmark } from 'lucide-react'

type NormalizedItem = {
  id: number
  title: string
  poster_path: string | null
  release_date: string | null
  vote_average: number
  genres: { id: number; name: string }[]
}

async function fetchItemDetails(movieId: number, mediaType: string | null): Promise<NormalizedItem | null> {
  if (mediaType === 'tv') {
    const tv = await getTvDetails(movieId)
    if (!tv) return null
    return {
      id: tv.id,
      title: tv.name,
      poster_path: tv.poster_path,
      release_date: tv.first_air_date,
      vote_average: tv.vote_average,
      genres: tv.genres,
    }
  }
  const movie = await getMovieDetails(movieId)
  if (!movie) return null
  return {
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    release_date: movie.release_date ?? null,
    vote_average: movie.vote_average,
    genres: movie.genres,
  }
}

export default async function WatchlistPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('watchlist')
    .select('*')
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })

  if (!items || items.length === 0) {
    return (
      <div className="bg-zinc-950 min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-3">
        <Bookmark className="h-14 w-14 text-zinc-700" />
        <p className="font-bold text-white text-lg">Lista vazia</p>
        <p className="text-sm text-zinc-500">
          Aceite sugestões ou adicione filmes pela busca
        </p>
      </div>
    )
  }

  const moviesData = await Promise.all(
    items.map(item => fetchItemDetails(item.movie_id, item.media_type ?? 'movie'))
  )

  return (
    <div className="bg-zinc-950 min-h-screen p-4 pb-24 space-y-4">
      <h1 className="text-xl font-black text-white pt-2">Minha Lista</h1>
      <p className="text-xs text-zinc-500">{items.length} {items.length === 1 ? 'filme' : 'filmes'}</p>

      <div className="space-y-3">
        {items.map((item, i) => {
          const movie = moviesData[i]
          if (!movie) return null
          const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
          const mediaType = item.media_type ?? 'movie'
          const href = mediaType === 'tv' ? `/tv/${item.movie_id}` : `/movie/${item.movie_id}`

          return (
            <Link
              key={item.id}
              href={href}
              className="flex gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-3 hover:bg-zinc-800 transition-colors"
            >
              <div
                className="relative shrink-0 overflow-hidden rounded-lg bg-zinc-800"
                style={{ width: 60, aspectRatio: '2/3' }}
              >
                {movie.poster_path && (
                  <Image
                    src={`${IMAGE_BASE}${movie.poster_path}`}
                    alt={movie.title}
                    fill
                    sizes="60px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1 py-0.5">
                <p className="font-semibold text-white text-sm line-clamp-2">{movie.title}</p>
                <p className="text-xs text-zinc-500">
                  {[year, movie.vote_average > 0 ? `★ ${movie.vote_average.toFixed(1)}` : null]
                    .filter(Boolean).join(' · ')}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {movie.genres.slice(0, 2).map(g => (
                    <span key={g.id} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">
                      {g.name}
                    </span>
                  ))}
                </div>
                <span
                  className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    item.status === 'accepted'
                      ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                  }`}
                >
                  {item.status === 'accepted' ? 'Para assistir' : 'Pendente'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
