'use client'

import type { ReactNode } from 'react'

type FilterBarOption = {
  label: string
  value: string
  disabled?: boolean
}

type BaseFilterItem = {
  key: string
  className?: string
}

type SearchFilterItem = BaseFilterItem & {
  type: 'search'
  placeholder: string
  value: string
  onChange: (value: string) => void
}

type SelectFilterItem = BaseFilterItem & {
  type: 'select'
  placeholder: string
  value: string
  options: FilterBarOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

type CustomFilterItem = BaseFilterItem & {
  type: 'custom'
  element: ReactNode
}

export type FilterBarItem = SearchFilterItem | SelectFilterItem | CustomFilterItem

interface FilterBarProps {
  items: FilterBarItem[]
  className?: string
}

const baseContainerClass = 'flex flex-wrap items-stretch gap-3'
const inputClass =
  'px-4 py-2 rounded-md border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted'

function mergeClassName(defaultClass: string, customClass?: string) {
  return [defaultClass, customClass].filter(Boolean).join(' ')
}

export function FilterBar({ items, className }: FilterBarProps) {
  if (!items.length) {
    return null
  }

  return (
    <div className={mergeClassName(baseContainerClass, className)}>
      {items.map(item => {
        if (item.type === 'custom') {
          return (
            <div key={item.key} className={item.className}>
              {item.element}
            </div>
          )
        }

        if (item.type === 'search') {
          return (
            <input
              key={item.key}
              type="search"
              value={item.value}
              placeholder={item.placeholder}
              onChange={event => item.onChange(event.target.value)}
              className={mergeClassName(`${inputClass} flex-1 min-w-[200px]`, item.className)}
              aria-label={item.placeholder}
            />
          )
        }

        return (
          <select
            key={item.key}
            value={item.value}
            onChange={event => item.onChange(event.target.value)}
            className={mergeClassName(`${inputClass} min-w-[180px]`, item.className)}
            aria-label={item.placeholder}
            disabled={item.disabled}
          >
            <option value="">
              {item.placeholder}
            </option>
            {item.options.map(option => (
              <option key={`${item.key}-${option.value}`} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        )
      })}
    </div>
  )
}
