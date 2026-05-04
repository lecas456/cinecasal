'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
    >
      <LogOut className="h-4 w-4" />
      Sair da conta
    </button>
  )
}
