import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getTrending,
  getTopStreamingMovies,
  getTopStreamingTv,
  getMovieDetails,
  getTvDetails,
  getTopComedies,
  getTopAction,
  getTopAnime,
  getTopHorror,
  getTopSciFi,
  IMAGE_BASE_ORIGINAL,
} from '@/lib/tmdb'
import MovieCarousel from '@/components/MovieCarousel'
import AddToWatchlistButton from '@/components/AddToWatchlistButton'
import RecommendationSheet from '@/components/RecommendationSheet'
import type { MovieLike } from '@/types/tmdb'

export default async function HomePage() {
  const supabase = await createClient()

  const [
    trending,
    streamingMovies,
    streamingTv,
    comedies,
    action,
    anime,
    horror,
    scifi,
    { data: watchlistItems },
  ] = await Promise.all([
    getTrending(),
    getTopStreamingMovies(),
    getTopStreamingTv(),
    getTopComedies(),
    getTopAction(),
    getTopAnime(),
    getTopHorror(),
    getTopSciFi(),
    supabase
      .from('watchlist')
      .select('movie_id, media_type')
      .in('status', ['accepted', 'pending'])
      .limit(10),
  ])

  const hero = trending[0]

  async function fetchWatchlistItem(movieId: number, mediaType: string | null): Promise<MovieLike | null> {
    if (mediaType === 'tv') {
      const tv = await getTvDetails(movieId)
      if (!tv) return null
      return {
        id: tv.id,
        title: tv.name,
        poster_path: tv.poster_path,
        backdrop_path: tv.backdrop_path,
        overview: tv.overview,
        release_date: tv.first_air_date,
        vote_average: tv.vote_average,
        mediaType: 'tv',
      }
    }
    const movie = await getMovieDetails(movieId)
    if (!movie) return null
    return { ...movie, mediaType: 'movie' }
  }

  const watchlistMovies: MovieLike[] = watchlistItems?.length
    ? (await Promise.all(watchlistItems.map(w => fetchWatchlistItem(w.movie_id, w.media_type ?? 'movie'))))
        .filter((m): m is MovieLike => m !== null)
    : []

  return (
    <div className="bg-zinc-950 min-h-screen">
      {/* Hero Section */}
      {hero && (
        <div className="relative w-full" style={{ height: '65vh', minHeight: 320 }}>
          {hero.backdrop_path ? (
            <Image
              src={`${IMAGE_BASE_ORIGINAL}${hero.backdrop_path}`}
              alt={hero.title}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          ) : hero.poster_path ? (
            <Image
              src={`${IMAGE_BASE_ORIGINAL}${hero.poster_path}`}
              alt={hero.title}
              fill
              sizes="100vw"
              className="object-cover object-top"
              priority
            />
          ) : (
            <div className="h-full bg-zinc-900" />
          )}

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/60 to-transparent" />

          {/* Content */}
          <div className="absolute bottom-16 left-4 right-4 space-y-3 max-w-sm">
            <h1 className="text-3xl font-black text-white leading-tight drop-shadow-lg">
              {hero.title}
            </h1>
            {hero.overview && (
              <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed">
                {hero.overview}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <Link
                href={`/movie/${hero.id}`}
                className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-zinc-200 transition-colors"
              >
                Ver Detalhes
              </Link>
              <AddToWatchlistButton movie={hero} variant="full" />
            </div>
          </div>
        </div>
      )}

      {/* Carousels */}
      <div className="relative z-10 space-y-8 pb-28 pt-4">
        <MovieCarousel title="🔥 Top 10 no Streaming" movies={streamingMovies} showNumbers />
        <MovieCarousel title="📺 Top 10 Séries" movies={streamingTv} showNumbers />
        <MovieCarousel title="😂 Melhores Comédias" movies={comedies} showNumbers />
        <MovieCarousel title="💥 Ação & Aventura" movies={action} showNumbers />
        <MovieCarousel title="🎌 Anime" movies={anime} showNumbers />
        <MovieCarousel title="😱 Terror & Suspense" movies={horror} showNumbers />
        <MovieCarousel title="🚀 Ficção Científica" movies={scifi} showNumbers />

        {watchlistMovies.length > 0 && (
          <MovieCarousel title="📌 Sua Lista" movies={watchlistMovies} />
        )}
      </div>

      <RecommendationSheet />
    </div>
  )
}
