import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Star, Film } from 'lucide-react'
import LogoutButton from './LogoutButton'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: reviews }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('reviews').select('rating').eq('user_id', user.id),
  ])

  const totalReviews = reviews?.length ?? 0
  const avgRating =
    totalReviews > 0
      ? (reviews!.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : null

  const initial = profile?.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="bg-zinc-950 min-h-screen">
      {/* Header banner */}
      <div className="h-32 bg-gradient-to-br from-red-900 via-zinc-900 to-zinc-950" />

      <div className="px-4 pb-24 max-w-sm mx-auto -mt-12 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center space-y-3">
          <div className="h-24 w-24 rounded-full bg-red-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-red-900/50 border-4 border-zinc-950">
            {initial}
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">{profile?.name ?? 'Usuário'}</h1>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center space-y-1.5">
            <Film className="h-6 w-6 text-red-500 mx-auto" />
            <p className="text-2xl font-black text-white">{totalReviews}</p>
            <p className="text-xs text-zinc-500">Filmes avaliados</p>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center space-y-1.5">
            <Star className="h-6 w-6 text-yellow-500 mx-auto" />
            <p className="text-2xl font-black text-white">{avgRating ?? '—'}</p>
            <p className="text-xs text-zinc-500">Nota média</p>
          </div>
        </div>

        <LogoutButton />
      </div>
    </div>
  )
}
