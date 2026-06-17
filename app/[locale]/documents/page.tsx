'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  DocumentService,
  type DocumentWithFolder,
  type DocumentFolder,
  type DocumentVersion
} from '@/lib/services/document'
import { OrganizationService } from '@/lib/services/organization'
import { UserService, type UserProfile } from '@/lib/services/user'
import { StorageQuotaService, STORAGE_MAX_ORG_USAGE } from '@/lib/services/storageQuota'
import { formatFileSize } from '@/lib/utils/formatters'
import DocumentList from '@/components/documents/DocumentList'
import FolderTree from '@/components/documents/FolderTree'
import { buildDepartmentOptions } from '@/lib/utils/departments'
import { evaluateDepartmentScope } from '@/lib/utils/departmentScope'
import type { Database } from '@/types/database.types'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Organization = Database['public']['Tables']['organizations']['Row']
type DocumentStatus = DocumentWithFolder['status']
type OrganizationDepartment = Database['public']['Tables']['organization_departments']['Row']

interface UploadFormData {
  title: string
  description: string
  category: string
}

interface FolderTreeNode {
  id: string
  name: string
  parentId: string | null
}

export default function DocumentsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('documents')
  const storageText = useTranslations('documents.storage')
  const commonT = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [documents, setDocuments] = useState<DocumentWithFolder[]>([])
  const [folders, setFolders] = useState<FolderTreeNode[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadFormData, setUploadFormData] = useState<UploadFormData>({
    title: '',
    description: '',
    category: 'general'
  })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [approvalTarget, setApprovalTarget] = useState<DocumentWithFolder | null>(null)
  const [approvalStep1, setApprovalStep1] = useState<string>('')
  const [approvalStep2, setApprovalStep2] = useState<string>('')
  const [approvalProcessing, setApprovalProcessing] = useState(false)
  const [approveTarget, setApproveTarget] = useState<DocumentWithFolder | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [approveProcessing, setApproveProcessing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>(
    (searchParams?.get('status') as DocumentStatus) ?? ''
  )
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([])
  const [departmentFilter, setDepartmentFilter] = useState<string>(
    searchParams?.get('department') ?? ''
  )
  const [storageUsage, setStorageUsage] = useState<number | null>(null)
  const [storageLoadFailed, setStorageLoadFailed] = useState(false)
  const [versionHistoryTarget, setVersionHistoryTarget] = useState<DocumentWithFolder | null>(null)
  const [versionHistory, setVersionHistory] = useState<DocumentVersion[]>([])
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false)
  const [versionHistoryError, setVersionHistoryError] = useState<string | null>(null)
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null)



  const documentService = useMemo(() => new DocumentService(), [])
  const orgService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])
  const storageQuotaService = useMemo(() => new StorageQuotaService(), [])
  const userDirectory = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [profile, org] = await Promise.all([
        userService.getCurrentUser(),
        orgService.getCurrentOrganization()
      ])

      if (!profile || !org) {
        router.push(`/${locale}/auth/login`)
        return
      }

      setCurrentUser(profile)
      setOrganization(org)

      // フォルダーと文書、ストレージ使用量を並行して取得
      const [foldersData, documentsData, usersData, usageBytes, departmentRows] = await Promise.all([
        documentService.getFolders(org.id),
        documentService.getDocumentsScoped(org.id, profile.id, currentFolderId || undefined),
        userService.getOrganizationUsersScoped(org.id, profile.id).catch(() => [profile]),
        storageQuotaService
          .getOrganizationUsage(org.id)
          .catch(error => {
            console.error('Failed to load storage usage', error)
            setStorageLoadFailed(true)
            return null
          }),
        orgService.getOrganizationDepartments(org.id).catch(() => [])
      ])

      const mappedFolders: FolderTreeNode[] = foldersData.map((folder: DocumentFolder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parent_id ?? null
      }))

      setFolders(mappedFolders)
      const enrichedDocuments = await documentService.enrichDocumentsWithApprovalProgress(
        org.id,
        documentsData
      )
      setDocuments(enrichedDocuments)
      setUsers(usersData)
      setDepartments(departmentRows)
      if (usageBytes !== null) {
        setStorageUsage(usageBytes)
        setStorageLoadFailed(false)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentFolderId, documentService, locale, orgService, router, storageQuotaService, userService])

  const createFolder = useCallback(
    async (name: string, parentId: string | null = null) => {
      if (!organization) {
        throw new Error('Organization not available')
      }

      const trimmedName = name.trim()
      if (!trimmedName) {
        throw new Error(t('folders.nameRequired'))
      }

      try {
        const created = await documentService.createFolder(
          organization.id,
          trimmedName,
          parentId ?? undefined
        )
        await loadData()
        return created
      } catch (error: any) {
        console.error('Error creating folder:', error)
        alert(error.message || t('folders.createError'))
        throw error
      }
    },
    [documentService, organization, loadData, t]
  )

  const handleFolderSelect = useCallback((folderId: string | null) => {
    if (!folderId || folderId === 'root') {
      setCurrentFolderId(null)
      return
    }
    setCurrentFolderId(folderId)
  }, [])

  const handleInlineFolderCreate = useCallback(
    async (parentId: string | null, name: string) => {
      try {
        const created = await createFolder(name, parentId)
        if (created) {
          setCurrentFolderId(created.id)
        }
      } catch (error) {
        console.error('Inline folder creation failed:', error)
      }
    },
    [createFolder]
  )

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!organization) return

      const targetFolder = folders.find(folder => folder.id === folderId)
      const confirmed = confirm(
        t('folders.confirmDelete', { name: targetFolder?.name ?? '' })
      )

      if (!confirmed) return

      try {
        await documentService.deleteFolder(organization.id, folderId)
        if (currentFolderId === folderId) {
          setCurrentFolderId(null)
        }
        await loadData()
      } catch (error: any) {
        console.error('Error deleting folder:', error)
        alert(error.message || t('folders.deleteError'))
      }
    },
    [currentFolderId, documentService, folders, loadData, organization, t]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const departmentOptions = useMemo(() => buildDepartmentOptions(departments), [departments])

  const departmentNameToId = useMemo(() => {
    const map = new Map<string, string>()
    departments.forEach(department => {
      map.set(department.name, department.id)
    })
    if (currentUser?.department && !map.has(currentUser.department)) {
      map.set(currentUser.department, currentUser.department)
    }
    return map
  }, [currentUser?.department, departments])

  const userDepartmentMap = useMemo(() => {
    const map = new Map<string, string | null>()
    users.forEach(user => {
      if (!user.department) {
        map.set(user.id, null)
        return
      }

      const departmentId = departmentNameToId.get(user.department) ?? null
      map.set(user.id, departmentId)
    })
    return map
  }, [departmentNameToId, users])

  const departmentScope = useMemo(
    () =>
      evaluateDepartmentScope({
        role: currentUser?.role ?? null,
        departmentName: currentUser?.department ?? null,
        departmentNameToId
      }),
    [currentUser?.department, currentUser?.role, departmentNameToId]
  )

  const appliedDepartmentFilter = departmentScope.enforcedFilterValue ?? departmentFilter

  const filteredDocuments = useMemo(() => {
    return documents.filter(document => {
      const matchesStatus = !statusFilter || document.status === statusFilter
      const isApprovedDocument = document.status === 'approved'
      const ownerDepartmentId = document.created_by
        ? userDepartmentMap.get(document.created_by) ?? null
        : null
      const matchesDepartment =
        isApprovedDocument ||
        !appliedDepartmentFilter ||
        (appliedDepartmentFilter === DEPARTMENT_UNASSIGNED_VALUE
          ? !ownerDepartmentId
          : ownerDepartmentId === appliedDepartmentFilter)

      return matchesStatus && matchesDepartment
    })
  }, [appliedDepartmentFilter, documents, statusFilter, userDepartmentMap])

  const activeDepartmentLabel = useMemo(() => {
    if (!appliedDepartmentFilter) return ''
    if (appliedDepartmentFilter === DEPARTMENT_UNASSIGNED_VALUE) {
      return t('filters.department.unassigned')
    }
    const match = departmentOptions.find(option => option.id === appliedDepartmentFilter)
    return match?.name ?? ''
  }, [appliedDepartmentFilter, departmentOptions, t])
  const hasActiveFilters = Boolean(statusFilter || appliedDepartmentFilter)

  const enforcedDepartmentLabel = useMemo(() => {
    if (!departmentScope.enforcedFilterValue) {
      return ''
    }
    if (departmentScope.enforcedFilterValue === DEPARTMENT_UNASSIGNED_VALUE) {
      return t('filters.department.unassigned')
    }
    const match = departmentOptions.find(option => option.id === departmentScope.enforcedFilterValue)
    return match?.name ?? departmentScope.enforcedFilterValue
  }, [departmentOptions, departmentScope.enforcedFilterValue, t])

  const handleStatusFilterChange = useCallback(
    (value: DocumentStatus | '') => {
      setStatusFilter(value)

      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (value) {
        params.set('status', value)
      } else {
        params.delete('status')
      }

      const query = params.toString()
      router.replace(query ? `/${locale}/documents?${query}` : `/${locale}/documents`)
    },
    [locale, router, searchParams]
  )

  const clearStatusFilter = useCallback(() => {
    handleStatusFilterChange('')
  }, [handleStatusFilterChange])

  const handleDepartmentFilterChange = useCallback(
    (value: string) => {
      if (departmentScope.enforcedFilterValue) {
        return
      }
      setDepartmentFilter(value)

      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (value) {
        params.set('department', value)
      } else {
        params.delete('department')
      }

      const query = params.toString()
      router.replace(query ? `/${locale}/documents?${query}` : `/${locale}/documents`)
    },
    [departmentScope.enforcedFilterValue, locale, router, searchParams]
  )

  const clearDepartmentFilter = useCallback(() => {
    if (departmentScope.enforcedFilterValue) {
      return
    }
    handleDepartmentFilterChange('')
  }, [departmentScope.enforcedFilterValue, handleDepartmentFilterChange])

  const clearAllFilters = useCallback(() => {
    setStatusFilter('')
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('status')

    if (departmentScope.enforcedFilterValue) {
      setDepartmentFilter(departmentScope.enforcedFilterValue)
      params.set('department', departmentScope.enforcedFilterValue as string)
    } else {
      setDepartmentFilter('')
      params.delete('department')
    }

    const query = params.toString()
    router.replace(query ? `/${locale}/documents?${query}` : `/${locale}/documents`)
  }, [departmentScope.enforcedFilterValue, locale, router, searchParams])

  const activeStatusLabel = statusFilter ? t(`status.${statusFilter}`) : ''

  useEffect(() => {
    const nextStatus = (searchParams?.get('status') as DocumentStatus) ?? ''
    setStatusFilter(nextStatus)
  }, [searchParams])

  useEffect(() => {
    if (departmentScope.enforcedFilterValue) {
      return
    }
    const nextDepartment = searchParams?.get('department') ?? ''
    setDepartmentFilter(nextDepartment)
  }, [departmentScope.enforcedFilterValue, searchParams])

  useEffect(() => {
    if (!departmentScope.enforcedFilterValue) {
      return
    }
    setDepartmentFilter(departmentScope.enforcedFilterValue)
    const currentParam = searchParams?.get('department') ?? ''
    if (currentParam === departmentScope.enforcedFilterValue) {
      return
    }
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('department', departmentScope.enforcedFilterValue as string)
    const query = params.toString()
    router.replace(query ? `/${locale}/documents?${query}` : `/${locale}/documents`)
  }, [departmentScope.enforcedFilterValue, locale, router, searchParams])

  const storageLimit = STORAGE_MAX_ORG_USAGE
  const storagePercent = storageUsage != null ? Math.min(100, Math.round((storageUsage / storageLimit) * 100)) : null
  const nearCapacity = storagePercent != null && storagePercent >= 80

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const created = await createFolder(newFolderName, currentFolderId)
      if (created) {
        setCurrentFolderId(created.id)
      }
      setNewFolderName('')
      setShowFolderModal(false)
    } catch (error: any) {
      console.error('Error creating folder:', error)
    }
  }

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!organization || !selectedFile || !uploadFormData.title) return

    try {
      // 1. 文書レコードを作成
      const document = await documentService.createDocument({
        organization_id: organization.id,
        title: uploadFormData.title,
        description: uploadFormData.description,
        category: uploadFormData.category,
        folder_id: currentFolderId,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        status: 'draft'
      })

      if (!document) {
        throw new Error(t('errors.createFailed'))
      }

      // 2. ファイルをアップロード
      const { path } = await documentService.uploadFile(
        organization.id,
        selectedFile,
        document.id
      )

      // 3. 文書レコードを更新
      await documentService.updateDocument(document.id, {
        file_path: path
      })

      await documentService.createDocumentVersion(document.id, {
        title: uploadFormData.title,
        description: uploadFormData.description,
        fileName: selectedFile.name,
        filePath: path,
        fileSize: selectedFile.size,
        changes: 'initial_upload'
      })

      setShowUploadModal(false)
      setSelectedFile(null)
      setUploadFormData({ title: '', description: '', category: 'general' })
      await loadData()
    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert(error.message || t('errors.uploadFailed'))
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm(t('confirmations.deleteDocument'))) return

    try {
      await documentService.deleteDocument(documentId)
      await loadData()
    } catch (error: any) {
      console.error('Error deleting document:', error)
      alert(error.message || t('errors.deleteFailed'))
    }
  }

  const getDefaultApprovers = () => {
    const step1Candidate =
      users.find(user => user.role === 'approver') ||
      users.find(user => user.role === 'org_admin' || user.role === 'system_operator')
    const step2Candidate =
      users.find(user => user.role === 'system_operator') ||
      users.find(user => user.role === 'org_admin') ||
      users.find(user => user.role === 'approver')

    return {
      step1: step1Candidate ? step1Candidate.id : '',
      step2: step2Candidate ? step2Candidate.id : ''
    }
  }

  const handleRequestApproval = (doc: DocumentWithFolder) => {
    const defaults = getDefaultApprovers()
    setApprovalTarget(doc)
    setApprovalStep1(defaults.step1)
    setApprovalStep2(defaults.step2)
    setShowApprovalModal(true)
  }

  const submitApprovalRequest = async () => {
    if (!approvalTarget) return
    if (!approvalStep1 || !approvalStep2) {
      alert(t('approval.errors.missingApprovers'))
      return
    }

    setApprovalProcessing(true)
    try {
      await documentService.submitApprovalRequest(approvalTarget.id, approvalStep1, approvalStep2)
      setShowApprovalModal(false)
      setApprovalTarget(null)
      await loadData()
    } catch (error: any) {
      console.error('Approval request error:', error)
      alert(error.message || t('errors.approvalRequestFailed'))
    } finally {
      setApprovalProcessing(false)
    }
  }

  const handleApproveDocument = (doc: DocumentWithFolder) => {
    setApproveTarget(doc)
    setApproveComment('')
    setShowApproveModal(true)
  }

  const confirmApproveDocument = async () => {
    if (!approveTarget) return
    setApproveProcessing(true)
    try {
      await documentService.approveDocument(approveTarget.id, approveComment)
      setShowApproveModal(false)
      setApproveTarget(null)
      setApproveComment('')
      await loadData()
    } catch (error: any) {
      console.error('Document approve error:', error)
      alert(error.message || t('errors.approvalFailed'))
    } finally {
      setApproveProcessing(false)
    }
  }

  const handleDownloadDocument = async (doc: DocumentWithFolder) => {
    if (!doc.file_path) return

    try {
      const blob = await documentService.downloadFile(doc.file_path)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name || 'download'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Error downloading document:', error)
      alert(error.message || t('errors.downloadFailed'))
    }
  }

  const handleViewVersionHistory = async (doc: DocumentWithFolder) => {
    setVersionHistoryTarget(doc)
    setVersionHistory([])
    setVersionHistoryError(null)
    setVersionHistoryLoading(true)

    try {
      const versions = await documentService.getDocumentVersions(doc.id)
      setVersionHistory(versions)
    } catch (error: any) {
      console.error('Error loading version history:', error)
      const message = error instanceof Error ? error.message : t('versionHistory.loadFailed')
      setVersionHistoryError(message)
    } finally {
      setVersionHistoryLoading(false)
    }
  }

  const closeVersionHistory = () => {
    setVersionHistoryTarget(null)
    setVersionHistory([])
    setVersionHistoryError(null)
    setDownloadingVersionId(null)
  }

  const handleDownloadVersion = async (version: DocumentVersion) => {
    if (!version.file_path) {
      return
    }

    setVersionHistoryError(null)
    setDownloadingVersionId(version.id)

    try {
      const blob = await documentService.downloadFile(version.file_path)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const rawBase = version.file_name?.split('.').slice(0, -1).join('.') ||
        `${sanitizeFileName(versionHistoryTarget?.title ?? 'document')}_v${version.version_number}`
      const extension = version.file_name?.split('.').pop()?.toLowerCase() || 'md'
      const baseName = sanitizeFileName(rawBase) || 'document'

      link.href = url
      link.download = `${baseName}.${extension}`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    } catch (error: any) {
      console.error('Error downloading document version:', error)
      const message = error instanceof Error ? error.message : t('versionHistory.downloadFailed')
      setVersionHistoryError(message)
    } finally {
      setDownloadingVersionId(null)
    }
  }

  const handleExportDocument = async (doc: DocumentWithFolder, format: 'pdf' | 'word') => {
    try {
      const blob = await documentService.exportDocument(doc.id, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const extension = format === 'pdf' ? 'pdf' : 'doc'
      a.href = url
      a.download = `${sanitizeFileName(doc.title)}.${extension}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Error exporting document:', error)
      alert(error.message || t('errors.exportFailed'))
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <DashboardLayout locale={locale}>
      <div className="flex h-full">
        {/* サイドバー（フォルダーツリー） */}
        <div className="w-64 bg-surface-elevated border-r border-border p-4">
          <div className="mb-4">
            <button
              onClick={() => setShowFolderModal(true)}
              className="w-full px-3 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-md hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('actions.createFolder')}
            </button>
          </div>
          <FolderTree
            folders={folders}
            selectedFolderId={currentFolderId ?? 'root'}
            onFolderSelect={handleFolderSelect}
            onFolderCreate={handleInlineFolderCreate}
            onFolderDelete={handleDeleteFolder}
          />
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {currentFolderId ? t('folderDocuments') : t('allDocuments')}
            </p>
          </div>

          {(storageUsage !== null || storageLoadFailed) && (
            <div
              className={`mb-6 rounded-lg border px-5 py-4 ${
                nearCapacity ? 'border-amber-200 bg-amber-50' : 'border-border bg-surface'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">{storageText('title')}</h2>
                  <p className="mt-1 text-xs text-text-secondary">
                    {storageUsage !== null
                      ? storageText('summary', {
                          used: formatFileSize(storageUsage),
                          limit: formatFileSize(storageLimit)
                        })
                      : storageText('loadFailed')}
                  </p>
                </div>
                {storagePercent !== null && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                      nearCapacity ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {nearCapacity ? storageText('nearLimitBadge') : storageText('healthyBadge')}
                  </span>
                )}
              </div>
              {storagePercent !== null && (
                <div className="mt-3 h-2 rounded-full bg-surface-elevated">
                  <div
                    className={`h-2 rounded-full ${nearCapacity ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(100, Math.max(storagePercent, 2))}%` }}
                  />
                </div>
              )}
              {nearCapacity && storagePercent !== null && (
                <p className="mt-3 text-xs text-amber-700">{storageText('nearLimitDescription')}</p>
              )}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {t('actions.upload')}
              </button>
              <Link
                href={`/${locale}/documents/templates`}
                className="inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {t('actions.fromTemplate')}
              </Link>
            </div>
            <div className="flex flex-col gap-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="document-status-filter" className="font-medium text-text-secondary">
                  {t('filters.status.label')}
                </label>
                <select
                  id="document-status-filter"
                  value={statusFilter ?? ''}
                  onChange={event => handleStatusFilterChange(event.target.value as DocumentStatus | '')}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('filters.status.all')}</option>
                  <option value="draft">{t('status.draft')}</option>
                  <option value="in_review">{t('status.in_review')}</option>
                  <option value="approved">{t('status.approved')}</option>
                  <option value="obsolete">{t('status.obsolete')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="document-department-filter" className="font-medium text-text-secondary">
                  {t('filters.department.label')}
                </label>
                <select
                  id="document-department-filter"
                  value={departmentFilter}
                  onChange={event => handleDepartmentFilterChange(event.target.value)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted"
                  disabled={Boolean(departmentScope.enforcedFilterValue)}
                >
                  <option value="">{t('filters.department.all')}</option>
                  {departmentOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {`${'　'.repeat(option.depth)}${option.name}`}
                    </option>
                  ))}
                  <option value={DEPARTMENT_UNASSIGNED_VALUE}>{t('filters.department.unassigned')}</option>
                </select>
              </div>
            </div>
          </div>

          {departmentScope.enforcedFilterValue && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <p>
                {commonT('departmentScope.locked', {
                  department: enforcedDepartmentLabel || t('filters.department.unassigned')
                })}
              </p>
              {departmentScope.reason === 'missing_department' && (
                <p className="mt-1">{commonT('departmentScope.lockedMissing')}</p>
              )}
            </div>
          )}

          {hasActiveFilters && (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {statusFilter && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 font-semibold text-indigo-700">
                    {t('filters.active.status', { status: activeStatusLabel })}
                    <button
                      type="button"
                      onClick={clearStatusFilter}
                      className="rounded-full px-2 py-0.5 text-xs text-indigo-500 transition hover:bg-indigo-100"
                      aria-label={t('filters.clear')}
                    >
                      ×
                    </button>
                  </span>
                )}
                {appliedDepartmentFilter && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 font-semibold text-indigo-700">
                    {t('filters.active.department', { department: activeDepartmentLabel })}
                    {!departmentScope.enforcedFilterValue && (
                      <button
                        type="button"
                        onClick={clearDepartmentFilter}
                        className="rounded-full px-2 py-0.5 text-xs text-indigo-500 transition hover:bg-indigo-100"
                        aria-label={t('filters.clear')}
                      >
                        ×
                      </button>
                    )}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-surface px-3 py-1 font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                {t('filters.clearAll')}
              </button>
            </div>
          )}

          <DocumentList
            documents={filteredDocuments}
            currentUserId={currentUser?.id}
            onRequestApproval={handleRequestApproval}
            onApprove={handleApproveDocument}
            onDelete={handleDeleteDocument}
            onDownload={handleDownloadDocument}
            onExport={handleExportDocument}
            onViewVersions={handleViewVersionHistory}
            users={users}
          />
        </div>
      </div>

      {/* アップロードモーダル */}
      {showUploadModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleFileUpload}>
                <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                    {t('upload.title')}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="file" className="block text-sm font-medium text-text-secondary">
                        {t('upload.file')}
                      </label>
                      <input
                        type="file"
                        id="file"
                        required
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="mt-1 block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                    </div>

                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-text-secondary">
                        {t('upload.title')}
                      </label>
                      <input
                        type="text"
                        id="title"
                        required
                        value={uploadFormData.title}
                        onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-text-secondary">
                        {t('upload.description')}
                      </label>
                      <textarea
                        id="description"
                        rows={3}
                        value={uploadFormData.description}
                        onChange={(e) => setUploadFormData({ ...uploadFormData, description: e.target.value })}
                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-text-secondary">
                        {t('upload.category')}
                      </label>
                      <select
                        id="category"
                        value={uploadFormData.category}
                        onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                        className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="general">{t('categories.general')}</option>
                        <option value="policy">{t('categories.policy')}</option>
                        <option value="procedure">{t('categories.procedure')}</option>
                        <option value="record">{t('categories.record')}</option>
                        <option value="template">{t('categories.template')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {t('upload.submit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false)
                      setSelectedFile(null)
                      setUploadFormData({ title: '', description: '', category: 'general' })
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {t('upload.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* フォルダー作成モーダル */}
      {showFolderModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                  {t('folder.createTitle')}
                </h3>

                <div>
                  <label htmlFor="folder-name" className="block text-sm font-medium text-text-secondary">
                    {t('folder.name')}
                  </label>
                  <input
                    type="text"
                    id="folder-name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                  />
                </div>
              </div>

              <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('folder.create')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFolderModal(false)
                    setNewFolderName('')
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('folder.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </DashboardLayout>

      {/* バージョン履歴モーダル */}
      {versionHistoryTarget && (
        <div className="fixed z-20 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div
              className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
              data-testid="document-version-modal"
            >
              <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-6">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg leading-6 font-medium text-text-primary">
                    {t('versionHistory.modalTitle', { title: versionHistoryTarget.title })}
                  </h3>
                  <button
                    type="button"
                    onClick={closeVersionHistory}
                    aria-label={t('versionHistory.close')}
                    className="rounded-full p-1 text-text-muted hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                {versionHistoryError && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {versionHistoryError}
                  </div>
                )}

                {versionHistoryLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                  </div>
                ) : versionHistory.length > 0 ? (
                  <ul className="mt-4 divide-y divide-border" data-testid="document-version-list">
                    {versionHistory.map(version => {
                      const creator = userDirectory.get(version.created_by)
                      const displayName = creator?.full_name || creator?.email || '—'
                      const createdAt = version.created_at ? new Date(version.created_at).toLocaleString() : '—'

                      return (
                        <li key={version.id} className="py-4" data-testid="document-version-item">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">
                                v{version.version_number}{' '}
                                <span className="font-normal text-text-secondary">{version.title}</span>
                              </p>
                              <p className="text-xs text-text-muted">
                                {t('versionHistory.createdAt', { date: createdAt })}
                              </p>
                              <p className="text-xs text-text-muted">
                                {t('versionHistory.createdBy', { name: displayName })}
                              </p>
                              {version.changes && (
                                <p className="mt-2 text-sm text-text-secondary">
                                  {t('versionHistory.changesLabel')}: {version.changes}
                                </p>
                              )}
                            </div>
                            {version.file_path ? (
                              <button
                                type="button"
                                onClick={() => handleDownloadVersion(version)}
                                className="inline-flex items-center rounded-md border border-transparent px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                                disabled={downloadingVersionId === version.id}
                              >
                                {downloadingVersionId === version.id
                                  ? t('versionHistory.downloading')
                                  : t('versionHistory.download')}
                              </button>
                            ) : (
                              <span className="text-xs text-text-muted">{t('versionHistory.noFile')}</span>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-text-muted">{t('versionHistory.empty')}</p>
                )}
              </div>
              <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closeVersionHistory}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('versionHistory.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 承認依頼モーダル */}
      {showApprovalModal && approvalTarget && (
        <div className="fixed z-20 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                  {t('approval.modal.title', { title: approvalTarget.title })}
                </h3>
                <p className="text-sm text-text-secondary mb-4">{t('approval.modal.description')}</p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="approval-step1" className="block text-sm font-medium text-text-secondary">
                      {t('approval.modal.step1Label')}
                    </label>
                    <select
                      id="approval-step1"
                      value={approvalStep1}
                      onChange={(event) => setApprovalStep1(event.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="">{t('approval.modal.selectPlaceholder')}</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="approval-step2" className="block text-sm font-medium text-text-secondary">
                      {t('approval.modal.step2Label')}
                    </label>
                    <select
                      id="approval-step2"
                      value={approvalStep2}
                      onChange={(event) => setApprovalStep2(event.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="">{t('approval.modal.selectPlaceholder')}</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-text-muted">{t('approval.modal.hint')}</p>
                </div>
              </div>
              <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={submitApprovalRequest}
                  disabled={approvalProcessing}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-60"
                >
                  {approvalProcessing ? t('approval.modal.saving') : t('approval.modal.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovalModal(false)
                    setApprovalTarget(null)
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  {t('approval.modal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 承認モーダル */}
      {showApproveModal && approveTarget && (
        <div className="fixed z-20 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                  {t('approval.approveModal.title', { title: approveTarget.title })}
                </h3>
                <label htmlFor="approve-comment" className="block text-sm font-medium text-text-secondary mb-1">
                  {t('approval.approveModal.commentLabel')}
                </label>
                <textarea
                  id="approve-comment"
                  rows={3}
                  value={approveComment}
                  onChange={(event) => setApproveComment(event.target.value)}
                  className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                  placeholder={t('approval.approveModal.commentPlaceholder')}
                />
                <p className="mt-2 text-xs text-text-muted">{t('approval.approveModal.optional')}</p>
              </div>
              <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmApproveDocument}
                  disabled={approveProcessing}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-60"
                >
                  {approveProcessing ? t('approval.approveModal.processing') : t('approval.approveModal.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApproveModal(false)
                    setApproveTarget(null)
                    setApproveComment('')
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  {t('approval.approveModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';
}
