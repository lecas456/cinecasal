import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { discoverMovies, discoverTv, getWatchProviders, getTvWatchProviders } from '@/lib/tmdb'
import type { MovieLike, WatchProviderResult, DiscoverParams } from '@/types/tmdb'

export interface RecommendationFilters {
  mood?: string
  platformId?: number
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

  // ── Phase 1: Build deep couple taste profile ──────────────────────

  const { data: reviews } = await supabase
    .from('reviews')
    .select('movie_id, rating, user_id, movies(title, genres)')

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

  const topGenres = Object.entries(genreScores)
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => b.avg * Math.log(b.count + 1) - a.avg * Math.log(a.count + 1))
    .slice(0, 6)

  // ── Phase 2: Excluded IDs ──────────────────────────────────────────

  const [{ data: watchedReviews }, { data: rejectedWatchlist }] = await Promise.all([
    supabase.from('reviews').select('movie_id'),
    supabase.from('watchlist').select('movie_id').in('status', ['rejected', 'watched']),
  ])

  const excludedIds = new Set<number>([
    ...(watchedReviews?.map(r => r.movie_id) ?? []),
    ...(rejectedWatchlist?.map(w => w.movie_id) ?? []),
  ])

  // ── Phase 3: Discover candidates — movies + TV ────────────────────

  const randomPage = Math.floor(Math.random() * 10) + 1

  const baseParams: DiscoverParams = {
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: randomPage,
    ...(filters?.platformId ? { with_watch_providers: String(filters.platformId) } : {}),
    ...(filters?.minYear ? { 'primary_release_date.gte': `${filters.minYear}-01-01` } : {}),
  }

  const tvParams: Record<string, string | number | undefined> = {
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: randomPage,
    ...(filters?.platformId ? { with_watch_providers: String(filters.platformId) } : {}),
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

  // Bias toward high-scored items, then shuffle within groups
  const scored = candidates
    .sort((a, b) => (b.score * 0.6 + b.popularity * 0.001) - (a.score * 0.6 + a.popularity * 0.001))
    .slice(0, 30)

  // ── Phase 4: AI analysis — deep reasoning ──────────────────────────

  let chosenId = scored[0].id
  let chosenType: 'movie' | 'tv' = scored[0].type
  let aiReason: string | undefined

  const hasHistory = loved.length > 0 || disliked.length > 0

  const tasteProfile = hasHistory
    ? [
        `Filmes/séries que o casal AMOU: ${loved.slice(0, 6).join(' | ') || 'nenhum ainda'}`,
        disliked.length > 0 ? `Não gostaram de: ${disliked.slice(0, 3).join(' | ')}` : '',
        `Gêneros favoritos por nota: ${topGenres.map(g => `${g.name} (★${g.avg.toFixed(1)}, ${g.count}x)`).join(', ') || 'indefinido'}`,
      ].filter(Boolean).join('\n')
    : 'Casal sem histórico ainda — escolha algo popular, bem avaliado e acessível.'

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
          content: `Você é um crítico de cinema e séries especialista em recomendar para casais.
Analise o perfil de gosto do casal com cuidado e escolha a opção que mais combina.
Responda SOMENTE com JSON válido, sem markdown:
{"id": <número>, "type": "movie" ou "tv", "reason": "<2 frases em português — 1ª conecta com o gosto do casal, 2ª descreve o que torna essa obra especial>"}
A razão deve ser pessoal e específica: mencione gostos concretos do casal ou o clima pedido.`,
        },
        {
          role: 'user',
          content: `PERFIL DO CASAL:\n${tasteProfile}${moodLine}${mediaTypeHint}

CANDIDATOS DISPONÍVEIS (streaming BR):
${candidateList}

Qual obra esse casal vai mais amar hoje à noite? Justifique em 2 frases conectando com o perfil deles.`,
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
