'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, ChevronRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import WatchProviders from '@/components/WatchProviders'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_BASE, STREAMING_PLATFORMS_BR } from '@/lib/tmdb'
import type { WatchProviderResult, MovieLike } from '@/types/tmdb'

interface Recommendation {
  movie: MovieLike
  providers: WatchProviderResult | null
  aiReason?: string
  mediaType: 'movie' | 'tv'
}

const YEAR_OPTIONS = [
  { label: 'Qualquer ano', value: undefined },
  { label: 'Após 2020', value: 2020 },
  { label: 'Após 2015', value: 2015 },
  { label: 'Após 2010', value: 2010 },
  { label: 'Após 2000', value: 2000 },
  { label: 'Após 1990', value: 1990 },
]

export default function RecommendationSheet() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'filters' | 'result'>('filters')
  const [mood, setMood] = useState('')
  const [platformId, setPlatformId] = useState<number | undefined>()
  const [minYear, setMinYear] = useState<number | undefined>()
  const [mediaType, setMediaType] = useState<'movie' | 'tv' | 'both'>('both')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Recommendation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  function openSheet() {
    setStep('filters')
    setResult(null)
    setError(null)
    setOpen(true)
  }

  async function fetchRecommendation() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (mood.trim()) params.set('mood', mood.trim())
      if (platformId) params.set('platformId', String(platformId))
      if (minYear) params.set('minYear', String(minYear))
      if (mediaType !== 'both') params.set('mediaType', mediaType)

      const res = await fetch(`/api/recommend?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Não encontramos sugestão com esses filtros. Tente remover alguns filtros.')
        return
      }
      const data: Recommendation = await res.json()
      setResult(data)
      setStep('result')
    } catch {
      setError('Erro ao buscar sugestão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!result) return
    await supabase.from('watchlist').insert({
      movie_id: result.movie.id,
      status: 'accepted',
    })
    setOpen(false)
  }

  async function handleReject() {
    if (!result) return
    await supabase.from('watchlist').insert({
      movie_id: result.movie.id,
      status: 'rejected',
    })
    fetchRecommendation()
  }

  const year = result?.movie.release_date
    ? new Date(result.movie.release_date).getFullYear()
    : null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={openSheet}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-red-900/50 hover:bg-red-700 active:scale-95 transition-all"
      >
        <Sparkles className="h-4 w-4" />
        Sugestão
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="bg-zinc-950 border-t border-white/10 rounded-t-2xl max-h-[92vh] overflow-y-auto text-white p-0"
        >
          {step === 'filters' ? (
            <div className="p-6 space-y-6">
              <SheetHeader>
                <SheetTitle className="text-white text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-red-500" />
                  Sugestão da Noite
                </SheetTitle>
              </SheetHeader>

              {/* Mood input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  Em qual clima vocês estão? <span className="text-zinc-500">(opcional)</span>
                </label>
                <Textarea
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  placeholder="Ex: algo engraçado pra relaxar, terror leve, ação explosiva..."
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
                  rows={2}
                />
              </div>

              {/* Media type filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Tipo</label>
                <div className="flex gap-2">
                  {([['both', 'Filme ou Série'], ['movie', 'Só Filmes'], ['tv', 'Só Séries']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setMediaType(val)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                        mediaType === val
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Filtrar por streaming</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPlatformId(undefined)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                      platformId === undefined
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    Todos
                  </button>
                  {STREAMING_PLATFORMS_BR.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPlatformId(platformId === p.id ? undefined : p.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                        platformId === p.id
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Período do filme</label>
                <div className="flex flex-wrap gap-2">
                  {YEAR_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setMinYear(opt.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                        minYear === opt.value
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                onClick={fetchRecommendation}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analisando seu gosto...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {mediaType === 'tv' ? 'Sugerir série' : mediaType === 'movie' ? 'Sugerir filme' : 'O que assistir hoje?'}
                  </span>
                )}
              </Button>
            </div>
          ) : result ? (
            <div className="space-y-0">
              {/* Movie poster as header */}
              <div className="relative h-56 w-full overflow-hidden">
                {result.movie.backdrop_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w780${result.movie.backdrop_path}`}
                    alt={result.movie.title}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                ) : result.movie.poster_path ? (
                  <Image
                    src={`${IMAGE_BASE}${result.movie.poster_path}`}
                    alt={result.movie.title}
                    fill
                    sizes="100vw"
                    className="object-cover object-top"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xs text-red-400 font-semibold mb-1">✨ Sugestão do CineCasal</p>
                  <h2 className="text-2xl font-black text-white leading-tight">{result.movie.title}</h2>
                  <p className="text-zinc-400 text-sm mt-0.5">{year} {(result.movie.vote_average ?? 0) > 0 ? `· ★ ${(result.movie.vote_average ?? 0).toFixed(1)}` : ''}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* AI reason */}
                {result.aiReason && (
                  <div className="rounded-xl bg-zinc-900 border border-red-900/30 px-4 py-3">
                    <p className="text-xs text-red-400 font-semibold mb-1">Por que assistir</p>
                    <p className="text-sm text-zinc-200">{result.aiReason}</p>
                  </div>
                )}

                {/* Overview */}
                {result.movie.overview && (
                  <p className="text-sm text-zinc-400 line-clamp-3">{result.movie.overview}</p>
                )}

                {/* Providers */}
                {result.providers && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 font-medium">Disponível agora em</p>
                    <WatchProviders providers={result.providers} />
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleReject}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Não curto
                  </button>
                  <button
                    onClick={handleAccept}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 py-3 text-sm font-bold text-white transition-colors"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Vamos ver!
                  </button>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={result.mediaType === 'tv' ? `/tv/${result.movie.id}` : `/movie/${result.movie.id}`}
                    onClick={() => setOpen(false)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2"
                  >
                    Ver detalhes <ChevronRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => { setStep('filters'); setResult(null) }}
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Mudar filtros
                  </button>
                  <button
                    onClick={fetchRecommendation}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2 disabled:opacity-40"
                  >
                    {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Outra opção
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
