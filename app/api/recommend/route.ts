import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecommendation } from '@/services/recommendationEngine'
import type { RecommendationFilters } from '@/services/recommendationEngine'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const mood = searchParams.get('mood') ?? undefined
  const rawPlatformIds = searchParams.get('platformIds')
  const platformIds = rawPlatformIds
    ? rawPlatformIds.split(',').map(Number).filter(n => !isNaN(n))
    : []
  const minYear = searchParams.get('minYear') ? Number(searchParams.get('minYear')) : undefined
  const rawMediaType = searchParams.get('mediaType')
  const mediaType: RecommendationFilters['mediaType'] =
    rawMediaType === 'movie' || rawMediaType === 'tv' ? rawMediaType : 'both'

  const result = await getRecommendation(supabase, { mood, platformIds, minYear, mediaType })

  if (!result) {
    return NextResponse.json({ error: 'Nenhuma recomendação encontrada' }, { status: 404 })
  }

  return NextResponse.json(result)
}
