'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MovieLike } from '@/components/MovieCard'

interface Props {
  movie: MovieLike
  className?: string
  variant?: 'icon' | 'full'
}

export default function AddToWatchlistButton({ movie, className = '', variant = 'icon' }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'added'>('idle')
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, [supabase])

  async function handleAdd() {
    if (state !== 'idle') return
    setState('loading')

    // Upsert movie to local cache
    await supabase.from('movies').upsert({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      release_date: movie.release_date || null,
    })

    // Check if already in watchlist (RLS filters by user automatically)
    const { data: existing } = await supabase
      .from('watchlist')
      .select('id')
      .eq('movie_id', movie.id)
      .in('status', ['pending', 'accepted'])
      .single()

    if (!existing) {
      await supabase.from('watchlist').insert({
        movie_id: movie.id,
        status: 'pending',
        added_by: userId,
      })
    }

    setState('added')
  }

  if (variant === 'full') {
    return (
      <button
        onClick={handleAdd}
        disabled={state !== 'idle'}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
          state === 'added'
            ? 'border-green-600 bg-green-600/10 text-green-400'
            : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
        } ${className}`}
      >
        {state === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === 'added' ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {state === 'added' ? 'Na lista' : 'Minha lista'}
      </button>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={state !== 'idle'}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
        state === 'added'
          ? 'bg-green-600 text-white'
          : 'bg-black/60 text-white hover:bg-black/80 border border-white/30'
      } ${className}`}
      title="Adicionar à lista"
    >
      {state === 'loading' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === 'added' ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
