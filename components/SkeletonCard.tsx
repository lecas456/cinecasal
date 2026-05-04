import { Skeleton } from '@/components/ui/skeleton'

export function MovieCardSkeleton() {
  return (
    <div className="space-y-2 shrink-0" style={{ width: 108 }}>
      <Skeleton className="w-full rounded-md bg-zinc-800 animate-pulse" style={{ aspectRatio: '2/3' }} />
      <Skeleton className="h-3 w-3/4 bg-zinc-800 rounded" />
      <Skeleton className="h-2.5 w-1/2 bg-zinc-800 rounded" />
    </div>
  )
}

export function RecommendationSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-5 w-40 bg-zinc-800 rounded" />
      <Skeleton className="w-full bg-zinc-800 rounded-xl" style={{ aspectRatio: '2/3', maxWidth: 200, margin: '0 auto' }} />
      <Skeleton className="h-6 w-2/3 bg-zinc-800 rounded" />
      <Skeleton className="h-4 w-full bg-zinc-800 rounded" />
    </div>
  )
}
