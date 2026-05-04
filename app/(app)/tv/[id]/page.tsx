import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Tv } from 'lucide-react'
import { getTvDetails, getTvWatchProviders, IMAGE_BASE_ORIGINAL } from '@/lib/tmdb'
import WatchProviders from '@/components/WatchProviders'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TvPage({ params }: PageProps) {
  const { id } = await params
  const tvId = parseInt(id, 10)
  if (isNaN(tvId)) notFound()

  const [show, providersData] = await Promise.all([
    getTvDetails(tvId),
    getTvWatchProviders(tvId),
  ])

  if (!show) notFound()

  const providers = providersData?.results?.BR ?? null
  const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null

  return (
    <div className="bg-zinc-950 min-h-screen">
      {/* Backdrop */}
      <div className="relative w-full" style={{ height: '45vh', minHeight: 240 }}>
        {(show.backdrop_path || show.poster_path) && (
          <Image
            src={`${IMAGE_BASE_ORIGINAL}${show.backdrop_path ?? show.poster_path}`}
            alt={show.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/10" />

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
            {show.poster_path && (
              <Image
                src={`${IMAGE_BASE_ORIGINAL}${show.poster_path}`}
                alt={show.name}
                fill
                sizes="100px"
                className="object-cover"
              />
            )}
          </div>

          <div className="flex-1 pt-12 space-y-2">
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-zinc-500 shrink-0" />
              <span className="text-xs text-zinc-500">Série</span>
            </div>
            <h1 className="text-xl font-black text-white leading-tight">{show.name}</h1>
            <p className="text-sm text-zinc-400">
              {[
                year,
                show.number_of_seasons > 0
                  ? `${show.number_of_seasons} temporada${show.number_of_seasons > 1 ? 's' : ''}`
                  : null,
                show.vote_average > 0 ? `★ ${show.vote_average.toFixed(1)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {show.genres.map(g => (
                <span
                  key={g.id}
                  className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-400"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Overview */}
        {show.overview && (
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sinopse</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">{show.overview}</p>
          </div>
        )}

        {/* Networks */}
        {show.networks?.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Exibido em</h2>
            <p className="text-sm text-zinc-300">{show.networks.map(n => n.name).join(', ')}</p>
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
      </div>
    </div>
  )
}
