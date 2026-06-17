'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  IncidentService,
  type IncidentRecord,
  type IncidentLink,
  type IncidentLinkType
} from '@/lib/services/incident'
import { TaskService } from '@/lib/services/task'
import { RiskService } from '@/lib/services/risk'
import { InformationAssetService } from '@/lib/services/informationAsset'
import { OrganizationService } from '@/lib/services/organization'
import { useTranslations } from 'next-intl'

const incidentService = new IncidentService()
const taskService = new TaskService()
const riskService = new RiskService()
const assetService = new InformationAssetService()
const organizationService = new OrganizationService()

interface LinkTarget {
  id: string
  label: string
}

export default function IncidentDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('incidents')
  const [incident, setIncident] = useState<IncidentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Links state
  const [links, setLinks] = useState<IncidentLink[]>([])
  const [linksLoading, setLinksLoading] = useState(false)

  // Add link UI state
  const [showAddLink, setShowAddLink] = useState(false)
  const [selectedLinkType, setSelectedLinkType] = useState<IncidentLinkType>('task')
  const [targetCandidates, setTargetCandidates] = useState<LinkTarget[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const record = await incidentService.getById(id)
        setIncident(record)

        // Load links
        setLinksLoading(true)
        const incidentLinks = await incidentService.getIncidentLinks(id)
        setLinks(incidentLinks)

        // Load organization for candidate fetching
        const org = await organizationService.getCurrentOrganization()
        if (org?.id) {
          setOrganizationId(org.id)
        }
      } catch (err) {
        console.error(err)
        setError(t('errors.notFound'))
      } finally {
        setLoading(false)
        setLinksLoading(false)
      }
    }

    load()
  }, [id, t])

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

      // Filter out already linked targets of same type
      const existingTargetIds = new Set(
        links.filter(l => l.link_type === linkType).map(l => l.link_id)
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
  }, [organizationId, links])

  const handleOpenAddLink = () => {
    setShowAddLink(true)
    setSelectedLinkType('task')
    loadCandidates('task')
  }

  const handleLinkTypeChange = (linkType: IncidentLinkType) => {
    setSelectedLinkType(linkType)
    loadCandidates(linkType)
  }

  const handleAddLink = async () => {
    if (!selectedTargetId) return
    setLinkSaving(true)
    try {
      const newLink = await incidentService.createIncidentLink(id, selectedLinkType, selectedTargetId)
      setLinks(prev => [...prev, newLink])
      setShowAddLink(false)
      setSelectedTargetId('')
      setTargetCandidates([])
    } catch (err) {
      console.error('Failed to create link', err)
    } finally {
      setLinkSaving(false)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    try {
      await incidentService.deleteIncidentLink(linkId)
      setLinks(prev => prev.filter(l => l.id !== linkId))
    } catch (err) {
      console.error('Failed to delete link', err)
    }
  }

  const groupedLinks = {
    task: links.filter(l => l.link_type === 'task'),
    risk: links.filter(l => l.link_type === 'risk'),
    asset: links.filter(l => l.link_type === 'asset')
  }

  const linkTypeLabel = (type: IncidentLinkType): string => {
    return t(`links.${type}`)
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mb-4'>
          <Link href={`/${locale}/incidents`} className='text-sm text-blue-700 hover:underline'>
            &larr; {t('backToList')}
          </Link>
        </div>

        {loading && <div className='rounded-md border border-border bg-surface p-6 text-sm text-text-muted'>{t('loading')}</div>}
        {!loading && error && <div className='rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>}

        {!loading && !error && incident && (
          <>
            <article className='rounded-lg border border-border bg-surface p-6'>
              <h1 className='text-2xl font-bold text-text-primary'>{incident.title}</h1>
              <div className='mt-2 flex flex-wrap gap-2 text-sm'>
                <span className='rounded-full bg-surface-elevated px-2 py-1 text-text-secondary'>{t(`severity.${incident.severity}`)}</span>
                <span className='rounded-full bg-blue-100 px-2 py-1 text-blue-700'>{t(`status.${incident.status}`)}</span>
                <span className='rounded-full bg-amber-100 px-2 py-1 text-amber-700'>{t(`approvalStatus.${incident.approval_status ?? 'none'}`)}</span>
              </div>

              <dl className='mt-6 grid gap-4 sm:grid-cols-2'>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.occurredAt')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>{new Date(incident.occurred_at).toLocaleString(locale)}</dd>
                </div>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.createdAt')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>{new Date(incident.created_at).toLocaleString(locale)}</dd>
                </div>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.approvalDueAt')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>
                    {incident.approval_due_at ? new Date(incident.approval_due_at).toLocaleString(locale) : '-'}
                  </dd>
                </div>
              </dl>

              <section className='mt-6'>
                <h2 className='text-sm font-semibold text-text-primary'>{t('detail.description')}</h2>
                <p className='mt-2 whitespace-pre-wrap text-sm text-text-secondary'>{incident.description || t('detail.noDescription')}</p>
              </section>
            </article>

            {/* Related Links Section */}
            <section className='mt-6 rounded-lg border border-border bg-surface p-6'>
              <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-text-primary'>{t('links.title')}</h2>
                <button
                  type='button'
                  onClick={handleOpenAddLink}
                  className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
                >
                  {t('links.addLink')}
                </button>
              </div>

              {linksLoading && (
                <p className='mt-4 text-sm text-text-muted'>{t('loading')}</p>
              )}

              {!linksLoading && links.length === 0 && (
                <p className='mt-4 text-sm text-text-muted'>{t('links.noLinks')}</p>
              )}

              {!linksLoading && links.length > 0 && (
                <div className='mt-4 space-y-4'>
                  {(['task', 'risk', 'asset'] as IncidentLinkType[]).map(type => {
                    const typeLinks = groupedLinks[type]
                    if (typeLinks.length === 0) return null
                    return (
                      <div key={type}>
                        <h3 className='mb-2 text-sm font-medium text-text-secondary'>{linkTypeLabel(type)}</h3>
                        <ul className='space-y-1'>
                          {typeLinks.map(link => (
                            <li key={link.id} className='flex items-center justify-between rounded-md border border-border bg-app px-3 py-2 text-sm'>
                              <span className='text-text-secondary'>{link.link_id}</span>
                              <button
                                type='button'
                                onClick={() => handleDeleteLink(link.id)}
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
                <div className='mt-4 rounded-md border border-blue-200 bg-blue-50 p-4'>
                  <div className='space-y-3'>
                    <div>
                      <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('links.title')}</label>
                      <div className='flex gap-2'>
                        {(['task', 'risk', 'asset'] as IncidentLinkType[]).map(type => (
                          <button
                            key={type}
                            type='button'
                            onClick={() => handleLinkTypeChange(type)}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
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
                      <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('links.selectTarget')}</label>
                      {candidatesLoading ? (
                        <p className='text-sm text-text-muted'>{t('loading')}</p>
                      ) : targetCandidates.length === 0 ? (
                        <p className='text-sm text-text-muted'>{t('links.noLinks')}</p>
                      ) : (
                        <select
                          value={selectedTargetId}
                          onChange={e => setSelectedTargetId(e.target.value)}
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
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
                        className='rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover'
                      >
                        {t('form.cancel')}
                      </button>
                      <button
                        type='button'
                        onClick={handleAddLink}
                        disabled={!selectedTargetId || linkSaving}
                        className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60'
                      >
                        {linkSaving ? t('form.saving') : t('links.addLink')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
