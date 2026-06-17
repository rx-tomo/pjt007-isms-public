import type { Database } from '@/types/database.types'

type OrganizationDepartment = Database['public']['Tables']['organization_departments']['Row']

export interface DepartmentTreeNode {
  id: string
  name: string
  parentId: string | null
  children: DepartmentTreeNode[]
}

export interface DepartmentOption {
  id: string
  name: string
  depth: number
  path: string[]
}

function sortDepartments(items: OrganizationDepartment[]): OrganizationDepartment[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

export function buildDepartmentTree(departments: OrganizationDepartment[]): DepartmentTreeNode[] {
  const nodeMap = new Map<string, DepartmentTreeNode>()
  const roots: DepartmentTreeNode[] = []

  departments.forEach(department => {
    nodeMap.set(department.id, {
      id: department.id,
      name: department.name,
      parentId: department.parent_department_id ?? null,
      children: []
    })
  })

  const sorted = sortDepartments(departments)

  sorted.forEach(department => {
    const node = nodeMap.get(department.id)!
    const parentId = department.parent_department_id ?? null

    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortChildren = (nodes: DepartmentTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    nodes.forEach(child => {
      if (child.children.length > 0) {
        sortChildren(child.children)
      }
    })
  }

  sortChildren(roots)

  return roots
}

export function buildDepartmentOptions(departments: OrganizationDepartment[]): DepartmentOption[] {
  const tree = buildDepartmentTree(departments)
  const result: DepartmentOption[] = []

  const traverse = (nodes: DepartmentTreeNode[], depth: number, parentPath: string[]) => {
    nodes.forEach(node => {
      const path = [...parentPath, node.name]
      result.push({
        id: node.id,
        name: node.name,
        depth,
        path
      })
      if (node.children.length > 0) {
        traverse(node.children, depth + 1, path)
      }
    })
  }

  traverse(tree, 0, [])

  return result
}
