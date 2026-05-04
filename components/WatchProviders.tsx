import Image from 'next/image'
import type { WatchProviderResult } from '@/types/tmdb'

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w92'

interface WatchProvidersProps {
  providers: WatchProviderResult | null
}

export default function WatchProviders({ providers }: WatchProvidersProps) {
  if (!providers) return null

  const streaming = providers.flatrate ?? []
  const rent = providers.rent ?? []
  const buy = providers.buy ?? []
  const free = providers.free ?? []

  if (streaming.length + rent.length + buy.length + free.length === 0) return null

  return (
    <div className="space-y-3">
      {streaming.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Streaming</p>
          <div className="flex flex-wrap gap-2">
            {streaming.map(p => (
              <ProviderLogo key={p.provider_id} name={p.provider_name} logo={p.logo_path} />
            ))}
          </div>
        </div>
      )}
      {free.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Grátis</p>
          <div className="flex flex-wrap gap-2">
            {free.map(p => (
              <ProviderLogo key={p.provider_id} name={p.provider_name} logo={p.logo_path} />
            ))}
          </div>
        </div>
      )}
      {rent.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Alugar</p>
          <div className="flex flex-wrap gap-2">
            {rent.map(p => (
              <ProviderLogo key={p.provider_id} name={p.provider_name} logo={p.logo_path} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProviderLogo({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-lg" title={name}>
      <Image
        src={`${IMAGE_BASE}${logo}`}
        alt={name}
        fill
        sizes="40px"
        className="object-cover"
      />
    </div>
  )
}
