import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { discoverMovies, getWatchProviders } from '@/lib/tmdb'
import type { Movie, WatchProviderResult, DiscoverParams } from '@/types/tmdb'

export interface RecommendationFilters {
  mood?: string
  platformId?: number
  minYear?: number
}

export interface RecommendationResult {
  movie: Movie
  providers: WatchProviderResult | null
  aiReason?: string
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function getRecommendation(
  supabase: SupabaseClient,
  filters?: RecommendationFilters
): Promise<RecommendationResult | null> {
  // Step 1: Load couple's review history
  const { data: reviews } = await supabase
    .from('reviews')
    .select('movie_id, rating, movies(title, genres)')

  const movieRatings: Record<number, { title: string; ratings: number[]; genres: { name: string }[] }> = {}

  if (reviews) {
    for (const r of reviews) {
      const movie = (r.movies as unknown) as { title: string; genres: { name: string }[] } | null
      if (!movieRatings[r.movie_id]) {
        movieRatings[r.movie_id] = {
          title: movie?.title ?? 'Desconhecido',
          ratings: [],
          genres: movie?.genres ?? [],
        }
      }
      movieRatings[r.movie_id].ratings.push(r.rating)
    }
  }

  const likedMovies = Object.values(movieRatings)
    .map(m => ({ ...m, avg: m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length }))
    .filter(m => m.avg >= 7)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)

  // Count top genres for fallback
  const genreCount: Record<string, number> = {}
  for (const m of likedMovies) {
    for (const g of m.genres) {
      genreCount[g.name] = (genreCount[g.name] ?? 0) + 1
    }
  }

  // Step 2: Get excluded IDs
  const [{ data: watchedReviews }, { data: rejectedWatchlist }] = await Promise.all([
    supabase.from('reviews').select('movie_id'),
    supabase.from('watchlist').select('movie_id').in('status', ['rejected', 'watched']),
  ])

  const excludedIds = new Set<number>([
    ...(watchedReviews?.map(r => r.movie_id) ?? []),
    ...(rejectedWatchlist?.map(w => w.movie_id) ?? []),
  ])

  // Step 3: Build TMDB discover params with filters
  const randomPage = Math.floor(Math.random() * 5) + 1

  const baseParams: DiscoverParams = {
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: randomPage,
  }

  if (filters?.platformId) {
    baseParams.with_watch_providers = String(filters.platformId)
  }

  if (filters?.minYear) {
    baseParams['primary_release_date.gte'] = `${filters.minYear}-01-01`
  }

  const discover = await discoverMovies(baseParams)
  const candidates = discover.results.filter(m => !excludedIds.has(m.id)).slice(0, 20)

  if (candidates.length === 0) return null

  // Step 4: Ask OpenAI to pick the best match
  let chosenMovie: Movie = candidates[0]
  let aiReason: string | undefined

  try {
    const tasteContext =
      likedMovies.length > 0
        ? likedMovies.map(m => `- "${m.title}" (nota média: ${m.avg.toFixed(1)})`).join('\n')
        : 'Sem histórico ainda — escolha um filme popular e bem avaliado.'

    const moodContext = filters?.mood
      ? `\nEstado de espírito / preferência de hoje: "${filters.mood}"`
      : ''

    const candidateList = candidates
      .map((m, i) => `${i + 1}. [ID:${m.id}] "${m.title}" (${m.release_date?.slice(0, 4) ?? '?'}) - ★${m.vote_average.toFixed(1)}`)
      .join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em cinema ajudando um casal a escolher um filme. Responda APENAS com JSON: {"id": <número>, "reason": "<motivo em português, 1 frase curta e pessoal>"}',
        },
        {
          role: 'user',
          content: `Filmes que o casal curtiu:\n${tasteContext}${moodContext}\n\nCandidatos disponíveis:\n${candidateList}\n\nQual recomendaria? Escolha o ID e explique em 1 frase por quê combina com esse casal.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw) as { id: number; reason: string }
    const picked = candidates.find(m => m.id === parsed.id)
    if (picked) {
      chosenMovie = picked
      aiReason = parsed.reason
    }
  } catch {
    // Fallback to first candidate
  }

  const providersData = await getWatchProviders(chosenMovie.id)
  const providers = providersData?.results?.BR ?? null

  return { movie: chosenMovie, providers, aiReason }
}
