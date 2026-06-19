#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const jaPath = path.join(process.cwd(), 'messages/ja.json')
const enPath = path.join(process.cwd(), 'messages/en.json')

const loadJson = filePath => {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

const flattenKeys = (value, prefix = '') => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key
      return flattenKeys(child, nextPrefix)
    })
  }

  return prefix ? [prefix] : []
}

const ja = loadJson(jaPath)
const en = loadJson(enPath)

const jaKeys = new Set(flattenKeys(ja))
const enKeys = new Set(flattenKeys(en))

const KNOWN_MISSING_JA = new Set([
  'common.adminWelcome',
  'common.compliance.auditProgress',
  'common.compliance.certificationStatus',
  'common.compliance.completed',
  'common.compliance.correctiveActions',
  'common.compliance.expiryDate',
  'common.compliance.inProgress',
  'common.compliance.open',
  'common.compliance.title',
  'common.compliance.valid',
  'common.login.signupLink',
  'common.login.submitting',
  'common.login.subtitle',
  'common.login.title',
  'common.permissions.audit_delete',
  'common.permissions.audit_execute',
  'common.permissions.audit_read',
  'common.permissions.audit_write',
  'common.permissions.billing_read',
  'common.permissions.billing_write',
  'common.permissions.document_approve',
  'common.permissions.document_delete',
  'common.permissions.document_read',
  'common.permissions.document_write',
  'common.permissions.organization_read',
  'common.permissions.organization_write',
  'common.permissions.risk_approve',
  'common.permissions.risk_delete',
  'common.permissions.risk_read',
  'common.permissions.risk_write',
  'common.permissions.task_assign',
  'common.permissions.task_delete',
  'common.permissions.task_read',
  'common.permissions.task_write',
  'common.permissions.user_delete',
  'common.permissions.user_invite',
  'common.permissions.user_read',
  'common.permissions.user_write',
  'common.quickActions.addUser',
  'common.quickActions.organizationSettings',
  'common.quickActions.title',
  'common.quickActions.viewPendingApprovals',
  'common.recentActivity.documentApproved',
  'common.recentActivity.riskIdentified',
  'common.recentActivity.title',
  'common.recentActivity.userLogin',
  'common.stats.activeUsers',
  'common.stats.openRisks',
  'devLogin.permissionMatrix.history.empty',
  'notifications.clearAll',
  'notifications.empty',
  'notifications.markAllRead',
  'notifications.settingsPage.channels.app',
  'notifications.settingsPage.channels.email',
  'notifications.settingsPage.channels.title',
  'notifications.settingsPage.description',
  'notifications.settingsPage.save',
  'notifications.settingsPage.saved',
  'notifications.settingsPage.saving',
  'notifications.settingsPage.timing.reminderDays',
  'notifications.settingsPage.timing.title',
  'notifications.settingsPage.title',
  'notifications.settingsPage.types.auditSchedules',
  'notifications.settingsPage.types.documentApprovals',
  'notifications.settingsPage.types.riskAlerts',
  'notifications.settingsPage.types.taskReminders',
  'notifications.settingsPage.types.title',
  'notifications.type.audit_schedule',
  'notifications.type.document_approval',
  'notifications.type.info',
  'notifications.type.risk_alert',
  'notifications.type.system',
  'notifications.type.task_reminder',
  'settings.controls.actions.openWizard',
  'settings.controls.wizard.actions.apply',
  'settings.controls.wizard.actions.applying',
  'settings.controls.wizard.actions.cancel',
  'settings.controls.wizard.badges.existing',
  'settings.controls.wizard.description',
  'settings.controls.wizard.errors.loadFailed',
  'settings.controls.wizard.errors.seedFailed',
  'settings.controls.wizard.errors.selectOne',
  'settings.controls.wizard.messages.successInsert',
  'settings.controls.wizard.messages.successOverwrite',
  'settings.controls.wizard.modeSection.title',
  'settings.controls.wizard.modes.insert',
  'settings.controls.wizard.modes.overwrite',
  'settings.controls.wizard.modes.restore',
  'settings.controls.wizard.searchPlaceholder',
  'settings.controls.wizard.selectedLabel',
  'settings.controls.wizard.states.empty',
  'settings.controls.wizard.states.loading',
  'settings.controls.wizard.title'
])

const KNOWN_MISSING_EN = new Set([
  'home.controls.actions.openWizard',
  'home.controls.wizard.actions.apply',
  'home.controls.wizard.actions.applying',
  'home.controls.wizard.actions.cancel',
  'home.controls.wizard.badges.existing',
  'home.controls.wizard.description',
  'home.controls.wizard.errors.loadFailed',
  'home.controls.wizard.errors.seedFailed',
  'home.controls.wizard.errors.selectOne',
  'home.controls.wizard.messages.successInsert',
  'home.controls.wizard.messages.successOverwrite',
  'home.controls.wizard.modeSection.title',
  'home.controls.wizard.modes.insert',
  'home.controls.wizard.modes.overwrite',
  'home.controls.wizard.modes.restore',
  'home.controls.wizard.searchPlaceholder',
  'home.controls.wizard.selectedLabel',
  'home.controls.wizard.states.empty',
  'home.controls.wizard.states.loading',
  'home.controls.wizard.title',
  'home.onboardingChecklist.history.empty',
  'home.onboardingChecklist.history.manage',
  'home.onboardingChecklist.history.source.settings',
  'home.onboardingChecklist.history.source.system',
  'home.onboardingChecklist.history.source.wizard',
  'home.onboardingChecklist.history.subtitle',
  'home.onboardingChecklist.history.title',
  'settings.profile.personal.actions.saving',
  'settings.profile.personal.fields.fullName',
  'settings.profile.personal.fields.fullNameEn',
  'settings.profile.personal.fields.language'
])

const missingInJa = [...enKeys].filter(key => !jaKeys.has(key) && !KNOWN_MISSING_JA.has(key))
const missingInEn = [...jaKeys].filter(key => !enKeys.has(key) && !KNOWN_MISSING_EN.has(key))

const knownJaGaps = [...KNOWN_MISSING_JA].filter(key => !jaKeys.has(key))
const knownEnGaps = [...KNOWN_MISSING_EN].filter(key => !enKeys.has(key))

const report = () => {
  console.log('🧭 i18n parity check\n')
  if (knownJaGaps.length) {
    console.log('ℹ️  Known missing ja.json keys (tracked debt):')
    knownJaGaps.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }
  if (knownEnGaps.length) {
    console.log('ℹ️  Known missing en.json keys (tracked debt):')
    knownEnGaps.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }
  if (missingInJa.length === 0 && missingInEn.length === 0) {
    console.log('✅ en/ja message files contain the same key set (aside from the tracked debt above).')
    return true
  }

  if (missingInJa.length > 0) {
    console.log('❌ Keys missing in ja.json:')
    missingInJa.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }

  if (missingInEn.length > 0) {
    console.log('❌ Keys missing in en.json:')
    missingInEn.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }

  return false
}

const success = report()
process.exit(success ? 0 : 1)
