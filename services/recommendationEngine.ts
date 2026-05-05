import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { discoverMovies, discoverTv, getWatchProviders, getTvWatchProviders } from '@/lib/tmdb'
import type { MovieLike, WatchProviderResult, DiscoverParams } from '@/types/tmdb'

export interface RecommendationFilters {
  mood?: string
  platformIds?: number[]
  minYear?: number
  mediaType?: 'movie' | 'tv' | 'both'
}

export interface RecommendationResult {
  movie: MovieLike
  providers: WatchProviderResult | null
  aiReason?: string
  mediaType: 'movie' | 'tv'
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface Candidate {
  id: number
  title: string
  year: string
  score: number
  type: 'movie' | 'tv'
  overview: string
  genres: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  popularity: number
}

export async function getRecommendation(
  supabase: SupabaseClient,
  filters?: RecommendationFilters
): Promise<RecommendationResult | null> {

  // ── Phase 1: Build user taste profile ────────────────────────────

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id

  const { data: reviews } = await supabase
    .from('reviews')
    .select('movie_id, rating, user_id, movies(title, genres)')
    .eq('user_id', userId)

  const movieMap: Record<number, {
    title: string
    genres: { id: number; name: string }[]
    ratings: { userId: string; rating: number }[]
  }> = {}

  if (reviews) {
    for (const r of reviews) {
      const m = (r.movies as unknown) as { title: string; genres: { id: number; name: string }[] } | null
      if (!movieMap[r.movie_id]) {
        movieMap[r.movie_id] = { title: m?.title ?? '?', genres: m?.genres ?? [], ratings: [] }
      }
      movieMap[r.movie_id].ratings.push({ userId: r.user_id, rating: r.rating })
    }
  }

  const loved: string[] = []
  const disliked: string[] = []
  const genreScores: Record<string, { total: number; count: number }> = {}
  const lovedGenreIds: Set<number> = new Set()

  for (const data of Object.values(movieMap)) {
    const avg = data.ratings.reduce((s, r) => s + r.rating, 0) / data.ratings.length
    if (avg >= 7) {
      loved.push(`"${data.title}" ★${avg.toFixed(1)}`)
      for (const g of data.genres) lovedGenreIds.add(g.id)
    } else if (avg < 5) {
      disliked.push(`"${data.title}" ★${avg.toFixed(1)}`)
    }
    for (const g of data.genres) {
      if (!genreScores[g.name]) genreScores[g.name] = { total: 0, count: 0 }
      genreScores[g.name].total += avg
      genreScores[g.name].count += 1
    }
  }

  // topGenres calculated after Phase 2 (swipes also contribute to genreScores)

  // ── Phase 2: Excluded IDs + swipe signals ─────────────────────────

  const [{ data: watchedReviews }, { data: rejectedWatchlist }, { data: swipes }] = await Promise.all([
    supabase.from('reviews').select('movie_id').eq('user_id', userId),
    supabase.from('watchlist').select('movie_id').in('status', ['rejected', 'watched']),
    supabase.from('swipes').select('movie_id, direction, media_type, movies(title, genres)'),
  ])

  const swipeLiked   = (swipes ?? []).filter(s => s.direction === 'like')
  const swipeDisliked = (swipes ?? []).filter(s => s.direction === 'dislike')

  const swipeDislikedIds = new Set<number>(swipeDisliked.map(s => s.movie_id))
  const swipeLikedIds    = new Set<number>(swipeLiked.map(s => s.movie_id))

  // Build genre scores from swipes that are in the movies cache
  for (const s of swipeLiked) {
    const m = (s.movies as unknown) as { title: string; genres: { id: number; name: string }[] } | null
    if (!m?.genres) continue
    const weight = s.direction === 'like' ? 1 : 0
    if (weight === 0) continue
    for (const g of m.genres) {
      if (!genreScores[g.name]) genreScores[g.name] = { total: 0, count: 0 }
      genreScores[g.name].total += 7 * weight // swipe like ≈ nota 7
      genreScores[g.name].count += weight
      if (weight > 0) lovedGenreIds.add(g.id)
    }
  }

  // Re-sort top genres including swipe signals
  const topGenres = Object.entries(genreScores)
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => b.avg * Math.log(b.count + 1) - a.avg * Math.log(a.count + 1))
    .slice(0, 6)

  const excludedIds = new Set<number>([
    ...(watchedReviews?.map(r => r.movie_id) ?? []),
    ...(rejectedWatchlist?.map(w => w.movie_id) ?? []),
    ...swipeDislikedIds,
  ])

  // ── Phase 3: Discover candidates — movies + TV ────────────────────

  const randomPage = Math.floor(Math.random() * 10) + 1

  const platformFilter = filters?.platformIds?.length
    ? { with_watch_providers: filters.platformIds.join('|') }
    : {}

  const baseParams: DiscoverParams = {
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: randomPage,
    ...platformFilter,
    ...(filters?.minYear ? { 'primary_release_date.gte': `${filters.minYear}-01-01` } : {}),
  }

  const tvParams: Record<string, string | number | undefined> = {
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: randomPage,
    ...platformFilter,
    ...(filters?.minYear ? { 'first_air_date.gte': `${filters.minYear}-01-01` } : {}),
  }

  const wantMovies = !filters?.mediaType || filters.mediaType !== 'tv'
  const wantTv = !filters?.mediaType || filters.mediaType !== 'movie'

  const [movieDiscover, tvDiscover] = await Promise.all([
    wantMovies ? discoverMovies(baseParams) : Promise.resolve({ page: 1, results: [], total_pages: 0, total_results: 0 }),
    wantTv ? discoverTv(tvParams) : Promise.resolve({ results: [] }),
  ])

  const candidates: Candidate[] = []

  for (const m of movieDiscover.results) {
    if (!excludedIds.has(m.id)) {
      candidates.push({
        id: m.id,
        title: m.title,
        year: m.release_date?.slice(0, 4) ?? '?',
        score: m.vote_average,
        type: 'movie',
        overview: m.overview?.slice(0, 120) ?? '',
        genres: '', // movies don't return genre names from discover
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        release_date: m.release_date ?? '',
        popularity: m.popularity,
      })
    }
  }

  for (const tv of tvDiscover.results) {
    if (!excludedIds.has(tv.id)) {
      candidates.push({
        id: tv.id,
        title: tv.name,
        year: tv.first_air_date?.slice(0, 4) ?? '?',
        score: tv.vote_average,
        type: 'tv',
        overview: tv.overview?.slice(0, 120) ?? '',
        genres: '',
        poster_path: tv.poster_path,
        backdrop_path: tv.backdrop_path,
        release_date: tv.first_air_date ?? '',
        popularity: tv.popularity,
      })
    }
  }

  if (candidates.length === 0) return null

  // Swipe liked titles for AI — up to 20 (primary taste signal)
  const swipeLikedTitles = swipeLiked.slice(0, 20).map(s => {
    const m = (s.movies as unknown) as { title: string } | null
    return m?.title ? `"${m.title}"` : null
  }).filter(Boolean) as string[]

  // Also collect titles of liked candidates that appear in the discover pool
  for (const c of candidates) {
    if (swipeLikedIds.has(c.id) && !swipeLikedTitles.includes(`"${c.title}"`)) {
      swipeLikedTitles.push(`"${c.title}"`)
    }
  }

  const swipeDislikedTitles = swipeDisliked.slice(0, 10).map(s => {
    const m = (s.movies as unknown) as { title: string } | null
    return m?.title ? `"${m.title}"` : null
  }).filter(Boolean) as string[]

  // Higher boost for swipe likes; scale by engagement (more swipes = more confidence)
  const swipeBoostMultiplier = Math.min(swipeLiked.length / 10, 3)
  const scored = candidates
    .sort((a, b) => {
      const boostA = swipeLikedIds.has(a.id) ? 2 * swipeBoostMultiplier : 0
      const boostB = swipeLikedIds.has(b.id) ? 2 * swipeBoostMultiplier : 0
      return (b.score * 0.6 + b.popularity * 0.001 + boostB) - (a.score * 0.6 + a.popularity * 0.001 + boostA)
    })
    .slice(0, 30)

  // ── Phase 4: AI analysis — deep reasoning ──────────────────────────

  let chosenId = scored[0].id
  let chosenType: 'movie' | 'tv' = scored[0].type
  let aiReason: string | undefined

  const hasHistory = loved.length > 0 || disliked.length > 0

  const swipeContext = swipeLikedTitles.length > 0
    ? `SWIPES — curtiu (quer assistir, ${swipeLiked.length} no total): ${swipeLikedTitles.join(', ')}`
    : ''
  const swipeDislikedContext = swipeDislikedTitles.length > 0
    ? `SWIPES — passou (não quer, ${swipeDisliked.length} no total): ${swipeDislikedTitles.join(', ')}`
    : ''

  const hasSwipeData = swipeLiked.length >= 3
  const swipeNote = hasSwipeData
    ? `\n⚡ O usuário avaliou ${(swipes ?? []).length} itens no swipe — use isso como sinal PRINCIPAL de gosto.`
    : ''

  const tasteProfile = hasHistory || hasSwipeData
    ? [
        swipeContext,
        swipeDislikedContext,
        loved.length > 0 ? `Avaliados com nota alta: ${loved.slice(0, 6).join(' | ')}` : '',
        disliked.length > 0 ? `Avaliados com nota baixa: ${disliked.slice(0, 3).join(' | ')}` : '',
        topGenres.length > 0
          ? `Gêneros inferidos (reviews + swipes): ${topGenres.map(g => `${g.name} (${g.count}x)`).join(', ')}`
          : '',
      ].filter(Boolean).join('\n') + swipeNote
    : 'Usuário sem histórico ainda — escolha algo popular, bem avaliado e acessível.'

  const moodLine = filters?.mood ? `\nESTADO DE ESPÍRITO HOJE: "${filters.mood}"` : ''
  const mediaTypeHint = filters?.mediaType === 'tv'
    ? '\nPREFERÊNCIA: só séries'
    : filters?.mediaType === 'movie'
    ? '\nPREFERÊNCIA: só filmes'
    : ''

  const candidateList = scored
    .map(c =>
      `[ID:${c.id}|${c.type === 'tv' ? 'SÉRIE' : 'FILME'}] "${c.title}" (${c.year}) ★${c.score.toFixed(1)} — ${c.overview}`
    )
    .join('\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.85,
      max_tokens: 320,
      messages: [
        {
          role: 'system',
          content: `Você é um crítico de cinema e séries especialista em recomendações personalizadas.
Analise o perfil de gosto do usuário com cuidado e escolha a opção que mais combina.
Responda SOMENTE com JSON válido, sem markdown:
{"id": <número>, "type": "movie" ou "tv", "reason": "<2 frases em português — 1ª conecta com o gosto do usuário, 2ª descreve o que torna essa obra especial>"}
A razão deve ser pessoal e específica: mencione gostos concretos do usuário ou o clima pedido.`,
        },
        {
          role: 'user',
          content: `PERFIL DO USUÁRIO:\n${tasteProfile}${moodLine}${mediaTypeHint}

CANDIDATOS DISPONÍVEIS (streaming BR):
${candidateList}

Analise os títulos curtidos no swipe para inferir gêneros, temas e estilos preferidos. Qual obra esse usuário vai mais amar? Justifique em 2 frases conectando com o perfil dele.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { id: number; type?: string; reason: string }
      const picked = scored.find(c => c.id === parsed.id)
      if (picked) {
        chosenId = picked.id
        chosenType = parsed.type === 'tv' ? 'tv' : picked.type
        aiReason = parsed.reason
      }
    }
  } catch {
    // fallback — first candidate
  }

  // ── Phase 5: Fetch providers + build result ───────────────────────

  const chosen = scored.find(c => c.id === chosenId) ?? scored[0]
  chosenType = chosen.type

  const providersData = chosenType === 'tv'
    ? await getTvWatchProviders(chosenId)
    : await getWatchProviders(chosenId)
  const providers = providersData?.results?.BR ?? null

  const movie: MovieLike = {
    id: chosen.id,
    title: chosen.title,
    poster_path: chosen.poster_path,
    backdrop_path: chosen.backdrop_path,
    overview: chosen.overview,
    release_date: chosen.release_date,
    vote_average: chosen.score,
    popularity: chosen.popularity,
    mediaType: chosenType,
  }

  return { movie, providers, aiReason, mediaType: chosenType }
}
