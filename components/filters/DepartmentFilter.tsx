'use client'

import { useEffect, useState } from 'react'

interface OrganizationDepartment {
  id: string
  organization_id: string
  name: string
  name_en: string | null
  parent_department_id: string | null
  manager: string | null
  description: string | null
  member_count: number | null
  created_at: string | null
  updated_at: string | null
}

interface DepartmentFilterProps {
  organizationId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  includeAllOption?: boolean
  allOptionLabel?: string
  includeNoDepartmentOption?: boolean
  noDepartmentLabel?: string
  className?: string
  disabled?: boolean
}

interface DepartmentWithLevel extends OrganizationDepartment {
  level: number
}

export function DepartmentFilter({
  organizationId,
  value,
  onChange,
  placeholder = '部門を選択',
  includeAllOption = true,
  allOptionLabel = '全部門',
  includeNoDepartmentOption = false,
  noDepartmentLabel = '部門未設定',
  className = '',
  disabled = false
}: DepartmentFilterProps) {
  const [departments, setDepartments] = useState<DepartmentWithLevel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDepartments = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/organizations/${organizationId}/departments`)
        if (!response.ok) {
          console.error('Error fetching departments:', response.statusText)
          return
        }
        const data: OrganizationDepartment[] = await response.json()

        // 階層構造を平坦化してレベルを付与
        const flattenedDepartments = flattenDepartmentHierarchy(data || [])
        setDepartments(flattenedDepartments)
      } catch (err) {
        console.error('Error fetching departments:', err)
      } finally {
        setLoading(false)
      }
    }

    if (organizationId) {
      fetchDepartments()
    }
  }, [organizationId])

  // 部門の階層構造を平坦化する関数
  function flattenDepartmentHierarchy(
    departments: OrganizationDepartment[],
    parentId: string | null = null,
    level: number = 0
  ): DepartmentWithLevel[] {
    const result: DepartmentWithLevel[] = []

    const children = departments.filter(d => d.parent_department_id === parentId)
    children.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

    for (const dept of children) {
      result.push({ ...dept, level })
      result.push(...flattenDepartmentHierarchy(departments, dept.id, level + 1))
    }

    return result
  }

  const baseClassName =
    'px-4 py-2 rounded-md border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted'

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${baseClassName} min-w-[180px] ${className}`}
      aria-label={placeholder}
      disabled={disabled || loading}
    >
      {includeAllOption && (
        <option value="">{allOptionLabel}</option>
      )}
      {includeNoDepartmentOption && (
        <option value="__none__">{noDepartmentLabel}</option>
      )}
      {departments.map(dept => (
        <option key={dept.id} value={dept.id}>
          {'\u00A0'.repeat(dept.level * 2)}{dept.level > 0 ? '└ ' : ''}{dept.name}
        </option>
      ))}
    </select>
  )
}

// 部門フィルタ値をAPIパラメータに変換するユーティリティ
export function parseDepartmentFilterValue(value: string): {
  departmentId: string | null | undefined
  includeNoDepartment: boolean
} {
  if (value === '') {
    // 全部門（フィルタなし）
    return { departmentId: undefined, includeNoDepartment: false }
  }
  if (value === '__none__') {
    // 部門未設定のみ
    return { departmentId: null, includeNoDepartment: false }
  }
  // 特定の部門
  return { departmentId: value, includeNoDepartment: true }
}
