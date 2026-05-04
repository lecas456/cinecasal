import MovieCard, { type MovieLike } from '@/components/MovieCard'

interface MovieCarouselProps {
  title: string
  movies: MovieLike[]
  showNumbers?: boolean
  showAdd?: boolean
}

export default function MovieCarousel({ title, movies, showNumbers = false, showAdd = false }: MovieCarouselProps) {
  if (movies.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="px-4 text-base font-bold text-white">{title}</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
        {movies.map((movie, i) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            rank={showNumbers ? i + 1 : undefined}
            showAdd={showAdd}
            width={showNumbers ? 110 : 120}
          />
        ))}
      </div>
    </div>
  )
}
