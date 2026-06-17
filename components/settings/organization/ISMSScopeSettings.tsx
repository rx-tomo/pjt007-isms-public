'use client'

import { memo, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'

type ScopeData = {
  physical_locations: string[]
  it_systems: string[]
  departments: string[]
  processes: string[]
  exclusions: string[]
}

// NOTE: コンポーネントを外出しして型を安定させ、入力中に再マウントしてフォーカスが外れる問題を防ぐ
// React.memoでラップして不要な再レンダリングを防止
const ScopeSection = memo(function ScopeSection({
  title,
  items,
  placeholder,
  icon,
  isSaving,
  inputValue,
  onInputChange,
  onAdd,
  onRemove
}: ScopeSectionProps) {
  return (
    <div className="relative bg-surface/70 backdrop-blur-md rounded-2xl p-5 border border-border shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl text-indigo-600">
          {icon}
        </div>
        <h4 className="text-base font-semibold text-text-primary">{title}</h4>
      </div>

      <div className="space-y-2.5">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="group flex items-center justify-between bg-surface-elevated/50 backdrop-blur-sm rounded-lg px-4 py-2.5 text-sm transition-all duration-200 hover:bg-surface-elevated hover:shadow-sm"
          >
            <span className="text-text-secondary">{item}</span>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onRemove(index)}
              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            className="flex-1 text-sm bg-surface/70 border border-border rounded-lg px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                onAdd()
              }
            }}
            disabled={isSaving}
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={onAdd}
            className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
})

interface ISMSScopeSettingsProps {
  organizationId: string
  initialScope?: ScopeData
  onUpdate: (scope: ScopeData) => Promise<void>
}

interface ScopeSectionProps {
  title: string
  items: string[]
  placeholder: string
  icon: ReactNode
  isSaving: boolean
  inputValue: string
  onInputChange: (value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

const emptyScope: ScopeData = {
  physical_locations: [],
  it_systems: [],
  departments: [],
  processes: [],
  exclusions: []
}

export default function ISMSScopeSettings({
  initialScope,
  onUpdate
}: ISMSScopeSettingsProps) {
  const t = useTranslations('settings.organization.ismsScope')
  const errorsT = useTranslations('settings.organization.errors')

  const [scope, setScope] = useState<ScopeData>(initialScope ?? emptyScope)
  const [newItems, setNewItems] = useState({
    physical_location: '',
    it_system: '',
    department: '',
    process: '',
    exclusion: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setScope(initialScope ?? emptyScope)
  }, [initialScope])

  const updateScope = useCallback(async (updatedScope: ScopeData, afterSuccess?: () => void) => {
    setIsSaving(true)
    setLocalError(null)
    try {
      await onUpdate(updatedScope)
      setScope(updatedScope)
      afterSuccess?.()
    } catch (err) {
      console.error('Scope update failed:', err)
      setLocalError(errorsT('scopeSaveFailed'))
    } finally {
      setIsSaving(false)
    }
  }, [onUpdate, errorsT])

  const handleAddItem = useCallback(async (
    category: keyof ScopeData,
    itemKey: keyof typeof newItems
  ) => {
    if (isSaving) return
    const value = newItems[itemKey].trim()
    if (!value || scope[category].includes(value)) return

    const updatedScope: ScopeData = {
      ...scope,
      [category]: [...scope[category], value]
    }

    await updateScope(updatedScope, () =>
      setNewItems(prev => ({ ...prev, [itemKey]: '' }))
    )
  }, [isSaving, newItems, scope, updateScope])

  const handleRemoveItem = useCallback(async (category: keyof ScopeData, index: number) => {
    if (isSaving) return
    const updatedScope: ScopeData = {
      ...scope,
      [category]: scope[category].filter((_, i) => i !== index)
    }

    await updateScope(updatedScope)
  }, [isSaving, scope, updateScope])

  // Input change handlers for each section (memoized to prevent re-renders)
  const handlePhysicalLocationChange = useCallback((value: string) => {
    setNewItems(prev => ({ ...prev, physical_location: value }))
  }, [])

  const handleItSystemChange = useCallback((value: string) => {
    setNewItems(prev => ({ ...prev, it_system: value }))
  }, [])

  const handleDepartmentChange = useCallback((value: string) => {
    setNewItems(prev => ({ ...prev, department: value }))
  }, [])

  const handleProcessChange = useCallback((value: string) => {
    setNewItems(prev => ({ ...prev, process: value }))
  }, [])

  const handleExclusionChange = useCallback((value: string) => {
    setNewItems(prev => ({ ...prev, exclusion: value }))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-text-primary">
          {t('title')}
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          {t('description')}
        </p>
      </div>

      {localError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScopeSection
          title={t('physicalLocations')}
          items={scope.physical_locations}
          placeholder={t('addPhysicalLocation')}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          isSaving={isSaving}
          inputValue={newItems.physical_location}
          onInputChange={handlePhysicalLocationChange}
          onAdd={() => void handleAddItem('physical_locations', 'physical_location')}
          onRemove={(index) => void handleRemoveItem('physical_locations', index)}
        />

        <ScopeSection
          title={t('itSystems')}
          items={scope.it_systems}
          placeholder={t('addItSystem')}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          isSaving={isSaving}
          inputValue={newItems.it_system}
          onInputChange={handleItSystemChange}
          onAdd={() => void handleAddItem('it_systems', 'it_system')}
          onRemove={(index) => void handleRemoveItem('it_systems', index)}
        />

        <ScopeSection
          title={t('departments')}
          items={scope.departments}
          placeholder={t('addDepartment')}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          isSaving={isSaving}
          inputValue={newItems.department}
          onInputChange={handleDepartmentChange}
          onAdd={() => void handleAddItem('departments', 'department')}
          onRemove={(index) => void handleRemoveItem('departments', index)}
        />

        <ScopeSection
          title={t('processes')}
          items={scope.processes}
          placeholder={t('addProcess')}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
          isSaving={isSaving}
          inputValue={newItems.process}
          onInputChange={handleProcessChange}
          onAdd={() => void handleAddItem('processes', 'process')}
          onRemove={(index) => void handleRemoveItem('processes', index)}
        />
      </div>

      <div className="mt-6">
        <ScopeSection
          title={t('exclusions')}
          items={scope.exclusions}
          placeholder={t('addExclusion')}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
          isSaving={isSaving}
          inputValue={newItems.exclusion}
          onInputChange={handleExclusionChange}
          onAdd={() => void handleAddItem('exclusions', 'exclusion')}
          onRemove={(index) => void handleRemoveItem('exclusions', index)}
        />
      </div>

      <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50">
        <div className="flex">
          <div className="flex-shrink-0">
            <div className="p-2 bg-surface/80 rounded-lg shadow-sm">
              <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-800 leading-relaxed">
              {t('scopeNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
