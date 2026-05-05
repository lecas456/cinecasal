'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users2, Plus, ArrowRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function MatchPage() {
  const router = useRouter()
  const supabase = createClient()
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setLoading('create')
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const code = generateCode()
      const { error: insertError } = await supabase
        .from('match_sessions')
        .insert({ code, leader_id: user.id, status: 'waiting' })

      if (insertError) { setError('Erro ao criar sala. Tente novamente.'); return }
      router.push(`/match/${code}`)
    } finally {
      setLoading(null)
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 6) { setError('Código precisa ter 6 caracteres.'); return }

    setLoading('join')
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: session } = await supabase
        .from('match_sessions')
        .select('id, leader_id, partner_id, status')
        .eq('code', code)
        .single()

      if (!session) { setError('Sala não encontrada.'); return }
      if (session.leader_id === user.id) { router.push(`/match/${code}`); return }
      if (session.status !== 'waiting') { setError('Essa sala já foi iniciada.'); return }
      if (session.partner_id && session.partner_id !== user.id) {
        setError('Essa sala já está cheia.')
        return
      }

      await supabase
        .from('match_sessions')
        .update({ partner_id: user.id })
        .eq('code', code)

      router.push(`/match/${code}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 pb-28">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <Users2 className="h-14 w-14 text-red-500 mx-auto" />
          <h1 className="text-2xl font-black text-white">CineMatch</h1>
          <p className="text-zinc-400 text-sm">Decidam juntos o que assistir hoje</p>
        </div>

        <button
          onClick={handleCreate}
          disabled={!!loading}
          className="w-full flex items-center justify-between rounded-2xl bg-red-600 hover:bg-red-700 px-6 py-5 text-white font-bold transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-3">
            <Plus className="h-5 w-5" />
            Criar sala
          </span>
          {loading === 'create'
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : <ArrowRight className="h-5 w-5" />}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-xs">ou entre com um código</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <div className="space-y-3">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="CÓDIGO"
            className="w-full rounded-2xl bg-zinc-900 border border-zinc-700 px-5 py-4 text-white text-center font-mono text-2xl tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
            maxLength={6}
          />
          <button
            onClick={handleJoin}
            disabled={!!loading || joinCode.length < 6}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 px-6 py-5 text-white font-bold transition-colors disabled:opacity-40"
          >
            {loading === 'join' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
            Entrar na sala
          </button>
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}
