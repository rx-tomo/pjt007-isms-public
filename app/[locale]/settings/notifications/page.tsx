'use client'

import { useState, useEffect, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { NotificationService, type NotificationPreferences } from '@/lib/services/notification'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'

export default function NotificationSettingsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.notifications')
  const tCommon = useTranslations('common')
  const { user } = useAuth()
  const router = useRouter()
  const { pushToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)

  const loadPreferences = useCallback(async () => {
    if (!user) return

    setLoading(true)
    const data = await NotificationService.getPreferences(user.id)
    if (data) {
      setPreferences(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const handleSave = async () => {
    if (!user || !preferences) return

    setSaving(true)
    const result = await NotificationService.updatePreferences(user.id, {
      email_enabled: preferences.email_enabled,
      app_enabled: preferences.app_enabled,
      task_reminders: preferences.task_reminders,
      document_approvals: preferences.document_approvals,
      audit_schedules: preferences.audit_schedules,
      risk_alerts: preferences.risk_alerts,
      reminder_days_before: preferences.reminder_days_before
    })

    setSaving(false)

    if (result) {
      pushToast({ message: t('savedSuccessfully'), variant: 'success' })
    }
  }

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      [key]: !preferences[key]
    })
  }

  const handleDaysChange = (days: number) => {
    if (!preferences || days < 1 || days > 30) return
    setPreferences({
      ...preferences,
      reminder_days_before: days
    })
  }

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">{t('title')}</h1>
        <p className="settings-description">{t('description')}</p>
      </div>

      {preferences && (
        <div className="settings-content">
          {/* 基本設定 */}
          <section className="settings-section">
            <h2 className="section-title">{t('generalSettings')}</h2>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('emailNotifications')}</h3>
                <p className="setting-description">{t('emailNotificationsDesc')}</p>
              </div>
              <button
                onClick={() => handleToggle('email_enabled')}
                className={`toggle-button ${preferences.email_enabled ? 'active' : ''}`}
                aria-pressed={preferences.email_enabled}
              >
                <span className="toggle-switch"></span>
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('appNotifications')}</h3>
                <p className="setting-description">{t('appNotificationsDesc')}</p>
              </div>
              <button
                onClick={() => handleToggle('app_enabled')}
                className={`toggle-button ${preferences.app_enabled ? 'active' : ''}`}
                aria-pressed={preferences.app_enabled}
              >
                <span className="toggle-switch"></span>
              </button>
            </div>
          </section>

          {/* 通知種別設定 */}
          <section className="settings-section">
            <h2 className="section-title">{t('notificationTypes')}</h2>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('taskReminders')}</h3>
                <p className="setting-description">{t('taskRemindersDesc')}</p>
              </div>
              <button
                onClick={() => handleToggle('task_reminders')}
                className={`toggle-button ${preferences.task_reminders ? 'active' : ''}`}
                aria-pressed={preferences.task_reminders}
                disabled={!preferences.email_enabled && !preferences.app_enabled}
              >
                <span className="toggle-switch"></span>
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('documentApprovals')}</h3>
                <p className="setting-description">{t('documentApprovalsDesc')}</p>
              </div>
              <button
                onClick={() => handleToggle('document_approvals')}
                className={`toggle-button ${preferences.document_approvals ? 'active' : ''}`}
                aria-pressed={preferences.document_approvals}
                disabled={!preferences.email_enabled && !preferences.app_enabled}
              >
                <span className="toggle-switch"></span>
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('auditSchedules')}</h3>
                <p className="setting-description">{t('auditSchedulesDesc')}</p>
              </div>
              <button
                onClick={() => handleToggle('audit_schedules')}
                className={`toggle-button ${preferences.audit_schedules ? 'active' : ''}`}
                aria-pressed={preferences.audit_schedules}
                disabled={!preferences.email_enabled && !preferences.app_enabled}
              >
                <span className="toggle-switch"></span>
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('riskAlerts')}</h3>
                <p className="setting-description">{t('riskAlertsDesc')}</p>
              </div>
              <button
                onClick={() => handleToggle('risk_alerts')}
                className={`toggle-button ${preferences.risk_alerts ? 'active' : ''}`}
                aria-pressed={preferences.risk_alerts}
                disabled={!preferences.email_enabled && !preferences.app_enabled}
              >
                <span className="toggle-switch"></span>
              </button>
            </div>
          </section>

          {/* タイミング設定 */}
          <section className="settings-section">
            <h2 className="section-title">{t('timingSettings')}</h2>

            <div className="setting-item">
              <div className="setting-info">
                <h3 className="setting-label">{t('reminderDays')}</h3>
                <p className="setting-description">{t('reminderDaysDesc')}</p>
              </div>
              <div className="number-input">
                <button
                  onClick={() => handleDaysChange(preferences.reminder_days_before - 1)}
                  className="number-button"
                  disabled={preferences.reminder_days_before <= 1}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  value={preferences.reminder_days_before}
                  onChange={(e) => handleDaysChange(parseInt(e.target.value))}
                  className="number-value"
                  min="1"
                  max="30"
                />
                <button
                  onClick={() => handleDaysChange(preferences.reminder_days_before + 1)}
                  className="number-button"
                  disabled={preferences.reminder_days_before >= 30}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          {/* アクションボタン */}
          <div className="settings-actions">
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/settings`)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </div>
      )}

      <style jsx>{`
        .settings-container {
          max-width: 800px;
          margin: 0 auto;
          padding: var(--spacing-8);
        }

        .settings-header {
          margin-bottom: var(--spacing-8);
        }

        .settings-title {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--foreground);
          margin-bottom: var(--spacing-2);
        }

        .settings-description {
          color: var(--muted-foreground);
          font-size: var(--font-size-base);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-4);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color);
          border-top-color: var(--primary);
          border-radius: var(--radius-full);
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .settings-content {
          background-color: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .settings-section {
          padding: var(--spacing-6);
          border-bottom: 1px solid var(--border-color);
        }

        .settings-section:last-of-type {
          border-bottom: none;
        }

        .section-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: var(--spacing-4);
        }

        .setting-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-4) 0;
        }

        .setting-item:not(:last-child) {
          border-bottom: 1px solid var(--muted);
        }

        .setting-info {
          flex: 1;
          margin-right: var(--spacing-4);
        }

        .setting-label {
          font-size: var(--font-size-base);
          font-weight: 500;
          color: var(--foreground);
          margin-bottom: var(--spacing-1);
        }

        .setting-description {
          font-size: var(--font-size-sm);
          color: var(--muted-foreground);
        }

        .toggle-button {
          position: relative;
          width: 44px;
          height: 24px;
          background-color: var(--muted);
          border: none;
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: background-color 200ms ease;
        }

        .toggle-button.active {
          background-color: var(--primary);
        }

        .toggle-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-switch {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background-color: white;
          border-radius: var(--radius-full);
          transition: transform 200ms ease;
          box-shadow: var(--shadow-sm);
        }

        .toggle-button.active .toggle-switch {
          transform: translateX(20px);
        }

        .number-input {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .number-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background-color: var(--muted);
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background-color 200ms ease;
        }

        .number-button:hover:not(:disabled) {
          background-color: var(--primary);
          color: var(--primary-foreground);
        }

        .number-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .number-value {
          width: 60px;
          padding: var(--spacing-2);
          text-align: center;
          background-color: var(--background);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--font-size-base);
          color: var(--foreground);
        }

        .settings-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-3);
          padding: var(--spacing-6);
          background-color: var(--muted);
        }

        @media (max-width: 640px) {
          .settings-container {
            padding: var(--spacing-4);
          }

          .setting-item {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-3);
          }

          .setting-info {
            margin-right: 0;
          }

          .settings-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </div>
  )
}