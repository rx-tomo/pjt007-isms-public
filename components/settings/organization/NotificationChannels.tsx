'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import {
  listChannels,
  listChannelLogs,
  upsertChannel,
  deleteChannel,
  type NotificationChannel,
  type NotificationChannelLog,
  type NotificationChannelType
} from '@/lib/services/notificationChannels'
import type { NotificationType } from '@/lib/services/notification'
import { Button } from '@/components/ui/Button'

interface NotificationChannelsPanelProps {
  organizationId: string
}

const notificationTypeOptions: { value: NotificationChannel['notificationType']; labelKey: string }[] = [
  { value: 'task_reminder', labelKey: 'notificationTypes.taskReminder' },
  { value: 'document_approval', labelKey: 'notificationTypes.documentApproval' },
  { value: 'audit_schedule', labelKey: 'notificationTypes.auditSchedule' },
  { value: 'risk_alert', labelKey: 'notificationTypes.riskAlert' },
  { value: 'system', labelKey: 'notificationTypes.system' },
  { value: 'info', labelKey: 'notificationTypes.info' }
]

const channelTypeOptions: { value: NotificationChannelType; labelKey: string }[] = [
  { value: 'slack', labelKey: 'channelTypes.slack' },
  { value: 'teams', labelKey: 'channelTypes.teams' },
  { value: 'custom', labelKey: 'channelTypes.custom' }
]

const formatTimestamp = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '-'

const obfuscateWebhook = (url: string) => {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}/...`
  } catch {
    return url.replace(/(.{4}).+(.{4})/, '$1****$2')
  }
}

export default function NotificationChannelsPanel({ organizationId }: NotificationChannelsPanelProps) {
  const t = useTranslations('settings.organization.notificationChannels')
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, NotificationChannelLog[]>>({})
  const [formState, setFormState] = useState<{
    id?: string
    notificationType: NotificationChannel['notificationType']
    channelType: NotificationChannelType
    webhookUrl: string
    isEnabled: boolean
    customPayloadTemplate: string
    customHeaders: { key: string; value: string }[]
  }>({
    notificationType: 'task_reminder',
    channelType: 'slack',
    webhookUrl: '',
    isEnabled: true,
    customPayloadTemplate: '',
    customHeaders: [{ key: '', value: '' }]
  })

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listChannels(organizationId)
      setChannels(data)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const resetForm = useCallback(() => {
    setFormState({
      notificationType: 'task_reminder',
      channelType: 'slack',
      webhookUrl: '',
      isEnabled: true,
      customPayloadTemplate: '',
      customHeaders: [{ key: '', value: '' }]
    })
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSaving(true)
      setError(null)
      setSuccess(null)

      try {
        // Parse customPayloadTemplate JSON if provided
        let parsedTemplate: Record<string, unknown> | null = null
        if (formState.channelType === 'custom' && formState.customPayloadTemplate.trim()) {
          try {
            parsedTemplate = JSON.parse(formState.customPayloadTemplate)
          } catch {
            setError(t('customWebhook.invalidJson'))
            setSaving(false)
            return
          }
        }

        // Convert custom headers array to object, filtering empty entries
        const headersObj: Record<string, string> | null =
          formState.channelType === 'custom'
            ? formState.customHeaders
                .filter(h => h.key.trim() !== '')
                .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {} as Record<string, string>)
            : null

        const payload = {
          id: formState.id,
          notificationType: formState.notificationType as NotificationType,
          channelType: formState.channelType,
          webhookUrl: formState.webhookUrl,
          isEnabled: formState.isEnabled,
          organizationId: organizationId,
          customPayloadTemplate: parsedTemplate ? JSON.stringify(parsedTemplate) : null,
          customHeaders: (Object.keys(headersObj ?? {}).length > 0 ? JSON.stringify(headersObj) : null)
        }

        const created = await upsertChannel(payload)
        if (!created) {
          throw new Error('failed to save channel')
        }

        setSuccess(t('messages.saved'))
        resetForm()
        await loadChannels()
      } catch (err) {
        setError(t('messages.saveFailed'))
        console.error('[NotificationChannelsPanel] Save failed', err)
      } finally {
        setSaving(false)
      }
    },
    [formState, organizationId, loadChannels, resetForm, t]
  )

  const handleEdit = (channel: NotificationChannel) => {
    // Convert customHeaders string to array format for editing
    let headersArray: { key: string; value: string }[] = [{ key: '', value: '' }]
    if (channel.customHeaders) {
      try {
        const parsed = typeof channel.customHeaders === 'string'
          ? JSON.parse(channel.customHeaders) as Record<string, string>
          : channel.customHeaders as Record<string, string>
        headersArray = Object.entries(parsed).map(([key, value]) => ({ key, value }))
      } catch { /* ignore */ }
    }
    if (headersArray.length === 0) {
      headersArray.push({ key: '', value: '' })
    }

    let templateStr = ''
    if (channel.customPayloadTemplate) {
      try {
        const parsed = typeof channel.customPayloadTemplate === 'string'
          ? JSON.parse(channel.customPayloadTemplate)
          : channel.customPayloadTemplate
        templateStr = JSON.stringify(parsed, null, 2)
      } catch {
        templateStr = String(channel.customPayloadTemplate)
      }
    }

    setFormState({
      id: channel.id,
      notificationType: channel.notificationType,
      channelType: channel.channelType,
      webhookUrl: channel.webhookUrl,
      isEnabled: channel.isEnabled,
      customPayloadTemplate: templateStr,
      customHeaders: headersArray
    })
  }

  const handleDelete = async (channel: NotificationChannel) => {
    if (!window.confirm(t('actions.confirmDelete'))) {
      return
    }

    setLoading(true)
    try {
      await deleteChannel(channel.id, organizationId)
      await loadChannels()
    } finally {
      setLoading(false)
    }
  }

  const toggleChannelEnabled = async (channel: NotificationChannel) => {
    setSaving(true)
    try {
      await upsertChannel({
        id: channel.id,
        organizationId: channel.organizationId,
        notificationType: channel.notificationType,
        channelType: channel.channelType,
        webhookUrl: channel.webhookUrl,
        isEnabled: !channel.isEnabled
      })
      await loadChannels()
    } finally {
      setSaving(false)
    }
  }

  const showLogs = async (channelId: string) => {
    if (expandedId === channelId) {
      setExpandedId(null)
      return
    }

    const channelLogs = await listChannelLogs(channelId, 5, organizationId)
    setLogs(prev => ({ ...prev, [channelId]: channelLogs }))
    setExpandedId(channelId)
  }

  const formTitle = formState.id ? t('form.editTitle') : t('form.title')

  const hasChannels = channels.length > 0

  return (
    <div className="bg-surface rounded-lg shadow border border-border">
      <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{t('title')}</h3>
          <p className="text-sm text-text-muted">{t('description')}</p>
        </div>
        <span className="text-xs font-medium tracking-wide text-indigo-600 uppercase">{t('subtitle')}</span>
      </div>

      <div className="px-6 py-5 border-b border-border">
        {error && (
          <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded mb-3">{error}</div>
        )}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded mb-3">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary">{t('fields.notificationType')}</label>
            <select
              value={formState.notificationType}
              onChange={e =>
                setFormState(prev => ({ ...prev, notificationType: e.target.value as NotificationChannel['notificationType'] }))
              }
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {notificationTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">{t('fields.channelType')}</label>
            <select
              value={formState.channelType}
              onChange={e => setFormState(prev => ({ ...prev, channelType: e.target.value as NotificationChannelType }))}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {channelTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">{t('fields.webhookUrl')}</label>
            <input
              type="url"
              required
              value={formState.webhookUrl}
              onChange={e => setFormState(prev => ({ ...prev, webhookUrl: e.target.value }))}
              placeholder="https://hooks.slack.com/..."
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Custom Webhook: Payload Template Editor */}
          {formState.channelType === 'custom' && (
            <div className="sm:col-span-3" data-testid="custom-template-editor">
              <label className="block text-sm font-medium text-text-secondary">
                {t('customWebhook.payloadTemplate')}
              </label>
              <textarea
                value={formState.customPayloadTemplate}
                onChange={e => setFormState(prev => ({ ...prev, customPayloadTemplate: e.target.value }))}
                placeholder={`{\n  "text": "{{title}}: {{message}}",\n  "priority": "{{priority}}"\n}`}
                rows={6}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-text-muted">
                {t('customWebhook.placeholdersHelp')}
              </p>
              <p className="text-xs text-text-muted">
                <code className="bg-surface-elevated px-1 rounded">{'{{title}}'}</code>,{' '}
                <code className="bg-surface-elevated px-1 rounded">{'{{message}}'}</code>,{' '}
                <code className="bg-surface-elevated px-1 rounded">{'{{type}}'}</code>,{' '}
                <code className="bg-surface-elevated px-1 rounded">{'{{priority}}'}</code>,{' '}
                <code className="bg-surface-elevated px-1 rounded">{'{{link}}'}</code>,{' '}
                <code className="bg-surface-elevated px-1 rounded">{'{{timestamp}}'}</code>
              </p>
            </div>
          )}

          {/* Custom Webhook: Headers Editor */}
          {formState.channelType === 'custom' && (
            <div className="sm:col-span-3" data-testid="custom-headers-editor">
              <label className="block text-sm font-medium text-text-secondary">
                {t('customWebhook.customHeaders')}
              </label>
              <p className="mb-2 text-xs text-text-muted">
                {t('customWebhook.headersHelp')}
              </p>
              <div className="space-y-2">
                {formState.customHeaders.map((header, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={header.key}
                      onChange={e => {
                        const newHeaders = [...formState.customHeaders]
                        newHeaders[index] = { ...newHeaders[index], key: e.target.value }
                        setFormState(prev => ({ ...prev, customHeaders: newHeaders }))
                      }}
                      placeholder={t('customWebhook.headerKeyPlaceholder')}
                      className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={e => {
                        const newHeaders = [...formState.customHeaders]
                        newHeaders[index] = { ...newHeaders[index], value: e.target.value }
                        setFormState(prev => ({ ...prev, customHeaders: newHeaders }))
                      }}
                      placeholder={t('customWebhook.headerValuePlaceholder')}
                      className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (formState.customHeaders.length > 1) {
                          const newHeaders = formState.customHeaders.filter((_, i) => i !== index)
                          setFormState(prev => ({ ...prev, customHeaders: newHeaders }))
                        } else {
                          setFormState(prev => ({ ...prev, customHeaders: [{ key: '', value: '' }] }))
                        }
                      }}
                      className="p-2 text-text-muted hover:text-red-500"
                      aria-label={t('customWebhook.removeHeader')}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormState(prev => ({
                    ...prev,
                    custom_headers: [...prev.customHeaders, { key: '', value: '' }]
                  }))
                }
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                + {t('customWebhook.addHeader')}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 sm:col-span-3">
            <label className="flex items-center text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={formState.isEnabled}
                onChange={e => setFormState(prev => ({ ...prev, isEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2">{t('fields.isEnabled')}</span>
            </label>

            <Button type="submit" disabled={saving} className="px-4 py-2">
              {saving ? t('actions.saving') : t('actions.save')}
            </Button>

            {formState.id && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-text-muted"
              >
                {t('actions.cancelEdit')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="px-6 py-5">
        {!hasChannels && !loading ? (
          <p className="text-sm text-text-muted" data-testid="notification-channels-empty">{t('emptyMessage')}</p>
        ) : (
          channels.map(channel => (
            <div key={channel.id} className="border rounded-lg p-4 mb-4 bg-surface-elevated">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-text-muted">{t('fields.notificationType')}</p>
                  <p className="text-base font-semibold text-text-primary">
                    {t(`notificationTypes.${channel.notificationType}`)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">{t('fields.channelType')}</p>
                  <p className="text-base font-semibold text-text-primary">
                    {t(`channelTypes.${channel.channelType}`)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">{t('fields.enabled')}</p>
                  <p className={`text-sm font-medium ${channel.isEnabled ? 'text-green-600' : 'text-text-muted'}`}>
                    {channel.isEnabled ? t('states.enabled') : t('states.disabled')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">{t('fields.webhookUrl')}</p>
                  <p className="text-sm text-text-primary">{obfuscateWebhook(channel.webhookUrl)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">{t('fields.lastStatus')}</p>
                  <p className="text-sm text-text-primary">{channel.lastStatus || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">{t('fields.lastAttempt')}</p>
                  <p className="text-sm text-text-primary">{formatTimestamp(channel.lastAttemptedAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">{t('fields.failures')}</p>
                  <p className="text-sm text-text-primary">{channel.failureCount}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="sm" variant="outline" onClick={() => handleEdit(channel)}>
                  {t('actions.edit')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleChannelEnabled(channel)}>
                  {channel.isEnabled ? t('actions.disable') : t('actions.enable')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(channel)}>
                  {t('actions.delete')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => showLogs(channel.id)}>
                  {t('actions.viewLogs')}
                </Button>
              </div>

              {expandedId === channel.id && logs[channel.id] && (
                <div className="mt-4 bg-surface rounded-md border border-dashed border-border p-3">
                  <p className="text-sm font-semibold text-text-secondary">{t('actions.viewLogs')}</p>
                  {logs[channel.id].length === 0 ? (
                    <p className="text-sm text-text-muted">{t('messages.noLogs')}</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-text-secondary">
                      {logs[channel.id].map(entry => (
                        <li key={entry.id} className="flex justify-between">
                          <span>{entry.status} ({entry.attempt})</span>
                          <span>{formatTimestamp(entry.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="mt-2 text-sm text-text-muted">{t('messages.loading')}</div>
        )}
      </div>
    </div>
  )
}
