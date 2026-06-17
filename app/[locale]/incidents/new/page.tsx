'use client'

import { FormEvent, useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { IncidentService, type IncidentSeverity, type IncidentLinkType } from '@/lib/services/incident'
import { OrganizationService } from '@/lib/services/organization'
import { UserService, type UserProfile } from '@/lib/services/user'
import { TaskService } from '@/lib/services/task'
import { RiskService } from '@/lib/services/risk'
import { InformationAssetService } from '@/lib/services/informationAsset'
import { useAuth } from '@/lib/hooks/useAuth'
import { useTranslations } from 'next-intl'

const incidentService = new IncidentService()
const organizationService = new OrganizationService()
const userService = new UserService()
const taskService = new TaskService()
const riskService = new RiskService()
const assetService = new InformationAssetService()

interface PendingLink {
  tempId: string
  linkType: IncidentLinkType
  targetId: string
  targetLabel: string
}

interface LinkTarget {
  id: string
  label: string
}

export default function NewIncidentPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('incidents')
  const router = useRouter()
  const { user: authUser } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [approverId, setApproverId] = useState('')
  const [approverCandidates, setApproverCandidates] = useState<UserProfile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pending links state (created after incident is saved)
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [showAddLink, setShowAddLink] = useState(false)
  const [selectedLinkType, setSelectedLinkType] = useState<IncidentLinkType>('task')
  const [targetCandidates, setTargetCandidates] = useState<LinkTarget[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [candidatesLoading, setCandidatesLoading] = useState(false)

  useEffect(() => {
    const loadContext = async () => {
      try {
        const organization = await organizationService.getCurrentOrganization()
        if (!organization?.id) {
          setOrganizationId(null)
          setApproverCandidates([])
          return
        }

        setOrganizationId(organization.id)
        const users = await userService.getOrganizationUsers(organization.id)
        const candidates = users.filter(user =>
          ['org_admin', 'system_operator', 'approver'].includes(user.role)
        )
        setApproverCandidates(candidates)
        setApproverId(candidates[0]?.id ?? '')
      } catch (loadError) {
        console.error(loadError)
        setError(t('errors.organizationMissing'))
      }
    }

    void loadContext()
  }, [t])

  const loadCandidates = useCallback(async (linkType: IncidentLinkType) => {
    if (!organizationId) return
    setCandidatesLoading(true)
    setTargetCandidates([])
    setSelectedTargetId('')

    try {
      let candidates: LinkTarget[] = []
      if (linkType === 'task') {
        const tasks = await taskService.getTasks({ organizationId })
        candidates = (tasks ?? []).map((task: any) => ({
          id: task.id,
          label: task.title ?? task.id
        }))
      } else if (linkType === 'risk') {
        const risks = await riskService.getRisks(organizationId)
        candidates = (risks ?? []).map((risk: any) => ({
          id: risk.id,
          label: risk.name ?? risk.title ?? risk.id
        }))
      } else if (linkType === 'asset') {
        const assets = await assetService.getAssets(organizationId)
        candidates = (assets ?? []).map((asset: any) => ({
          id: asset.id,
          label: asset.name ?? asset.id
        }))
      }

      // Filter out already added pending links of the same type
      const existingTargetIds = new Set(
        pendingLinks.filter(l => l.linkType === linkType).map(l => l.targetId)
      )
      candidates = candidates.filter(c => !existingTargetIds.has(c.id))

      setTargetCandidates(candidates)
      if (candidates.length > 0) {
        setSelectedTargetId(candidates[0].id)
      }
    } catch (err) {
      console.error('Failed to load link candidates', err)
    } finally {
      setCandidatesLoading(false)
    }
  }, [organizationId, pendingLinks])

  const handleOpenAddLink = () => {
    setShowAddLink(true)
    setSelectedLinkType('task')
    loadCandidates('task')
  }

  const handleLinkTypeChange = (linkType: IncidentLinkType) => {
    setSelectedLinkType(linkType)
    loadCandidates(linkType)
  }

  const handleAddPendingLink = () => {
    if (!selectedTargetId) return
    const target = targetCandidates.find(c => c.id === selectedTargetId)
    if (!target) return

    setPendingLinks(prev => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random()}`,
        linkType: selectedLinkType,
        targetId: target.id,
        targetLabel: target.label
      }
    ])
    setShowAddLink(false)
    setSelectedTargetId('')
    setTargetCandidates([])
  }

  const handleRemovePendingLink = (tempId: string) => {
    setPendingLinks(prev => prev.filter(l => l.tempId !== tempId))
  }

  const linkTypeLabel = (type: IncidentLinkType): string => {
    return t(`links.${type}`)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError(null)

      if (!organizationId) {
        throw new Error(t('errors.organizationMissing'))
      }

      const incident = await incidentService.create({
        organization_id: organizationId,
        title,
        description,
        occurred_at: new Date(occurredAt).toISOString(),
        severity,
        reporter_id: authUser?.id ?? null,
        approver_id: approverId || null
      })

      // Create pending links after incident is created
      if (pendingLinks.length > 0) {
        await Promise.all(
          pendingLinks.map(link =>
            incidentService.createIncidentLink(incident.id, link.linkType, link.targetId)
          )
        )
      }

      router.push(`/${locale}/incidents/${incident.id}`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t('errors.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const groupedPendingLinks = {
    task: pendingLinks.filter(l => l.linkType === 'task'),
    risk: pendingLinks.filter(l => l.linkType === 'risk'),
    asset: pendingLinks.filter(l => l.linkType === 'asset')
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8'>
        <h1 className='text-2xl font-bold text-text-primary'>{t('newTitle')}</h1>
        <p className='mt-1 text-sm text-text-secondary'>{t('newDescription')}</p>

        <form onSubmit={handleSubmit} className='mt-6 space-y-4 rounded-lg border border-border bg-surface p-6'>
          {error && <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</div>}

          <div>
            <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.title')}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required className='w-full rounded-md border border-border px-3 py-2 text-sm' />
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.description')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className='w-full rounded-md border border-border px-3 py-2 text-sm' />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.severity')}</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)} className='w-full rounded-md border border-border px-3 py-2 text-sm'>
                <option value='low'>{t('severity.low')}</option>
                <option value='medium'>{t('severity.medium')}</option>
                <option value='high'>{t('severity.high')}</option>
                <option value='critical'>{t('severity.critical')}</option>
              </select>
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.occurredAt')}</label>
              <input type='datetime-local' value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required className='w-full rounded-md border border-border px-3 py-2 text-sm' />
            </div>
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.approver')}</label>
            <select
              value={approverId}
              onChange={e => setApproverId(e.target.value)}
              className='w-full rounded-md border border-border px-3 py-2 text-sm'
            >
              <option value=''>{t('form.autoApprover')}</option>
              {approverCandidates.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email} ({user.role})
                </option>
              ))}
            </select>
            <p className='mt-1 text-xs text-text-muted'>{t('form.approverHint')}</p>
          </div>

          {/* Related Items Section */}
          <div className='rounded-md border border-border p-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-semibold text-text-primary'>{t('links.title')}</h3>
              <button
                type='button'
                onClick={handleOpenAddLink}
                className='rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700'
              >
                {t('links.addLink')}
              </button>
            </div>

            {pendingLinks.length === 0 && !showAddLink && (
              <p className='mt-2 text-sm text-text-muted'>{t('links.noLinks')}</p>
            )}

            {pendingLinks.length > 0 && (
              <div className='mt-3 space-y-3'>
                {(['task', 'risk', 'asset'] as IncidentLinkType[]).map(type => {
                  const typeLinks = groupedPendingLinks[type]
                  if (typeLinks.length === 0) return null
                  return (
                    <div key={type}>
                      <h4 className='mb-1 text-xs font-medium text-text-secondary'>{linkTypeLabel(type)}</h4>
                      <ul className='space-y-1'>
                        {typeLinks.map(link => (
                          <li key={link.tempId} className='flex items-center justify-between rounded-md border border-border bg-app px-3 py-1.5 text-sm'>
                            <span className='text-text-secondary'>{link.targetLabel}</span>
                            <button
                              type='button'
                              onClick={() => handleRemovePendingLink(link.tempId)}
                              className='ml-2 text-red-500 hover:text-red-700'
                              title={t('links.remove')}
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' viewBox='0 0 20 20' fill='currentColor'>
                                <path fillRule='evenodd' d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z' clipRule='evenodd' />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add Link Dialog */}
            {showAddLink && (
              <div className='mt-3 rounded-md border border-blue-200 bg-blue-50 p-3'>
                <div className='space-y-2'>
                  <div>
                    <label className='mb-1 block text-xs font-medium text-text-secondary'>{t('links.title')}</label>
                    <div className='flex gap-2'>
                      {(['task', 'risk', 'asset'] as IncidentLinkType[]).map(type => (
                        <button
                          key={type}
                          type='button'
                          onClick={() => handleLinkTypeChange(type)}
                          className={`rounded-md px-3 py-1 text-xs font-medium ${
                            selectedLinkType === type
                              ? 'bg-blue-600 text-white'
                              : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover'
                          }`}
                        >
                          {linkTypeLabel(type)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className='mb-1 block text-xs font-medium text-text-secondary'>{t('links.selectTarget')}</label>
                    {candidatesLoading ? (
                      <p className='text-xs text-text-muted'>{t('loading')}</p>
                    ) : targetCandidates.length === 0 ? (
                      <p className='text-xs text-text-muted'>{t('links.noLinks')}</p>
                    ) : (
                      <select
                        value={selectedTargetId}
                        onChange={e => setSelectedTargetId(e.target.value)}
                        className='w-full rounded-md border border-border px-3 py-1.5 text-sm'
                      >
                        {targetCandidates.map(candidate => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className='flex justify-end gap-2'>
                    <button
                      type='button'
                      onClick={() => {
                        setShowAddLink(false)
                        setTargetCandidates([])
                        setSelectedTargetId('')
                      }}
                      className='rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover'
                    >
                      {t('form.cancel')}
                    </button>
                    <button
                      type='button'
                      onClick={handleAddPendingLink}
                      disabled={!selectedTargetId}
                      className='rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60'
                    >
                      {t('links.addLink')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => router.push(`/${locale}/incidents`)} className='rounded-md border border-border px-4 py-2 text-sm'>
              {t('form.cancel')}
            </button>
            <button type='submit' disabled={submitting} className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60'>
              {submitting ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
