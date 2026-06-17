'use client'

import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { useTranslations } from 'next-intl'
import { OrganizationService } from '@/lib/services/organization'
import type { Database } from '@/types/database.types'

type OrganizationDepartment = Database['public']['Tables']['organization_departments']['Row']

interface DepartmentManagementProps {
  organizationId: string
  initialDepartments?: OrganizationDepartment[]
  onUpdate: (departments: OrganizationDepartment[]) => Promise<void> | void
  onError?: (message: string | null) => void
}

interface DepartmentFormData {
  name: string
  name_en: string
  parent_department_id: string
  manager: string
  description: string
}

const initialFormState: DepartmentFormData = {
  name: '',
  name_en: '',
  parent_department_id: '',
  manager: '',
  description: ''
}

export default function DepartmentManagement({
  organizationId,
  initialDepartments = [],
  onUpdate,
  onError
}: DepartmentManagementProps) {
  const t = useTranslations('settings.organization.departments')
  const errorsT = useTranslations('settings.organization.errors')
  const orgService = useMemo(() => new OrganizationService(), [])

  const [departments, setDepartments] = useState<OrganizationDepartment[]>(initialDepartments)
  const [showForm, setShowForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<OrganizationDepartment | null>(null)
  const [formData, setFormData] = useState<DepartmentFormData>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setDepartments(initialDepartments)
  }, [initialDepartments])

  const notifySuccess = async (updated: OrganizationDepartment[]) => {
    setDepartments(updated)
    await Promise.resolve(onUpdate(updated))
    setLocalError(null)
    onError?.(null)
  }

  const notifyError = (message: string) => {
    setLocalError(message)
    onError?.(message)
  }

  const resetForm = () => {
    setFormData(initialFormState)
    setEditingDepartment(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    setLocalError(null)
    onError?.(null)

    const payload = {
      name: formData.name.trim(),
      name_en: formData.name_en.trim() || undefined,
      parent_department_id: formData.parent_department_id || null,
      manager: formData.manager.trim() || undefined,
      description: formData.description.trim() || undefined
    }

    try {
      if (editingDepartment) {
        const updated = await orgService.updateDepartment(organizationId, editingDepartment.id, payload)
        const merged = departments.map(dept => (dept.id === updated.id ? updated : dept))
        await notifySuccess(merged)
      } else {
        const created = await orgService.createDepartment(organizationId, payload)
        const merged = [...departments, created]
        await notifySuccess(merged)
      }
      resetForm()
    } catch (err) {
      console.error('Department save failed:', err)
      const message =
        err instanceof Error && err.message
          ? err.message
          : errorsT('departmentsSaveFailed')
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (department: OrganizationDepartment) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      name_en: department.name_en ?? '',
      parent_department_id: department.parent_department_id ?? '',
      manager: department.manager ?? '',
      description: department.description ?? ''
    })
    setShowForm(true)
    setLocalError(null)
    onError?.(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setLocalError(null)
    onError?.(null)

    try {
      await orgService.deleteDepartment(organizationId, id)
      const remaining = departments.filter(dept => dept.id !== id)
      await notifySuccess(remaining)
    } catch (err) {
      console.error('Department delete failed:', err)
      const message =
        err instanceof Error && err.message
          ? err.message
          : errorsT('departmentsSaveFailed')
      notifyError(message)
    } finally {
      setDeletingId(null)
    }
  }

  const getChildren = (parentId: string | null) =>
    departments
      .filter(dept => (dept.parent_department_id ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  const renderDepartmentTree = (parentId: string | null = null, level = 0): JSX.Element[] => {
    const nodes = getChildren(parentId)

    if (nodes.length === 0) {
      return []
    }

    return nodes.map(dept => (
      <div key={dept.id} style={{ marginLeft: `${level * 1.5}rem` }}>
        <div className="group bg-surface/70 backdrop-blur-sm rounded-xl p-4 mb-3 border border-border shadow-sm hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary">{dept.name}</h4>
                  {dept.name_en && <p className="text-sm text-text-muted">{dept.name_en}</p>}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">{t('memberCount')}:</span>
                  <span className="ml-2 font-medium text-text-secondary">{dept.member_count}名</span>
                </div>
                {dept.manager && (
                  <div>
                    <span className="text-text-muted">{t('manager')}:</span>
                    <span className="ml-2 font-medium text-text-secondary">{dept.manager}</span>
                  </div>
                )}
              </div>

              {dept.description && (
                <p className="mt-2 text-sm text-text-secondary">{dept.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => handleEdit(dept)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={t('edit')}
                disabled={isSubmitting || deletingId !== null}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  void handleDelete(dept.id)
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('delete')}
                disabled={deletingId === dept.id || isSubmitting}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {renderDepartmentTree(dept.id, level + 1)}
      </div>
    ))
  }

  const departmentOptions = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">{t('title')}</h3>
          <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
        </div>

        <button
          onClick={() => {
            setShowForm(true)
            setEditingDepartment(null)
            setFormData(initialFormState)
            setLocalError(null)
            onError?.(null)
          }}
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('addDepartment')}
        </button>
      </div>

      {localError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </div>
      )}

      {showForm && (
        <div className="bg-surface/70 backdrop-blur-md rounded-2xl p-6 border border-border shadow-lg">
          <h4 className="text-base font-semibold text-text-primary mb-4">
            {editingDepartment ? t('editDepartment') : t('newDepartment')}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('departmentName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface/70 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  placeholder={t('departmentNamePlaceholder')}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('departmentNameEn')}
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface/70 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  placeholder={t('departmentNameEnPlaceholder')}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('parentDepartment')}
                </label>
                <select
                  value={formData.parent_department_id}
                  onChange={(e) =>
                    setFormData({ ...formData, parent_department_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-surface/70 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  <option value="">{t('noParent')}</option>
                  {departmentOptions.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('departmentManager')}
                </label>
                <input
                  type="text"
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface/70 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  placeholder={t('departmentManagerPlaceholder')}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-surface/70 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                rows={3}
                placeholder={t('descriptionPlaceholder')}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-surface border border-border text-text-secondary rounded-lg hover:bg-surface-elevated transition-colors duration-200 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {editingDepartment ? t('update') : t('create')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {departments.length === 0 ? (
          <div className="text-center py-12 bg-surface-elevated rounded-xl">
            <svg className="mx-auto h-12 w-12 text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-text-muted">{t('noDepartments')}</p>
            <p className="text-sm text-text-muted mt-1">{t('noDepartmentsHint')}</p>
          </div>
        ) : (
          renderDepartmentTree()
        )}
      </div>
    </div>
  )
}
