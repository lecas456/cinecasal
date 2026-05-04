import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMovieDetails, getWatchProviders, IMAGE_BASE_ORIGINAL } from '@/lib/tmdb'
import WatchProviders from '@/components/WatchProviders'
import RatingForm from '@/components/RatingForm'
import AddToWatchlistButton from '@/components/AddToWatchlistButton'
import type { Review } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MoviePage({ params }: PageProps) {
  const { id } = await params
  const movieId = parseInt(id, 10)
  if (isNaN(movieId)) notFound()

  const [movie, providersData, supabase] = await Promise.all([
    getMovieDetails(movieId),
    getWatchProviders(movieId),
    createClient(),
  ])

  if (!movie) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [{ data: reviews }, { data: profiles }] = await Promise.all([
    supabase.from('reviews').select('*').eq('movie_id', movie.id),
    supabase.from('profiles').select('id, name'),
  ])

  const providers = providersData?.results?.BR ?? null
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}min`
    : null

  return (
    <div className="bg-zinc-950 min-h-screen">
      {/* Backdrop */}
      <div className="relative w-full" style={{ height: '45vh', minHeight: 240 }}>
        {(movie.backdrop_path || movie.poster_path) && (
          <Image
            src={`${IMAGE_BASE_ORIGINAL}${movie.backdrop_path ?? movie.poster_path}`}
            alt={movie.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/10" />

        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      {/* Content */}
      <div className="relative z-10 -mt-16 px-4 pb-24 space-y-6 max-w-2xl mx-auto">
        {/* Poster + Info */}
        <div className="flex gap-4">
          <div
            className="relative shrink-0 overflow-hidden rounded-xl bg-zinc-800 shadow-2xl"
            style={{ width: 100, aspectRatio: '2/3' }}
          >
            {movie.poster_path && (
              <Image
                src={`${IMAGE_BASE_ORIGINAL}${movie.poster_path}`}
                alt={movie.title}
                fill
                sizes="100px"
                className="object-cover"
              />
            )}
          </div>

          <div className="flex-1 pt-12 space-y-2">
            <h1 className="text-xl font-black text-white leading-tight">{movie.title}</h1>
            <p className="text-sm text-zinc-400">
              {[year, runtime, movie.vote_average > 0 ? `★ ${movie.vote_average.toFixed(1)}` : null]
                .filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {movie.genres.map(g => (
                <span
                  key={g.id}
                  className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-400"
                >
                  {g.name}
                </span>
              ))}
            </div>
            <AddToWatchlistButton movie={movie} variant="full" />
          </div>
        </div>

        {/* Overview */}
        {movie.overview && (
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sinopse</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">{movie.overview}</p>
          </div>
        )}

        {/* Providers */}
        {providers && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Onde assistir no Brasil
            </h2>
            <WatchProviders providers={providers} />
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800" />

        {/* Rating */}
        <RatingForm
          movie={movie}
          reviews={(reviews as Review[]) ?? []}
          currentUserId={user.id}
          profiles={profiles ?? []}
        />
      </div>
    </div>
  )
}
