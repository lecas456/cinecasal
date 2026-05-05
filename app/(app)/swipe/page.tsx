'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Heart, X, Eye, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_BASE } from '@/lib/tmdb'
import type { MovieLike } from '@/types/tmdb'

const SWIPE_THRESHOLD = 80
const ONBOARDING_TARGET = 12

type SwipeDirection = 'like' | 'dislike' | 'unseen' | null

interface CardState {
  x: number
  y: number
  rotate: number
  direction: SwipeDirection
}

export default function SwipePage() {
  const searchParams = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === 'true'
  const router = useRouter()
  const supabase = createClient()

  const [cards, setCards] = useState<MovieLike[]>([])
  const [loading, setLoading] = useState(true)
  const [feedError, setFeedError] = useState(false)
  const [swipeCount, setSwipeCount] = useState(0)
  const [done, setDone] = useState(false)

  const [cardState, setCardState] = useState<CardState>({ x: 0, y: 0, rotate: 0, direction: null })
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      // Try to get already-swiped IDs — fail gracefully if Supabase is unreachable
      let swipedKeys = new Set<string>()
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Garante que o perfil existe (trigger OAuth pode falhar silenciosamente)
          await supabase.from('profiles').upsert({
            id: user.id,
            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuário',
          }, { onConflict: 'id' })

          const { data: swipedRows } = await supabase
            .from('swipes')
            .select('movie_id, media_type')
            .eq('user_id', user.id)
          swipedKeys = new Set((swipedRows ?? []).map(s => `${s.media_type}-${s.movie_id}`))
        }
      } catch {
        // Supabase temporarily unreachable — show all cards unfiltered
      }

      // Fetch combined swipe feed from a single API route
      const feedRes = await fetch('/api/swipe-feed')
      if (!feedRes.ok) { setFeedError(true); return }
      const allItems: MovieLike[] = await feedRes.json()

      // Deduplicate and filter already-swiped
      const seen = new Set<string>()
      const filtered = allItems.filter(item => {
        const mediaType = item.mediaType ?? 'movie'
        const key = `${mediaType}-${item.id}`
        if (seen.has(key) || swipedKeys.has(key)) return false
        seen.add(key)
        return true
      })

      // Shuffle
      const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 50)
      setCards(shuffled)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadCards() }, [loadCards])

  const saveSwipe = useCallback(async (card: MovieLike, direction: SwipeDirection) => {
    if (!direction) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('swipes').upsert({
      user_id: user.id,
      movie_id: card.id,
      media_type: card.mediaType ?? 'movie',
      direction,
    }, { onConflict: 'user_id,movie_id,media_type' })
  }, [supabase])

  const animateOut = useCallback((card: MovieLike, direction: SwipeDirection) => {
    if (isAnimatingOut) return
    setIsAnimatingOut(true)

    let exitX = 0, exitY = 0, exitRotate = 0
    if (direction === 'like') { exitX = 600; exitRotate = 20 }
    else if (direction === 'dislike') { exitX = -600; exitRotate = -20 }
    else if (direction === 'unseen') { exitY = -600 }

    setCardState({ x: exitX, y: exitY, rotate: exitRotate, direction })

    setTimeout(async () => {
      await saveSwipe(card, direction)
      setCards(prev => prev.slice(1))
      setCardState({ x: 0, y: 0, rotate: 0, direction: null })
      setIsAnimatingOut(false)
      const newCount = swipeCount + 1
      setSwipeCount(newCount)
      if (isOnboarding && newCount >= ONBOARDING_TARGET) setDone(true)
    }, 350)
  }, [isAnimatingOut, saveSwipe, swipeCount, isOnboarding])

  // Pointer handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (isAnimatingOut || cards.length === 0) return
    dragStart.current = { x: e.clientX, y: e.clientY }
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || isAnimatingOut) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    const rotate = dx * 0.08

    let direction: SwipeDirection = null
    if (dx > SWIPE_THRESHOLD) direction = 'like'
    else if (dx < -SWIPE_THRESHOLD) direction = 'dislike'
    else if (dy < -SWIPE_THRESHOLD) direction = 'unseen'

    setCardState({ x: dx, y: dy, rotate, direction })
  }

  const onPointerUp = () => {
    if (!dragStart.current) return
    const { direction } = cardState
    dragStart.current = null

    if (direction && cards[0]) {
      animateOut(cards[0], direction)
    } else {
      // snap back
      setCardState({ x: 0, y: 0, rotate: 0, direction: null })
    }
  }

  const currentCard = cards[0]
  const nextCard = cards[1]
  const thirdCard = cards[2]

  const indicatorOpacity = Math.min(Math.abs(cardState.x) / SWIPE_THRESHOLD, 1)
  const upOpacity = Math.min(Math.abs(Math.min(cardState.y, 0)) / SWIPE_THRESHOLD, 1)

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (feedError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="text-6xl">⚠️</div>
        <h2 className="text-2xl font-black text-white">Erro ao carregar filmes</h2>
        <p className="text-zinc-400">Não conseguimos buscar os filmes. Verifique sua conexão e tente novamente.</p>
        <button
          onClick={() => { setFeedError(false); loadCards() }}
          className="rounded-2xl bg-zinc-800 hover:bg-zinc-700 px-8 py-4 text-white font-bold text-base transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (done && isOnboarding) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="text-6xl">🎬</div>
        <h2 className="text-2xl font-black text-white">Perfeito!</h2>
        <p className="text-zinc-400">Já sei o que vocês curtem. Vamos às recomendações!</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-2xl bg-red-600 hover:bg-red-700 px-8 py-4 text-white font-bold text-base transition-colors"
        >
          Ver recomendações
        </button>
      </div>
    )
  }

  if (cards.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="text-6xl">✨</div>
        <h2 className="text-2xl font-black text-white">Acabou por hoje!</h2>
        <p className="text-zinc-400">Você avaliou tudo que temos. Volte amanhã para mais.</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-2xl bg-zinc-800 hover:bg-zinc-700 px-8 py-4 text-white font-bold text-base transition-colors"
        >
          Ir para o início
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col select-none">
      {/* Header */}
      <div className="pt-12 pb-4 px-4 text-center">
        <h1 className="text-lg font-black text-white">
          {isOnboarding ? 'O que vocês curtem?' : 'Modo Swipe'}
        </h1>
        {isOnboarding && (
          <p className="text-xs text-zinc-500 mt-1">
            {Math.max(0, ONBOARDING_TARGET - swipeCount)} restantes para começar
          </p>
        )}
      </div>

      {/* Hint */}
      <div className="flex justify-center gap-6 pb-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1"><X className="h-3 w-3 text-red-500" /> Não curto</span>
        <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-blue-400" /> Não vi</span>
        <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-green-400" /> Curtir</span>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative w-full max-w-sm" style={{ height: 480 }}>

          {/* Third card (bottom) */}
          {thirdCard && (
            <div
              className="absolute inset-0 rounded-3xl overflow-hidden bg-zinc-900"
              style={{ transform: 'scale(0.92) translateY(16px)', zIndex: 1 }}
            />
          )}

          {/* Second card */}
          {nextCard && (
            <div
              className="absolute inset-0 rounded-3xl overflow-hidden bg-zinc-800"
              style={{ transform: 'scale(0.96) translateY(8px)', zIndex: 2 }}
            />
          )}

          {/* Top card — interactive */}
          {currentCard && (
            <div
              ref={cardRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="absolute inset-0 rounded-3xl overflow-hidden bg-zinc-800 cursor-grab active:cursor-grabbing touch-none"
              style={{
                zIndex: 10,
                transform: `translateX(${cardState.x}px) translateY(${cardState.y}px) rotate(${cardState.rotate}deg)`,
                transition: isAnimatingOut ? 'transform 0.35s ease-out' : 'none',
              }}
            >
              {/* Poster */}
              {currentCard.poster_path ? (
                <Image
                  src={`${IMAGE_BASE}${currentCard.poster_path}`}
                  alt={currentCard.title}
                  fill
                  sizes="400px"
                  className="object-cover pointer-events-none"
                  draggable={false}
                  priority
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-zinc-600 text-sm">Sem imagem</span>
                </div>
              )}

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              {/* Like indicator */}
              <div
                className="absolute top-8 left-6 border-4 border-green-400 rounded-xl px-4 py-2 rotate-[-20deg]"
                style={{ opacity: cardState.x > 0 ? indicatorOpacity : 0 }}
              >
                <span className="text-green-400 font-black text-2xl tracking-wide">CURTIR</span>
              </div>

              {/* Dislike indicator */}
              <div
                className="absolute top-8 right-6 border-4 border-red-500 rounded-xl px-4 py-2 rotate-[20deg]"
                style={{ opacity: cardState.x < 0 ? indicatorOpacity : 0 }}
              >
                <span className="text-red-500 font-black text-2xl tracking-wide">NÃO</span>
              </div>

              {/* Unseen indicator */}
              <div
                className="absolute top-8 left-1/2 -translate-x-1/2 border-4 border-blue-400 rounded-xl px-4 py-2"
                style={{ opacity: cardState.y < 0 ? upOpacity : 0 }}
              >
                <span className="text-blue-400 font-black text-2xl tracking-wide">NÃO VI</span>
              </div>

              {/* Info */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {currentCard.mediaType === 'tv' ? 'Série' : 'Filme'}
                    </span>
                    <h2 className="text-xl font-black text-white leading-tight mt-0.5">
                      {currentCard.title}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {currentCard.release_date?.slice(0, 4)}
                      {(currentCard.vote_average ?? 0) > 0
                        ? ` · ★ ${(currentCard.vote_average ?? 0).toFixed(1)}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-6 py-6 pb-28">
        <button
          onClick={() => currentCard && animateOut(currentCard, 'dislike')}
          disabled={isAnimatingOut || !currentCard}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/50 bg-zinc-900 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30"
        >
          <X className="h-7 w-7" />
        </button>
        <button
          onClick={() => currentCard && animateOut(currentCard, 'unseen')}
          disabled={isAnimatingOut || !currentCard}
          className="flex h-12 w-12 self-center items-center justify-center rounded-full border-2 border-blue-400/50 bg-zinc-900 text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-30"
        >
          <Eye className="h-5 w-5" />
        </button>
        <button
          onClick={() => currentCard && animateOut(currentCard, 'like')}
          disabled={isAnimatingOut || !currentCard}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-400/50 bg-zinc-900 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-30"
        >
          <Heart className="h-7 w-7" />
        </button>
      </div>

      {/* Skip onboarding */}
      {isOnboarding && (
        <div className="pb-4 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Pular por enquanto
          </button>
        </div>
      )}
    </div>
  )
}
