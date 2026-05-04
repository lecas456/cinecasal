import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecommendation } from '@/services/recommendationEngine'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const mood = searchParams.get('mood') ?? undefined
  const platformId = searchParams.get('platformId') ? Number(searchParams.get('platformId')) : undefined
  const minYear = searchParams.get('minYear') ? Number(searchParams.get('minYear')) : undefined

  const result = await getRecommendation(supabase, { mood, platformId, minYear })

  if (!result) {
    return NextResponse.json({ error: 'Nenhuma recomendação encontrada' }, { status: 404 })
  }

  return NextResponse.json(result)
}
