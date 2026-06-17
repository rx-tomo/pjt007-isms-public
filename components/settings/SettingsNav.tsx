'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SettingsNavItem {
  name: string
  href: string
  icon: React.ReactNode
}

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1" aria-label="Settings navigation">
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`${
              isActive
                ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                : 'border-transparent text-text-primary hover:bg-surface-elevated hover:text-text-primary'
            } group border-l-4 px-3 py-2 flex items-center text-sm font-medium`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={`${
                isActive ? 'text-indigo-500' : 'text-text-muted group-hover:text-text-secondary'
              } flex-shrink-0 -ml-1 mr-3`}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
