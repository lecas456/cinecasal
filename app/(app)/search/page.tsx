'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import MovieCard from '@/components/MovieCard'
import { MovieCardSkeleton } from '@/components/SkeletonCard'
import type { MovieLike } from '@/types/tmdb'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieLike[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      setResults(await res.json())
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  return (
    <div className="bg-zinc-950 min-h-screen p-4 space-y-5">
      {/* Search bar */}
      <div className="relative pt-2">
        <Search className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar filmes e séries..."
          autoFocus
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-10 pr-10 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <MovieCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="text-xs text-zinc-500">{results.length} resultados para &ldquo;{query}&rdquo;</p>
          <div className="grid grid-cols-3 gap-3">
            {results.map(item => (
              <MovieCard key={`${item.mediaType ?? 'movie'}-${item.id}`} movie={item} showAdd width={108} />
            ))}
          </div>
        </>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum resultado para &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {!loading && query.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Digite para buscar um filme</p>
          <p className="text-xs mt-1 text-zinc-700">Filmes e séries — toque em + para adicionar à lista</p>
        </div>
      )}
    </div>
  )
}
