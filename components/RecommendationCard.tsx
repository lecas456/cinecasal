'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import WatchProviders from '@/components/WatchProviders'
import { RecommendationSkeleton } from '@/components/SkeletonCard'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_BASE } from '@/lib/tmdb'
import type { Movie, WatchProviderResult } from '@/types/tmdb'

interface Recommendation {
  movie: Movie
  providers: WatchProviderResult | null
  aiReason?: string
}

export default function RecommendationCard() {
  const [data, setData] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchRecommendation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recommend', { cache: 'no-store' })
      if (!res.ok) {
        setError('Não encontramos uma sugestão agora. Avalie mais filmes para personalizar!')
        setData(null)
      } else {
        const json: Recommendation = await res.json()
        setData(json)
      }
    } catch {
      setError('Erro ao buscar sugestão.')
    } finally {
      setLoading(false)
      setStarted(true)
    }
  }, [])

  async function handleAccept() {
    if (!data) return
    await supabase.from('watchlist').insert({
      movie_id: data.movie.id,
      status: 'accepted',
    })
    setData(null)
    setStarted(false)
  }

  async function handleReject() {
    if (!data) return
    await supabase.from('watchlist').insert({
      movie_id: data.movie.id,
      status: 'rejected',
    })
    fetchRecommendation()
  }

  const year = data?.movie.release_date
    ? new Date(data.movie.release_date).getFullYear()
    : null

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">O que vamos assistir?</h1>
          <p className="text-muted-foreground text-sm">
            Deixa o CineCasal escolher um filme pra vocês dois
          </p>
        </div>
        <Button size="lg" onClick={fetchRecommendation} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Sugerir um filme
        </Button>
      </div>
    )
  }

  if (loading) return <RecommendationSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchRecommendation} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-sm mx-auto p-4 space-y-5">
      <p className="text-center text-sm text-muted-foreground font-medium">
        Sugestão do dia
      </p>

      <Link href={`/movie/${data.movie.id}`} className="block">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl shadow-2xl">
          {data.movie.poster_path ? (
            <Image
              src={`${IMAGE_BASE}${data.movie.poster_path}`}
              alt={data.movie.title}
              fill
              sizes="(max-width: 768px) 100vw, 384px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-2">
        <Link href={`/movie/${data.movie.id}`}>
          <h2 className="text-xl font-bold hover:text-primary transition-colors">
            {data.movie.title}
          </h2>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {year && <span>{year}</span>}
          {data.movie.vote_average > 0 && (
            <>
              <span>·</span>
              <span>★ {data.movie.vote_average.toFixed(1)}</span>
            </>
          )}
        </div>
        {data.aiReason && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
            <p className="text-xs text-primary font-medium">✨ Por que assistir</p>
            <p className="text-sm mt-0.5">{data.aiReason}</p>
          </div>
        )}
        {data.movie.overview && (
          <p className="text-sm text-muted-foreground line-clamp-3">{data.movie.overview}</p>
        )}
      </div>

      {data.providers && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Disponível em</p>
          <WatchProviders providers={data.providers} />
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 gap-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={handleReject}
        >
          <ThumbsDown className="h-4 w-4" />
          Não quero
        </Button>
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={handleAccept}
        >
          <ThumbsUp className="h-4 w-4" />
          Vamos ver!
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground gap-2"
        onClick={fetchRecommendation}
      >
        <RefreshCw className="h-3 w-3" />
        Outra sugestão
      </Button>
    </div>
  )
}
