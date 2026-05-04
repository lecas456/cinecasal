export interface Profile {
  id: string
  name: string
  avatar_url: string | null
}

export interface MovieRow {
  id: number
  title: string
  overview: string | null
  poster_path: string | null
  genres: { id: number; name: string }[] | null
  release_date: string | null
}

export interface Review {
  id: string
  movie_id: number
  user_id: string
  rating: number
  review_text: string | null
  watched_at: string
}

export interface ReviewWithMovie extends Review {
  movies: MovieRow
}

export interface ReviewWithProfile extends Review {
  profiles: Profile
}

export interface WatchlistItem {
  id: string
  movie_id: number
  status: 'pending' | 'accepted' | 'rejected' | 'watched'
  added_by: string | null
  created_at: string
}

export interface WatchlistWithMovie extends WatchlistItem {
  movie?: MovieRow
}
