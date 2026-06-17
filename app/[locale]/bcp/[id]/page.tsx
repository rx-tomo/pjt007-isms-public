'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  BcpService,
  type BcpDrillRecord,
  type BcpDrillStatus,
  type BcpImpactLevel,
  type BcpLikelihood,
  type BcpPlanRecord,
  type BcpPriority,
  type BcpRecoveryObjectiveRecord,
  type BcpScenarioRecord,
  type BcpScenarioType
} from '@/lib/services/bcp'
import { OrganizationService } from '@/lib/services/organization'
import { useTranslations } from 'next-intl'

const bcpService = new BcpService()
const organizationService = new OrganizationService()

const drillStatusBadgeClass: Record<string, string> = {
  planned: 'bg-surface-elevated text-text-secondary',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700'
}

const priorityBadgeClass: Record<string, string> = {
  low: 'bg-surface-elevated text-text-secondary',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700'
}

const planStatusBadgeClass: Record<string, string> = {
  draft: 'bg-surface-elevated text-text-secondary',
  active: 'bg-emerald-100 text-emerald-700',
  under_review: 'bg-amber-100 text-amber-700',
  archived: 'bg-violet-100 text-violet-700'
}

export default function BcpDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('bcp')
  const router = useRouter()
  const [plan, setPlan] = useState<BcpPlanRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [scenarios, setScenarios] = useState<BcpScenarioRecord[]>([])
  const [drills, setDrills] = useState<BcpDrillRecord[]>([])
  const [recoveryObjectives, setRecoveryObjectives] = useState<BcpRecoveryObjectiveRecord[]>([])

  const [showScenarios, setShowScenarios] = useState(true)
  const [showDrills, setShowDrills] = useState(true)
  const [showRecovery, setShowRecovery] = useState(true)

  const [scenarioTitle, setScenarioTitle] = useState('')
  const [scenarioType, setScenarioType] = useState<BcpScenarioType>('natural_disaster')
  const [scenarioImpactLevel, setScenarioImpactLevel] = useState<BcpImpactLevel>('low')
  const [scenarioLikelihood, setScenarioLikelihood] = useState<BcpLikelihood>('possible')
  const [scenarioResponseProcedure, setScenarioResponseProcedure] = useState('')
  const [scenarioSaving, setScenarioSaving] = useState(false)
  const [showScenarioForm, setShowScenarioForm] = useState(false)

  const [drillTitle, setDrillTitle] = useState('')
  const [drillScheduledDate, setDrillScheduledDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [drillStatus, setDrillStatus] = useState<BcpDrillStatus>('planned')
  const [drillSaving, setDrillSaving] = useState(false)
  const [showDrillForm, setShowDrillForm] = useState(false)

  const [objectiveTargetSystem, setObjectiveTargetSystem] = useState('')
  const [objectiveRtoHours, setObjectiveRtoHours] = useState('0')
  const [objectiveRpoHours, setObjectiveRpoHours] = useState('0')
  const [objectivePriority, setObjectivePriority] = useState<BcpPriority>('medium')
  const [objectiveNotes, setObjectiveNotes] = useState('')
  const [objectiveSaving, setObjectiveSaving] = useState(false)
  const [showObjectiveForm, setShowObjectiveForm] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [planRecord, loadedScenarios, loadedDrills, loadedObjectives, organization] = await Promise.all([
        bcpService.getPlanById(id),
        bcpService.listScenarios(id),
        bcpService.listDrills(id),
        bcpService.listRecoveryObjectives(id),
        organizationService.getCurrentOrganization()
      ])

      setPlan(planRecord)
      setScenarios(loadedScenarios)
      setDrills(loadedDrills)
      setRecoveryObjectives(loadedObjectives)
      setOrganizationId(organization?.id ?? null)
    } catch (err) {
      console.error(err)
      setError(t('errors.loadFailed'))
      setPlan(null)
      setScenarios([])
      setDrills([])
      setRecoveryObjectives([])
    } finally {
      setLoading(false)
    }
  }, [id, t])

  const loadScenarios = useCallback(async () => {
    try {
      const loadedScenarios = await bcpService.listScenarios(id)
      setScenarios(loadedScenarios)
    } catch (err) {
      console.error(err)
      setError(t('errors.loadFailed'))
    }
  }, [id, t])

  const loadDrills = useCallback(async () => {
    try {
      const loadedDrills = await bcpService.listDrills(id)
      setDrills(loadedDrills)
    } catch (err) {
      console.error(err)
      setError(t('errors.loadFailed'))
    }
  }, [id, t])

  const loadRecoveryObjectives = useCallback(async () => {
    try {
      const loadedRecoveryObjectives = await bcpService.listRecoveryObjectives(id)
      setRecoveryObjectives(loadedRecoveryObjectives)
    } catch (err) {
      console.error(err)
      setError(t('errors.loadFailed'))
    }
  }, [id, t])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleDeletePlan = async () => {
    if (!plan) return
    const confirmed = window.confirm(t('detail.confirmDelete'))
    if (!confirmed) return

    try {
      await bcpService.deletePlan(plan.id)
      router.push(`/${locale}/bcp`)
    } catch (err) {
      console.error(err)
      setError(t('errors.deleteFailed'))
    }
  }

  const handleAddScenario = async () => {
    if (!organizationId || !scenarioTitle) return
    setScenarioSaving(true)
    try {
      await bcpService.createScenario({
        plan_id: id,
        organization_id: organizationId,
        title: scenarioTitle,
        scenario_type: scenarioType,
        impact_level: scenarioImpactLevel,
        likelihood: scenarioLikelihood,
        response_procedure: scenarioResponseProcedure || null
      })

      setScenarioTitle('')
      setScenarioType('natural_disaster')
      setScenarioImpactLevel('low')
      setScenarioLikelihood('possible')
      setScenarioResponseProcedure('')
      setShowScenarioForm(false)
      await loadScenarios()
    } catch (err) {
      console.error(err)
      setError(t('errors.saveFailed'))
    } finally {
      setScenarioSaving(false)
    }
  }

  const handleDeleteScenario = async (scenarioId: string) => {
    try {
      await bcpService.deleteScenario(scenarioId)
      await loadScenarios()
    } catch (err) {
      console.error(err)
      setError(t('errors.deleteFailed'))
    }
  }

  const handleAddDrill = async () => {
    if (!organizationId || !drillTitle || !drillScheduledDate) return
    setDrillSaving(true)
    try {
      await bcpService.createDrill({
        plan_id: id,
        organization_id: organizationId,
        title: drillTitle,
        scheduled_date: new Date(drillScheduledDate).toISOString(),
        status: drillStatus
      })

      setDrillTitle('')
      setDrillScheduledDate(new Date().toISOString().slice(0, 10))
      setDrillStatus('planned')
      setShowDrillForm(false)
      await loadDrills()
    } catch (err) {
      console.error(err)
      setError(t('errors.saveFailed'))
    } finally {
      setDrillSaving(false)
    }
  }

  const handleDeleteDrill = async (drillId: string) => {
    try {
      await bcpService.deleteDrill(drillId)
      await loadDrills()
    } catch (err) {
      console.error(err)
      setError(t('errors.deleteFailed'))
    }
  }

  const handleAddObjective = async () => {
    if (!organizationId || !objectiveTargetSystem) return
    setObjectiveSaving(true)
    try {
      await bcpService.createRecoveryObjective({
        plan_id: id,
        organization_id: organizationId,
        target_system: objectiveTargetSystem,
        rto_hours: objectiveRtoHours,
        rpo_hours: objectiveRpoHours,
        priority: objectivePriority,
        notes: objectiveNotes || null
      })

      setObjectiveTargetSystem('')
      setObjectiveRtoHours('0')
      setObjectiveRpoHours('0')
      setObjectivePriority('medium')
      setObjectiveNotes('')
      setShowObjectiveForm(false)
      await loadRecoveryObjectives()
    } catch (err) {
      console.error(err)
      setError(t('errors.saveFailed'))
    } finally {
      setObjectiveSaving(false)
    }
  }

  const handleDeleteObjective = async (objectiveId: string) => {
    try {
      await bcpService.deleteRecoveryObjective(objectiveId)
      await loadRecoveryObjectives()
    } catch (err) {
      console.error(err)
      setError(t('errors.deleteFailed'))
    }
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mb-4'>
          <Link href={`/${locale}/bcp`} className='text-sm text-blue-700 hover:underline'>
            &larr; {t('backToList')}
          </Link>
        </div>

        {loading && <div className='rounded-md border border-border bg-surface p-6 text-sm text-text-muted'>{t('loading')}</div>}
        {!loading && error && <div className='rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>}

        {!loading && !error && plan && (
          <>
            <article className='rounded-lg border border-border bg-surface p-6'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <h1 className='text-2xl font-bold text-text-primary'>{plan.title}</h1>
                  <div className='mt-2 flex flex-wrap gap-2 text-sm'>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${planStatusBadgeClass[plan.status] ?? planStatusBadgeClass.draft}`}>
                      {t(`status.${plan.status}`)}
                    </span>
                    <span className='rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700'>
                      {t('detail.version')}: {plan.version || '-'}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => router.push(`/${locale}/bcp/new?planId=${plan.id}`)}
                    className='rounded-md border border-border px-3 py-1 text-sm text-text-secondary hover:bg-surface-hover'
                  >
                    {t('detail.edit')}
                  </button>
                  <button
                    type='button'
                    onClick={handleDeletePlan}
                    className='rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50'
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </div>

              <dl className='mt-6 grid gap-4 sm:grid-cols-2'>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.scope')}</dt>
                  <dd className='mt-1 whitespace-pre-wrap text-sm text-text-secondary'>{plan.scope || t('detail.noScope')}</dd>
                </div>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.createdAt')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>{new Date(plan.created_at).toLocaleString(locale)}</dd>
                </div>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.updatedAt')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>{new Date(plan.updated_at).toLocaleString(locale)}</dd>
                </div>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.lastReviewedAt')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>
                    {plan.last_reviewed_at ? new Date(plan.last_reviewed_at).toLocaleString(locale) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className='text-xs font-semibold uppercase text-text-muted'>{t('detail.nextReviewDate')}</dt>
                  <dd className='mt-1 text-sm text-text-secondary'>
                    {plan.next_review_date ? new Date(plan.next_review_date).toLocaleString(locale) : '-'}
                  </dd>
                </div>
              </dl>
            </article>

            <section className='mt-6 rounded-lg border border-border bg-surface p-6'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-text-primary'>{t('scenarios.title')}</h2>
                <button
                  type='button'
                  onClick={() => setShowScenarios(prev => !prev)}
                  className='text-sm text-text-secondary'
                >
                  {showScenarios ? '-' : '+'}
                </button>
              </div>

              {showScenarios && (
                <>
                  <div className='mb-4 flex justify-end'>
                    <button
                      type='button'
                      onClick={() => setShowScenarioForm(prev => !prev)}
                      className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
                    >
                      {showScenarioForm ? t('form.cancel') : t('scenarios.add')}
                    </button>
                  </div>

                  <div className='overflow-hidden rounded-md border border-border'>
                    <table className='min-w-full divide-y divide-border'>
                      <thead className='bg-app'>
                        <tr>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.title')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('scenarios.scenarioType')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('scenarios.impactLevel')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('scenarios.likelihood')}</th>
                          <th className='w-16 text-left text-xs font-semibold uppercase text-text-muted'>{/* action */}</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-border'>
                        {scenarios.length === 0 && (
                          <tr>
                            <td colSpan={5} className='px-4 py-10 text-center text-sm text-text-muted'>
                              {t('scenarios.empty')}
                            </td>
                          </tr>
                        )}
                        {scenarios.map(item => (
                          <tr key={item.id}>
                            <td className='px-4 py-3 text-sm text-text-primary'>
                              <p className='font-medium text-text-primary'>{item.title}</p>
                              <p className='text-xs text-text-muted'>{item.response_procedure || t('scenarios.noResponse')}</p>
                            </td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{t(`scenarioType.${item.scenario_type}`)}</td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{t(`impactLevel.${item.impact_level}`)}</td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{t(`likelihood.${item.likelihood}`)}</td>
                            <td className='px-4 py-3 text-sm'>
                              <button
                                type='button'
                                onClick={() => handleDeleteScenario(item.id)}
                                className='text-red-500 hover:text-red-700'
                                title={t('detail.delete')}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showScenarioForm && (
                    <div className='mt-4 space-y-3 rounded-md border border-blue-100 bg-blue-50 p-4'>
                      <div>
                        <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('table.title')}</label>
                        <input
                          value={scenarioTitle}
                          onChange={e => setScenarioTitle(e.target.value)}
                          required
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='grid gap-3 sm:grid-cols-2'>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('scenarios.scenarioType')}</label>
                          <select
                            value={scenarioType}
                            onChange={e => setScenarioType(e.target.value as BcpScenarioType)}
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          >
                            <option value='natural_disaster'>{t('scenarioType.natural_disaster')}</option>
                            <option value='cyber_attack'>{t('scenarioType.cyber_attack')}</option>
                            <option value='system_failure'>{t('scenarioType.system_failure')}</option>
                            <option value='pandemic'>{t('scenarioType.pandemic')}</option>
                            <option value='supply_chain'>{t('scenarioType.supply_chain')}</option>
                            <option value='power_outage'>{t('scenarioType.power_outage')}</option>
                            <option value='other'>{t('scenarioType.other')}</option>
                          </select>
                        </div>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('scenarios.impactLevel')}</label>
                          <select
                            value={scenarioImpactLevel}
                            onChange={e => setScenarioImpactLevel(e.target.value as BcpImpactLevel)}
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          >
                            <option value='low'>{t('impactLevel.low')}</option>
                            <option value='medium'>{t('impactLevel.medium')}</option>
                            <option value='high'>{t('impactLevel.high')}</option>
                            <option value='critical'>{t('impactLevel.critical')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('scenarios.likelihood')}</label>
                        <select
                          value={scenarioLikelihood}
                          onChange={e => setScenarioLikelihood(e.target.value as BcpLikelihood)}
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
                        >
                          <option value='rare'>{t('likelihood.rare')}</option>
                          <option value='unlikely'>{t('likelihood.unlikely')}</option>
                          <option value='possible'>{t('likelihood.possible')}</option>
                          <option value='likely'>{t('likelihood.likely')}</option>
                          <option value='almost_certain'>{t('likelihood.almost_certain')}</option>
                        </select>
                      </div>
                      <div>
                        <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('scenarios.responseProcedure')}</label>
                        <textarea
                          value={scenarioResponseProcedure}
                          onChange={e => setScenarioResponseProcedure(e.target.value)}
                          rows={3}
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='flex justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => setShowScenarioForm(false)}
                          className='rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover'
                        >
                          {t('form.cancel')}
                        </button>
                        <button
                          type='button'
                          onClick={handleAddScenario}
                          disabled={scenarioSaving || !scenarioTitle}
                          className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60'
                        >
                          {scenarioSaving ? t('form.saving') : t('scenarios.add')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className='mt-6 rounded-lg border border-border bg-surface p-6'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-text-primary'>{t('drills.title')}</h2>
                <button
                  type='button'
                  onClick={() => setShowDrills(prev => !prev)}
                  className='text-sm text-text-secondary'
                >
                  {showDrills ? '-' : '+'}
                </button>
              </div>

              {showDrills && (
                <>
                  <div className='mb-4 flex justify-end'>
                    <button
                      type='button'
                      onClick={() => setShowDrillForm(prev => !prev)}
                      className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
                    >
                      {showDrillForm ? t('form.cancel') : t('drills.add')}
                    </button>
                  </div>

                  <div className='overflow-hidden rounded-md border border-border'>
                    <table className='min-w-full divide-y divide-border'>
                      <thead className='bg-app'>
                        <tr>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.title')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('drills.scheduledDate')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('drills.conductedDate')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.status')}</th>
                          <th className='w-16 text-left text-xs font-semibold uppercase text-text-muted'>{/* action */}</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-border'>
                        {drills.length === 0 && (
                          <tr>
                            <td colSpan={5} className='px-4 py-10 text-center text-sm text-text-muted'>
                              {t('drills.empty')}
                            </td>
                          </tr>
                        )}
                        {drills.map(item => (
                          <tr key={item.id}>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{item.title}</td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{new Date(item.scheduled_date).toLocaleDateString(locale)}</td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{item.conducted_date ? new Date(item.conducted_date).toLocaleDateString(locale) : '-'}</td>
                            <td className='px-4 py-3 text-sm'>
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${drillStatusBadgeClass[item.status] ?? drillStatusBadgeClass.planned}`}>
                                {t(`drillStatus.${item.status}`)}
                              </span>
                            </td>
                            <td className='px-4 py-3 text-sm'>
                              <button
                                type='button'
                                onClick={() => handleDeleteDrill(item.id)}
                                className='text-red-500 hover:text-red-700'
                                title={t('detail.delete')}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showDrillForm && (
                    <div className='mt-4 space-y-3 rounded-md border border-blue-100 bg-blue-50 p-4'>
                      <div>
                        <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('table.title')}</label>
                        <input
                          value={drillTitle}
                          onChange={e => setDrillTitle(e.target.value)}
                          required
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='grid gap-3 sm:grid-cols-2'>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('drills.scheduledDate')}</label>
                          <input
                            type='date'
                            value={drillScheduledDate}
                            onChange={e => setDrillScheduledDate(e.target.value)}
                            required
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          />
                        </div>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.status')}</label>
                          <select
                            value={drillStatus}
                            onChange={e => setDrillStatus(e.target.value as BcpDrillStatus)}
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          >
                            <option value='planned'>{t('drillStatus.planned')}</option>
                            <option value='in_progress'>{t('drillStatus.in_progress')}</option>
                            <option value='completed'>{t('drillStatus.completed')}</option>
                            <option value='cancelled'>{t('drillStatus.cancelled')}</option>
                          </select>
                        </div>
                      </div>
                      <div className='flex justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => setShowDrillForm(false)}
                          className='rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover'
                        >
                          {t('form.cancel')}
                        </button>
                        <button
                          type='button'
                          onClick={handleAddDrill}
                          disabled={drillSaving || !drillTitle || !drillScheduledDate}
                          className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60'
                        >
                          {drillSaving ? t('form.saving') : t('drills.add')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className='mt-6 rounded-lg border border-border bg-surface p-6'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-text-primary'>{t('recovery.title')}</h2>
                <button
                  type='button'
                  onClick={() => setShowRecovery(prev => !prev)}
                  className='text-sm text-text-secondary'
                >
                  {showRecovery ? '-' : '+'}
                </button>
              </div>

              {showRecovery && (
                <>
                  <div className='mb-4 flex justify-end'>
                    <button
                      type='button'
                      onClick={() => setShowObjectiveForm(prev => !prev)}
                      className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
                    >
                      {showObjectiveForm ? t('form.cancel') : t('recovery.add')}
                    </button>
                  </div>

                  <div className='overflow-hidden rounded-md border border-border'>
                    <table className='min-w-full divide-y divide-border'>
                      <thead className='bg-app'>
                        <tr>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('recovery.targetSystem')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('recovery.rtoHours')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('recovery.rpoHours')}</th>
                          <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('recovery.priority')}</th>
                          <th className='w-16 text-left text-xs font-semibold uppercase text-text-muted'>{/* action */}</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-border'>
                        {recoveryObjectives.length === 0 && (
                          <tr>
                            <td colSpan={5} className='px-4 py-10 text-center text-sm text-text-muted'>
                              {t('recovery.empty')}
                            </td>
                          </tr>
                        )}
                        {recoveryObjectives.map(item => (
                          <tr key={item.id}>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{item.target_system}</td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{item.rto_hours}</td>
                            <td className='px-4 py-3 text-sm text-text-secondary'>{item.rpo_hours}</td>
                            <td className='px-4 py-3 text-sm'>
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityBadgeClass[item.priority] ?? priorityBadgeClass.medium}`}>
                                {t(`priority.${item.priority}`)}
                              </span>
                            </td>
                            <td className='px-4 py-3 text-sm'>
                              <button
                                type='button'
                                onClick={() => handleDeleteObjective(item.id)}
                                className='text-red-500 hover:text-red-700'
                                title={t('detail.delete')}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showObjectiveForm && (
                    <div className='mt-4 space-y-3 rounded-md border border-blue-100 bg-blue-50 p-4'>
                      <div>
                        <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('recovery.targetSystem')}</label>
                        <input
                          value={objectiveTargetSystem}
                          onChange={e => setObjectiveTargetSystem(e.target.value)}
                          required
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='grid gap-3 sm:grid-cols-3'>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('recovery.rtoHours')}</label>
                          <input
                            type='number'
                            min='0'
                            value={objectiveRtoHours}
                            onChange={e => setObjectiveRtoHours(e.target.value)}
                            required
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          />
                        </div>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('recovery.rpoHours')}</label>
                          <input
                            type='number'
                            min='0'
                            value={objectiveRpoHours}
                            onChange={e => setObjectiveRpoHours(e.target.value)}
                            required
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          />
                        </div>
                        <div>
                          <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('recovery.priority')}</label>
                          <select
                            value={objectivePriority}
                            onChange={e => setObjectivePriority(e.target.value as BcpPriority)}
                            className='w-full rounded-md border border-border px-3 py-2 text-sm'
                          >
                            <option value='low'>{t('priority.low')}</option>
                            <option value='medium'>{t('priority.medium')}</option>
                            <option value='high'>{t('priority.high')}</option>
                            <option value='critical'>{t('priority.critical')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('recovery.notes')}</label>
                        <textarea
                          value={objectiveNotes}
                          onChange={e => setObjectiveNotes(e.target.value)}
                          rows={3}
                          className='w-full rounded-md border border-border px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='flex justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => setShowObjectiveForm(false)}
                          className='rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover'
                        >
                          {t('form.cancel')}
                        </button>
                        <button
                          type='button'
                          onClick={handleAddObjective}
                          disabled={objectiveSaving || !objectiveTargetSystem}
                          className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60'
                        >
                          {objectiveSaving ? t('form.saving') : t('recovery.add')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
