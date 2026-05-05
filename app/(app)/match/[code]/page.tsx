'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { Copy, Loader2, Heart, X, Users2, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_BASE } from '@/lib/tmdb'
import type { MovieLike, WatchProviderResult } from '@/types/tmdb'
import WatchProviders from '@/components/WatchProviders'

type MovieWithProviders = MovieLike & { providers?: WatchProviderResult | null }

interface MatchSession {
  id: string
  code: string
  leader_id: string
  partner_id: string | null
  status: 'waiting' | 'active' | 'matched' | 'ended'
  current_movie: MovieWithProviders | null
  leader_vote: 'yes' | 'no' | null
  partner_vote: 'yes' | 'no' | null
  shown_ids: number[]
}

export default function MatchSessionPage() {
  const params = useParams()
  const code = params.code as string
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<MatchSession | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingNext, setFetchingNext] = useState(false)
  const [myVote, setMyVote] = useState<'yes' | 'no' | null>(null)
  const [copied, setCopied] = useState(false)
  const votesProcessedRef = useRef(false)

  const isLeader = session?.leader_id === userId

  // Initial load
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('match_sessions')
        .select('*')
        .eq('code', code)
        .single()

      if (!data) { router.push('/match'); return }
      setSession(data as MatchSession)
      setLoading(false)
    }
    init()
  }, [code])

  // Real-time subscription
  useEffect(() => {
    if (!session?.id) return

    const channel = supabase
      .channel(`match-${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'match_sessions', filter: `id=eq.${session.id}` },
        async (payload) => {
          const updated = payload.new as MatchSession
          // Realtime pode omitir JSONB grandes — refetch quando o status muda para matched
          if (updated.status === 'matched' || !updated.current_movie) {
            const { data } = await supabase
              .from('match_sessions')
              .select('*')
              .eq('id', session.id)
              .single()
            if (data) setSession(data as MatchSession)
          } else {
            setSession(updated)
          }
          if (updated.leader_vote === null && updated.partner_vote === null) {
            setMyVote(null)
            votesProcessedRef.current = false
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.id])

  const fetchNextMovie = useCallback(async (sid: string) => {
    setFetchingNext(true)
    await fetch('/api/match/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    setFetchingNext(false)
  }, [])

  // Leader: detect when both votes are in and determine outcome
  useEffect(() => {
    if (!session || !isLeader) return
    if (!session.leader_vote || !session.partner_vote) return
    if (votesProcessedRef.current) return

    votesProcessedRef.current = true

    if (session.leader_vote === 'yes' && session.partner_vote === 'yes') {
      supabase.from('match_sessions').update({ status: 'matched' }).eq('id', session.id)
    } else {
      fetchNextMovie(session.id)
    }
  }, [session?.leader_vote, session?.partner_vote, session?.id, isLeader, fetchNextMovie])

  const handleVote = useCallback(async (vote: 'yes' | 'no') => {
    if (!session || !userId || myVote) return
    setMyVote(vote)
    const field = isLeader ? 'leader_vote' : 'partner_vote'
    await supabase.from('match_sessions').update({ [field]: vote }).eq('id', session.id)
  }, [session, userId, isLeader, myVote, supabase])

  const handleLeave = useCallback(async () => {
    if (!session) return
    if (isLeader) {
      await supabase.from('match_sessions').update({ status: 'ended' }).eq('id', session.id)
    }
    router.push('/match')
  }, [session, isLeader, supabase, router])

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!session) return null
  const movie = session.current_movie

  // ── Ended ──────────────────────────────────────────────────────────
  if (session.status === 'ended') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 pb-28 text-center space-y-4">
        <div className="text-6xl">👋</div>
        <h2 className="text-2xl font-black text-white">Sessão encerrada</h2>
        <button
          onClick={() => router.push('/match')}
          className="rounded-2xl bg-zinc-800 hover:bg-zinc-700 px-8 py-4 text-white font-bold"
        >
          Nova sala
        </button>
      </div>
    )
  }

  // ── Match! ─────────────────────────────────────────────────────────
  if (session.status === 'matched' && movie) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 pb-28 text-center space-y-5">
        <div className="text-7xl animate-bounce">🎉</div>
        <div>
          <h2 className="text-3xl font-black text-white">Deu Match!</h2>
          <p className="text-zinc-400 mt-1">Vocês dois querem assistir</p>
        </div>
        <div className="relative w-36 h-56 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/30">
          {movie.poster_path && (
            <Image src={`${IMAGE_BASE}${movie.poster_path}`} alt={movie.title} fill className="object-cover" />
          )}
        </div>
        <div>
          <h3 className="text-xl font-black text-white">{movie.title}</h3>
          <p className="text-zinc-400 text-sm">{movie.release_date?.slice(0, 4)}</p>
        </div>
        {movie.providers && <WatchProviders providers={movie.providers} />}
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push(movie.mediaType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`)}
            className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700 py-4 text-white font-bold transition-colors"
          >
            Ver detalhes
          </button>
          {isLeader ? (
            <button
              onClick={() => fetchNextMovie(session.id)}
              disabled={fetchingNext}
              className="flex-1 rounded-2xl bg-zinc-800 hover:bg-zinc-700 py-4 text-white font-bold transition-colors disabled:opacity-50"
            >
              {fetchingNext ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Próximo'}
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              Aguardando líder...
            </div>
          )}
        </div>
        <button onClick={handleLeave} className="text-sm text-zinc-600 hover:text-zinc-400">
          Sair da sala
        </button>
      </div>
    )
  }

  // ── Waiting room ───────────────────────────────────────────────────
  if (session.status === 'waiting') {
    const partnerJoined = !!session.partner_id
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 pb-28 space-y-8">
        <div className="text-center space-y-2">
          <Users2 className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-black text-white">CineMatch</h1>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <p className="text-center text-sm text-zinc-400">
            {isLeader ? 'Mande esse código para seu parceiro' : 'Aguardando o líder iniciar...'}
          </p>
          <button
            onClick={copyCode}
            className="w-full flex items-center justify-between rounded-2xl bg-zinc-900 border border-zinc-700 px-6 py-5 hover:border-zinc-500 transition-colors"
          >
            <span className="font-mono text-3xl font-black text-white tracking-widest">{code}</span>
            <span className="text-zinc-400 text-sm flex items-center gap-1">
              <Copy className="h-4 w-4" />
              {copied ? 'Copiado!' : 'Copiar'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full transition-colors ${partnerJoined ? 'bg-green-400 animate-pulse' : 'bg-zinc-700'}`} />
          <span className="text-sm text-zinc-400">
            {partnerJoined ? 'Parceiro entrou! Pronto para começar.' : 'Aguardando parceiro...'}
          </span>
        </div>

        {isLeader && partnerJoined && (
          <button
            onClick={() => fetchNextMovie(session.id)}
            disabled={fetchingNext}
            className="w-full max-w-sm rounded-2xl bg-red-600 hover:bg-red-700 py-5 text-white font-bold text-lg transition-colors disabled:opacity-50"
          >
            {fetchingNext
              ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              : '🎬 Iniciar'}
          </button>
        )}

        <button onClick={handleLeave} className="text-sm text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    )
  }

  // ── Active: vote ───────────────────────────────────────────────────
  if (!movie) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
    </div>
  )

  const partnerVoted = isLeader ? !!session.partner_vote : !!session.leader_vote

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-28">
      <div className="pt-12 pb-4 px-5 flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-500 font-mono">{code}</span>
        <button onClick={handleLeave} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 px-4 flex flex-col">
        {/* Movie poster */}
        <div className="relative rounded-3xl overflow-hidden bg-zinc-900" style={{ height: 400 }}>
          {movie.poster_path ? (
            <Image
              src={`${IMAGE_BASE}${movie.poster_path}`}
              alt={movie.title}
              fill
              sizes="400px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-zinc-600 text-sm">Sem imagem</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              {movie.mediaType === 'tv' ? 'Série' : 'Filme'}
            </span>
            <h2 className="text-xl font-black text-white leading-tight">{movie.title}</h2>
            <p className="text-sm text-zinc-400">
              {movie.release_date?.slice(0, 4)}
              {(movie.vote_average ?? 0) > 0 ? ` · ★ ${(movie.vote_average ?? 0).toFixed(1)}` : ''}
            </p>
          </div>
        </div>

        {movie.overview && (
          <p className="text-sm text-zinc-400 mt-4 line-clamp-3">{movie.overview}</p>
        )}

        {movie.providers && (
          <div className="mt-3">
            <p className="text-xs text-zinc-600 mb-1">Disponível em</p>
            <WatchProviders providers={movie.providers} />
          </div>
        )}

        {myVote && (
          <p className="mt-4 text-center text-sm text-zinc-500">
            {myVote === 'yes' ? '❤️ Você quer assistir!' : '👎 Você passou'}
            {' — '}
            {partnerVoted ? 'Parceiro votou!' : 'Aguardando parceiro...'}
          </p>
        )}
      </div>

      {!myVote && (
        <div className="flex justify-center gap-6 py-6">
          <button
            onClick={() => handleVote('no')}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/50 bg-zinc-900 text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <X className="h-7 w-7" />
          </button>
          <button
            onClick={() => handleVote('yes')}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-400/50 bg-zinc-900 text-green-400 hover:bg-green-400/10 transition-colors"
          >
            <Heart className="h-7 w-7" />
          </button>
        </div>
      )}
    </div>
  )
}
