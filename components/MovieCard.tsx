import Link from 'next/link'
import Image from 'next/image'
import { IMAGE_BASE } from '@/lib/tmdb'
import AddToWatchlistButton from '@/components/AddToWatchlistButton'
import type { MovieLike } from '@/types/tmdb'

export type { MovieLike }

// Dimensions for Top 10 numbered cards
const POSTER_W = 88
const PEEK_W = 32

interface MovieCardProps {
  movie: MovieLike
  showAdd?: boolean
  rank?: number
  width?: number
  href?: string | null  // null = not clickable
}

export default function MovieCard({ movie, showAdd = false, rank, width = 120, href }: MovieCardProps) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const defaultHref = movie.mediaType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`
  const destination = href !== undefined ? href : defaultHref

  // Top-10 numbered card layout (Netflix style: number peeks from left)
  if (rank !== undefined) {
    const isDoubleDigit = rank >= 10
    return (
      <div className="relative shrink-0 group" style={{ width: POSTER_W + PEEK_W }}>
        {/* Invisible spacer to define container height via aspect ratio */}
        <div style={{ width: POSTER_W, marginLeft: PEEK_W, aspectRatio: '2/3' }} className="invisible" />

        {/* Large outline number — sits behind the poster */}
        <span
          className="absolute left-0 bottom-6 z-0 select-none font-black leading-none"
          style={{
            fontSize: isDoubleDigit ? 54 : 76,
            color: 'transparent',
            WebkitTextStroke: '2px #52525b',
            lineHeight: 1,
          }}
        >
          {rank}
        </span>

        {/* Poster — overlaps the right side of the number */}
        <ConditionalLink href={destination} className="absolute right-0 top-0 z-10 block" style={{ width: POSTER_W }}>
          <div className="relative overflow-hidden rounded-md bg-zinc-800" style={{ aspectRatio: '2/3' }}>
            {movie.poster_path && (
              <Image
                src={`${IMAGE_BASE}${movie.poster_path}`}
                alt={movie.title}
                fill
                sizes={`${POSTER_W}px`}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-400 line-clamp-1 pr-1">{movie.title}</p>
        </ConditionalLink>
      </div>
    )
  }

  // Standard card
  return (
    <div className="relative shrink-0 group" style={{ width }}>
      <ConditionalLink href={destination} className="block">
        <div className="relative overflow-hidden rounded-md bg-zinc-800" style={{ aspectRatio: '2/3' }}>
          {movie.poster_path ? (
            <Image
              src={`${IMAGE_BASE}${movie.poster_path}`}
              alt={movie.title}
              fill
              sizes={`${width}px`}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600 text-xs text-center p-2">
              Sem imagem
            </div>
          )}
        </div>
        <div className="mt-1.5 space-y-0.5 px-0.5">
          <p className="text-xs font-medium text-zinc-300 line-clamp-1">{movie.title}</p>
          {year && <p className="text-[10px] text-zinc-600">{year}</p>}
        </div>
      </ConditionalLink>

      {showAdd && (
        <div className="absolute top-1.5 right-1.5 z-20">
          <AddToWatchlistButton movie={movie} variant="icon" />
        </div>
      )}
    </div>
  )
}

function ConditionalLink({
  href,
  children,
  className,
  style,
}: {
  href: string | null
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  if (!href) {
    return <div className={className} style={style}>{children}</div>
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  )
}
