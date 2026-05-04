export interface Movie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
  adult: boolean
  video: boolean
  original_language: string
}

export interface Genre {
  id: number
  name: string
}

export interface MovieDetails extends Omit<Movie, 'genre_ids'> {
  genres: Genre[]
  runtime: number | null
  tagline: string | null
  status: string
  budget: number
  revenue: number
  production_countries: { iso_3166_1: string; name: string }[]
  spoken_languages: { iso_639_1: string; name: string }[]
}

export interface WatchProvider {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface WatchProviderResult {
  flatrate?: WatchProvider[]
  rent?: WatchProvider[]
  buy?: WatchProvider[]
  free?: WatchProvider[]
}

export interface WatchProvidersResponse {
  id: number
  results: {
    BR?: WatchProviderResult
    [key: string]: WatchProviderResult | undefined
  }
}

export interface SearchResponse {
  page: number
  results: Movie[]
  total_pages: number
  total_results: number
}

export interface DiscoverResponse {
  page: number
  results: Movie[]
  total_pages: number
  total_results: number
}

export interface TvShow {
  id: number
  name: string
  original_name: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  first_air_date: string
  vote_average: number
  vote_count: number
  popularity: number
  genre_ids: number[]
  original_language: string
}

export type MovieLike = {
  id: number
  title: string
  poster_path: string | null
  backdrop_path?: string | null
  overview?: string | null
  release_date?: string
  vote_average?: number
  popularity?: number
  adult?: boolean
  video?: boolean
  original_language?: string
  original_title?: string
  vote_count?: number
  genre_ids?: number[]
  mediaType?: 'movie' | 'tv'
}

export interface TvDetails {
  id: number
  name: string
  original_name: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  first_air_date: string
  vote_average: number
  vote_count: number
  popularity: number
  genres: { id: number; name: string }[]
  number_of_seasons: number
  number_of_episodes: number
  status: string
  original_language: string
  networks: { id: number; name: string; logo_path: string | null }[]
}

export interface DiscoverParams {
  with_genres?: string
  with_watch_providers?: string
  watch_region?: string
  with_watch_monetization_types?: string
  with_release_type?: string
  'primary_release_date.gte'?: string
  page?: number
  language?: string
  sort_by?: string
}
