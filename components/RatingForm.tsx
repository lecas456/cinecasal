'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Review } from '@/types/database'

interface RatableItem {
  id: number
  title: string
  overview?: string | null
  poster_path: string | null
  genres: { id: number; name: string }[]
  release_date?: string | null
}

interface RatingFormProps {
  movie: RatableItem
  reviews: Review[]
  currentUserId: string
  profiles: { id: string; name: string }[]
}

export default function RatingForm({ movie, reviews, currentUserId, profiles }: RatingFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const myReview = reviews.find(r => r.user_id === currentUserId)
  const partnerReview = reviews.find(r => r.user_id !== currentUserId)

  const [rating, setRating] = useState(myReview?.rating ?? 0)
  const [hovered, setHovered] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const partnerProfile = profiles.find(p => p.id === partnerReview?.user_id)
  const myProfile = profiles.find(p => p.id === currentUserId)

  const coupleAvg =
    myReview && partnerReview
      ? ((myReview.rating + partnerReview.rating) / 2).toFixed(1)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) return
    setLoading(true)
    setError(null)

    await supabase.from('movies').upsert({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      genres: movie.genres,
      release_date: movie.release_date || null,
    })

    const { error: reviewError } = await supabase.from('reviews').upsert(
      { movie_id: movie.id, user_id: currentUserId, rating },
      { onConflict: 'movie_id,user_id' }
    )

    if (reviewError) {
      setError('Erro ao salvar avaliação.')
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-white">Avaliação do Casal</h2>

      {/* Couple average */}
      {coupleAvg && (
        <div className="flex items-center justify-between rounded-xl bg-red-950/30 border border-red-900/40 px-4 py-3">
          <span className="text-sm font-semibold text-white">Média do Casal</span>
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-xl font-black text-yellow-400">{coupleAvg}</span>
            <span className="text-xs text-zinc-500">/10</span>
          </div>
        </div>
      )}

      {/* Partner rating */}
      {partnerReview && (
        <div className="flex items-center justify-between rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
          <span className="text-sm text-zinc-400">
            {partnerProfile?.name ?? 'Parceiro(a)'}
          </span>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
            <span className="font-bold text-white text-sm">{partnerReview.rating}/10</span>
          </div>
        </div>
      )}

      {/* My rating */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <p className="text-sm text-zinc-400 mb-3">
            {myReview
              ? `Sua nota (${myProfile?.name ?? 'você'})`
              : `Dar nota (${myProfile?.name ?? 'você'})`}
          </p>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(n)}
                className="flex-1 flex justify-center"
              >
                <Star
                  className={`h-6 w-6 transition-all ${
                    n <= (hovered || rating)
                      ? 'fill-yellow-400 text-yellow-400 scale-110'
                      : 'text-zinc-700'
                  }`}
                />
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="text-center text-sm text-zinc-400 mt-2">
              {hovered || rating}/10
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || rating === 0}
          className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 py-3 text-sm font-bold text-white transition-colors"
        >
          {loading ? 'Salvando...' : myReview ? 'Atualizar nota' : 'Avaliar'}
        </button>
      </form>
    </div>
  )
}
