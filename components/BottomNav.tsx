'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Bookmark, User } from 'lucide-react'

const links = [
  { href: '/', icon: Home, label: 'Início' },
  { href: '/search', icon: Search, label: 'Buscar' },
  { href: '/watchlist', icon: Bookmark, label: 'Lista' },
  { href: '/profile', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-t border-white/5">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 min-w-[4rem] py-1 transition-all ${
                active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] font-medium ${active ? 'text-white' : ''}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-red-600 rounded-t-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
