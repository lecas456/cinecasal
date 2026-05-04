import type {
  SearchResponse,
  Movie,
  MovieLike,
  MovieDetails,
  WatchProvidersResponse,
  DiscoverResponse,
  DiscoverParams,
  TvShow,
  TvDetails,
} from '@/types/tmdb'

const BASE = 'https://api.themoviedb.org/3'
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
export const IMAGE_BASE_ORIGINAL = 'https://image.tmdb.org/t/p/original'

export const STREAMING_PLATFORMS_BR = [
  { id: 8,    name: 'Netflix' },
  { id: 119,  name: 'Prime Video' },
  { id: 337,  name: 'Disney+' },
  { id: 1899, name: 'Max' },
  { id: 307,  name: 'Globoplay' },
  { id: 531,  name: 'Paramount+' },
  { id: 350,  name: 'Apple TV+' },
] as const

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const params = new URLSearchParams({ query, language: 'pt-BR', include_adult: 'false' })
  const res = await fetch(`${BASE}/search/movie?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  const data: SearchResponse = await res.json()
  return data.results
}

export async function getTrending(): Promise<Movie[]> {
  const res = await fetch(`${BASE}/trending/movie/day?language=pt-BR`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data: SearchResponse = await res.json()
  return data.results.slice(0, 10)
}

export async function getTopStreamingMovies(): Promise<Movie[]> {
  const params = new URLSearchParams({
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc',
    language: 'pt-BR',
  })
  const res = await fetch(`${BASE}/discover/movie?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data: DiscoverResponse = await res.json()
  return data.results.slice(0, 10)
}

export async function getTopStreamingTv(): Promise<MovieLike[]> {
  const res = await fetch(`${BASE}/trending/tv/day?language=pt-BR`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data: { results: TvShow[] } = await res.json()
  return data.results.slice(0, 10).map(tv => ({
    id: tv.id,
    title: tv.name,
    original_title: tv.original_name,
    poster_path: tv.poster_path,
    backdrop_path: tv.backdrop_path,
    overview: tv.overview,
    release_date: tv.first_air_date,
    vote_average: tv.vote_average,
    vote_count: tv.vote_count,
    popularity: tv.popularity,
    adult: false,
    video: false,
    original_language: tv.original_language,
    genre_ids: tv.genre_ids,
    mediaType: 'tv' as const,
  }))
}

export async function searchTv(query: string): Promise<MovieLike[]> {
  const params = new URLSearchParams({ query, language: 'pt-BR', include_adult: 'false' })
  const res = await fetch(`${BASE}/search/tv?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  const data: { results: TvShow[] } = await res.json()
  return data.results.slice(0, 10).map(tv => ({
    id: tv.id,
    title: tv.name,
    original_title: tv.original_name,
    poster_path: tv.poster_path,
    backdrop_path: tv.backdrop_path,
    overview: tv.overview,
    release_date: tv.first_air_date,
    vote_average: tv.vote_average,
    vote_count: tv.vote_count,
    popularity: tv.popularity,
    adult: false,
    video: false,
    original_language: tv.original_language,
    genre_ids: tv.genre_ids,
    mediaType: 'tv' as const,
  }))
}

export async function getTvDetails(id: number): Promise<TvDetails | null> {
  const params = new URLSearchParams({ language: 'pt-BR' })
  const res = await fetch(`${BASE}/tv/${id}?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

export async function getTvWatchProviders(id: number): Promise<WatchProvidersResponse | null> {
  const res = await fetch(`${BASE}/tv/${id}/watch/providers`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

async function discoverByGenre(genreId: number, extra?: Record<string, string>): Promise<Movie[]> {
  const params = new URLSearchParams({
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc',
    language: 'pt-BR',
    with_genres: String(genreId),
    ...extra,
  })
  const res = await fetch(`${BASE}/discover/movie?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data: DiscoverResponse = await res.json()
  return data.results.slice(0, 10)
}

async function discoverTvByGenre(genreId: number, extra?: Record<string, string>): Promise<MovieLike[]> {
  const params = new URLSearchParams({
    sort_by: 'popularity.desc',
    language: 'pt-BR',
    with_genres: String(genreId),
    ...extra,
  })
  const res = await fetch(`${BASE}/discover/tv?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data: { results: TvShow[] } = await res.json()
  return data.results.slice(0, 10).map(tv => ({
    id: tv.id,
    title: tv.name,
    original_title: tv.original_name,
    poster_path: tv.poster_path,
    backdrop_path: tv.backdrop_path,
    overview: tv.overview,
    release_date: tv.first_air_date,
    vote_average: tv.vote_average,
    vote_count: tv.vote_count,
    popularity: tv.popularity,
    adult: false,
    video: false,
    original_language: tv.original_language,
    genre_ids: tv.genre_ids,
    mediaType: 'tv' as const,
  }))
}

export const getTopComedies = () => discoverByGenre(35)
export const getTopAction = () => discoverByGenre(28)
export const getTopHorror = () => discoverByGenre(27)
export const getTopSciFi = () => discoverByGenre(878)
export const getTopRomance = () => discoverByGenre(10749)

// Crunchyroll provider ID on TMDB (BR)
const CRUNCHYROLL_ID = '283'

export async function getTopAnime(): Promise<MovieLike[]> {
  const [movies, tvShows] = await Promise.all([
    discoverByGenre(16, {
      with_original_language: 'ja',
      with_watch_providers: CRUNCHYROLL_ID,
      include_adult: 'false',
      'vote_count.gte': '100',
    }),
    discoverTvByGenre(16, {
      with_original_language: 'ja',
      with_watch_providers: CRUNCHYROLL_ID,
      watch_region: 'BR',
      with_watch_monetization_types: 'flatrate',
      'vote_count.gte': '100',
    }),
  ])
  const combined: MovieLike[] = [
    ...movies.map(m => ({ ...m, mediaType: 'movie' as const })),
    ...tvShows,
  ]
  return combined
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 10)
}

export async function getMovieDetails(id: number): Promise<MovieDetails | null> {
  const params = new URLSearchParams({ language: 'pt-BR' })
  const res = await fetch(`${BASE}/movie/${id}?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

export async function getWatchProviders(id: number): Promise<WatchProvidersResponse | null> {
  const res = await fetch(`${BASE}/movie/${id}/watch/providers`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

export async function discoverMovies(params: DiscoverParams): Promise<DiscoverResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('language', 'pt-BR')
  searchParams.set('sort_by', 'popularity.desc')
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) searchParams.set(k, String(v))
  })
  const res = await fetch(`${BASE}/discover/movie?${searchParams}`, {
    headers: getHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) return { page: 1, results: [], total_pages: 0, total_results: 0 }
  return res.json()
}

export async function discoverTv(params: Record<string, string | number | undefined>): Promise<{ results: TvShow[] }> {
  const searchParams = new URLSearchParams()
  searchParams.set('language', 'pt-BR')
  searchParams.set('sort_by', 'popularity.desc')
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) searchParams.set(k, String(v))
  })
  const res = await fetch(`${BASE}/discover/tv?${searchParams}`, {
    headers: getHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) return { results: [] }
  return res.json()
}
