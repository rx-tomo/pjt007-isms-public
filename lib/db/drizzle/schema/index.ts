/**
 * Drizzle ORM Schema Index
 *
 * Exports all schema definitions for SQLite database.
 *
 * NOTE: SQLite does not support Row Level Security (RLS).
 * Organization-based data isolation MUST be enforced at the Repository layer
 * by always including organization_id in queries.
 */

// =========================================
// Organizations Schema
// =========================================
export {
  // Tables
  organizations,
  organizationIsmsScopes,
  organizationDepartments,
  projectRoles,
  projectAssignments,
  organizationPhaseHistory,
  organizationStructureSnapshots,
  // Relations
  organizationsRelations,
  organizationIsmsScopesRelations,
  organizationDepartmentsRelations,
  projectRolesRelations,
  projectAssignmentsRelations,
  organizationPhaseHistoryRelations,
  organizationStructureSnapshotsRelations,
  // Types
  type Organization,
  type OrganizationInsert,
  type OrganizationIsmsScope,
  type OrganizationIsmsScopeInsert,
  type OrganizationDepartment,
  type OrganizationDepartmentInsert,
  type ProjectRole,
  type ProjectRoleInsert,
  type ProjectAssignment,
  type ProjectAssignmentInsert,
  type OrganizationPhaseHistory,
  type OrganizationPhaseHistoryInsert,
  type OrganizationStructureSnapshot,
  type OrganizationStructureSnapshotInsert,
  // Enum values & types
  employeeCountRangeValues,
  type EmployeeCountRange,
  isoCertificationStatusValues,
  type IsoCertificationStatus,
  subscriptionPlanValues,
  type SubscriptionPlan,
  subscriptionStatusValues,
  type SubscriptionStatus,
  organizationDeletionStatusValues,
  type OrganizationDeletionStatus,
  ismsPhaseValues,
  type IsmsPhase,
  phaseHistorySourceValues,
  type PhaseHistorySource,
  // Helper functions
  parseJsonArray,
  stringifyJsonArray,
} from './organizations'

// =========================================
// Users Schema
// =========================================
export {
  // Tables
  userProfiles,
  userMemberships,
  organizationInvitations,
  userPermissionSets,
  userDepartmentScopes,
  // Relations
  userProfilesRelations,
  userMembershipsRelations,
  organizationInvitationsRelations,
  userPermissionSetsRelations,
  userDepartmentScopesRelations,
  // Types
  type UserProfile,
  type UserProfileInsert,
  type UserMembership,
  type UserMembershipInsert,
  type OrganizationInvitation,
  type OrganizationInvitationInsert,
  type UserPermissionSet,
  type UserPermissionSetInsert,
  type UserDepartmentScope,
  type UserDepartmentScopeInsert,
  // Enum values & types
  userRoleValues,
  type UserRole,
  languagePreferenceValues,
  type LanguagePreference,
  membershipStatusValues,
  type MembershipStatus,
  departmentScopeTypeValues,
  type DepartmentScopeType,
} from './users'

export {
  userPreferences,
  type UserPreference,
  type UserPreferenceInsert,
} from './user-preferences'

// =========================================
// AI Schema
// =========================================
export {
  // Tables
  aiSuggestions,
  aiUsageLogs,
  aiAlerts,
  // Types
  type AISuggestionRow,
  type AISuggestionInsert,
  type AIUsageLogRow,
  type AIUsageLogInsert,
  type AIAlertRow,
  type AIAlertInsert,
  // Enum values & types
  suggestionTypeValues,
  type SuggestionType,
  requestTypeValues,
  type RequestType,
  alertLevelValues,
  type AlertLevel,
} from './ai'

// =========================================
// Documents Schema
// =========================================
export {
  // Tables
  documents,
  documentFolders,
  documentVersions,
  documentTemplates,
  documentApprovals,
  // Relations
  documentsRelations,
  documentFoldersRelations,
  documentVersionsRelations,
  documentTemplatesRelations,
  documentApprovalsRelations,
  // Types
  type Document,
  type DocumentInsert,
  type DocumentFolder,
  type DocumentFolderInsert,
  type DocumentVersion,
  type DocumentVersionInsert,
  type DocumentTemplate,
  type DocumentTemplateInsert,
  type DocumentApproval,
  type DocumentApprovalInsert,
  // Enum values & types
  documentStatusValues,
  type DocumentStatus,
  documentTemplateCategoryValues,
  type DocumentTemplateCategory,
  documentApprovalStatusValues,
  type DocumentApprovalStatus,
} from './documents'

// =========================================
// Tasks Schema
// =========================================
export {
  // Tables
  tasks,
  taskCategories,
  taskComments,
  taskAttachments,
  taskTags,
  taskTagRelations,
  taskHistory,
  taskReminders,
  // Relations
  tasksRelations,
  taskCategoriesRelations,
  taskCommentsRelations,
  taskAttachmentsRelations,
  taskTagsRelations,
  taskTagRelationsRelations,
  taskHistoryRelations,
  taskRemindersRelations,
  // Types
  type Task,
  type TaskInsert,
  type TaskCategory,
  type TaskCategoryInsert,
  type TaskComment,
  type TaskCommentInsert,
  type TaskAttachment,
  type TaskAttachmentInsert,
  type TaskTag,
  type TaskTagInsert,
  type TaskTagRelation,
  type TaskTagRelationInsert,
  type TaskHistory,
  type TaskHistoryInsert,
  type TaskReminder,
  type TaskReminderInsert,
  // Enum values & types
  taskStatusValues,
  type TaskStatus,
  taskPriorityValues,
  type TaskPriority,
  taskReminderTypeValues,
  type TaskReminderType,
} from './tasks'

// =========================================
// Approvals Schema
// =========================================
export {
  // Tables
  approvalRequests,
  approvalEvents,
  approvalEscalationRules,
  // Relations
  approvalRequestsRelations,
  approvalEventsRelations,
  approvalEscalationRulesRelations,
  // Types
  type ApprovalRequest,
  type ApprovalRequestInsert,
  type ApprovalEvent,
  type ApprovalEventInsert,
  type ApprovalEscalationRule,
  type ApprovalEscalationRuleInsert,
  // Enum values & types
  approvalResourceTypeValues,
  type ApprovalResourceType,
  approvalRequestStatusValues,
  type ApprovalRequestStatus,
  approvalEventTypeValues,
  type ApprovalEventType,
  escalationTargetTypeValues,
  type EscalationTargetType,
} from './approvals'

// =========================================
// Risks Schema
// =========================================
export {
  // Tables
  riskCategories,
  riskCriteria,
  risks,
  riskTreatments,
  riskAssessmentHistory,
  informationAssets,
  riskAssets,
  informationAssetImportJobs,
  informationAssetImportRows,
  isoControls,
  soaVersions,
  riskControlLinks,
  controlTemplates,
  // Relations
  riskCategoriesRelations,
  riskCriteriaRelations,
  risksRelations,
  riskTreatmentsRelations,
  riskAssessmentHistoryRelations,
  informationAssetsRelations,
  riskAssetsRelations,
  informationAssetImportJobsRelations,
  informationAssetImportRowsRelations,
  isoControlsRelations,
  soaVersionsRelations,
  riskControlLinksRelations,
  controlTemplatesRelations,
  // Types
  type RiskCategory,
  type RiskCategoryInsert,
  type RiskCriterion,
  type RiskCriterionInsert,
  type Risk,
  type RiskInsert,
  type RiskTreatment,
  type RiskTreatmentInsert,
  type RiskAssessmentHistory,
  type RiskAssessmentHistoryInsert,
  type InformationAsset,
  type InformationAssetInsert,
  type RiskAsset,
  type RiskAssetInsert,
  type InformationAssetImportJob,
  type InformationAssetImportJobInsert,
  type InformationAssetImportRow,
  type InformationAssetImportRowInsert,
  type IsoControl,
  type IsoControlInsert,
  type SoaVersion,
  type SoaVersionInsert,
  type RiskControlLink,
  type RiskControlLinkInsert,
  type ControlTemplate,
  type ControlTemplateInsert,
  // Enum values & types
  riskCriteriaTypeValues,
  type RiskCriteriaType,
  riskStatusValues,
  type RiskStatus,
  treatmentTypeValues,
  type TreatmentType,
  treatmentStatusValues,
  type TreatmentStatus,
  assetTypeValues,
  type AssetType,
  classificationValues,
  type Classification,
  criticalityValues,
  type Criticality,
  assetStatusValues,
  type AssetStatus,
  importJobStatusValues,
  type ImportJobStatus,
  importModeValues,
  type ImportMode,
  importRowStatusValues,
  type ImportRowStatus,
} from './risks'

// =========================================
// Audit Schema
// =========================================
export {
  // Tables
  iso27001Requirements,
  auditUnits,
  auditPlans,
  auditTeamMembers,
  auditChecklists,
  nonconformities,
  correctiveActions,
  auditReports,
  auditEvidence,
  followUpRecords,
  // Relations
  iso27001RequirementsRelations,
  auditUnitsRelations,
  auditPlansRelations,
  auditTeamMembersRelations,
  auditChecklistsRelations,
  nonconformitiesRelations,
  correctiveActionsRelations,
  auditReportsRelations,
  auditEvidenceRelations,
  followUpRecordsRelations,
  // Types
  type Iso27001Requirement,
  type Iso27001RequirementInsert,
  type AuditUnit,
  type AuditUnitInsert,
  type AuditPlan,
  type AuditPlanInsert,
  type AuditTeamMember,
  type AuditTeamMemberInsert,
  type AuditChecklist,
  type AuditChecklistInsert,
  type Nonconformity,
  type NonconformityInsert,
  type CorrectiveAction,
  type CorrectiveActionInsert,
  type AuditReport,
  type AuditReportInsert,
  type AuditEvidenceRow,
  type AuditEvidenceInsert,
  type FollowUpRecord,
  type FollowUpRecordInsert,
  // Enum values & types
  auditTypeValues,
  type AuditType,
  auditPlanStatusValues,
  type AuditPlanStatus,
  auditTeamRoleValues,
  type AuditTeamRole,
  checklistStatusValues,
  type ChecklistStatus,
  checklistResultValues,
  type ChecklistResult,
  nonconformityTypeValues,
  type NonconformityType,
  nonconformityStatusValues,
  type NonconformityStatus,
  correctiveActionStatusValues,
  type CorrectiveActionStatus,
  followUpStatusValues,
  type FollowUpStatus,
  auditUnitTypeValues,
  type AuditUnitType,
  reportApprovalStatusValues,
  type ReportApprovalStatus,
} from './audit'

// =========================================
// Billing Schema
// =========================================
export {
  // Tables
  pricingPlans,
  subscriptions,
  paymentHistory,
  billingInfo,
  usageTracking,
  stripeEvents,
  // Relations
  pricingPlansRelations,
  subscriptionsRelations,
  paymentHistoryRelations,
  billingInfoRelations,
  usageTrackingRelations,
  // Types
  type PricingPlan,
  type PricingPlanInsert,
  type Subscription,
  type SubscriptionInsert,
  type PaymentHistoryRow,
  type PaymentHistoryInsert,
  type BillingInfo,
  type BillingInfoInsert,
  type UsageTrackingRow,
  type UsageTrackingInsert,
  type StripeEventRow,
  type StripeEventInsert,
  // Enum values & types
  subscriptionStripeStatusValues,
  type SubscriptionStripeStatus,
  paymentStatusValues,
  type PaymentStatus,
  usageMetricTypeValues,
  type UsageMetricType,
} from './billing'

// =========================================
// Commercial Offboarding Schema
// =========================================
export {
  organizationDeletionRequests,
  organizationDeletionRuns,
  organizationDeletionRequestsRelations,
  organizationDeletionRunsRelations,
  type OrganizationDeletionRequest,
  type OrganizationDeletionRequestInsert,
  type OrganizationDeletionRun,
  type OrganizationDeletionRunInsert,
  deletionRequestStatusValues,
  type DeletionRequestStatus,
  deletionRequestSourceValues,
  type DeletionRequestSource,
  deletionRunResultValues,
  type DeletionRunResult,
} from './offboarding'

// =========================================
// Notifications Schema
// =========================================
export {
  // Tables
  notifications,
  notificationPreferences,
  emailLogs,
  organizationNotificationChannels,
  organizationNotificationChannelLogs,
  // Relations
  notificationsRelations,
  notificationPreferencesRelations,
  emailLogsRelations,
  organizationNotificationChannelsRelations,
  organizationNotificationChannelLogsRelations,
  // Types
  type Notification,
  type NotificationInsert,
  type NotificationPreference,
  type NotificationPreferenceInsert,
  type EmailLog,
  type EmailLogInsert,
  type OrganizationNotificationChannel,
  type OrganizationNotificationChannelInsert,
  type OrganizationNotificationChannelLog,
  type OrganizationNotificationChannelLogInsert,
  // Enum values & types
  notificationTypeValues,
  type NotificationType,
  notificationPriorityValues,
  type NotificationPriority,
  notificationStatusValues,
  type NotificationStatus,
  emailLogStatusValues,
  type EmailLogStatus,
  notificationChannelTypeValues,
  type NotificationChannelType,
  channelLogStatusValues,
  type ChannelLogStatus,
} from './notifications'

// =========================================
// Audit Logs Schema
// =========================================
export {
  // Tables
  auditLogs,
  // Relations
  auditLogsRelations,
  // Types
  type AuditLog,
  type AuditLogInsert,
  // Enum values & types
  auditLogScopeValues,
  type AuditLogScope,
} from './audit-logs'

// =========================================
// Incidents Schema
// =========================================
export {
  // Tables
  incidents,
  incidentUpdates,
  incidentLinks,
  // Relations
  incidentsRelations,
  incidentUpdatesRelations,
  incidentLinksRelations,
  // Types
  type Incident,
  type IncidentInsert,
  type IncidentUpdate,
  type IncidentUpdateInsert,
  type IncidentLink,
  type IncidentLinkInsert,
  // Enum values & types
  incidentSeverityValues,
  type IncidentSeverity,
  incidentStatusValues,
  type IncidentStatus,
  incidentUpdateTypeValues,
  type IncidentUpdateType,
  incidentLinkTypeValues,
  type IncidentLinkType,
} from './incidents'

// =========================================
// Education Schema
// =========================================
export {
  // Tables
  educationPlans,
  educationRecords,
  educationMaterials,
  educationPlanMaterials,
  // Relations
  educationPlansRelations,
  educationRecordsRelations,
  educationMaterialsRelations,
  educationPlanMaterialsRelations,
  // Types
  type EducationPlan,
  type EducationPlanInsert,
  type EducationRecord,
  type EducationRecordInsert,
  type EducationMaterial,
  type EducationMaterialInsert,
  type EducationPlanMaterial,
  type EducationPlanMaterialInsert,
  // Enum values & types
  educationPlanStatusValues,
  type EducationPlanStatus,
  educationRecordResultValues,
  type EducationRecordResult,
  educationMaterialTypeValues,
  type EducationMaterialType,
} from './education'

// =========================================
// BCP Schema
// =========================================
export {
  // Tables
  bcpPlans,
  bcpScenarios,
  bcpDrills,
  bcpRecoveryObjectives,
  // Relations
  bcpPlansRelations,
  bcpScenariosRelations,
  bcpDrillsRelations,
  bcpRecoveryObjectivesRelations,
  // Types
  type BcpPlan,
  type BcpPlanInsert,
  type BcpScenario,
  type BcpScenarioInsert,
  type BcpDrill,
  type BcpDrillInsert,
  type BcpRecoveryObjective,
  type BcpRecoveryObjectiveInsert,
  // Enum values & types
  bcpPlanStatusValues,
  type BcpPlanStatus,
  bcpScenarioTypeValues,
  type BcpScenarioType,
  bcpImpactLevelValues,
  type BcpImpactLevel,
  bcpLikelihoodValues,
  type BcpLikelihood,
  bcpDrillStatusValues,
  type BcpDrillStatus,
  bcpPriorityValues,
  type BcpPriority,
} from './bcp'

// =========================================
// Suppliers Schema
// =========================================
export {
  // Tables
  suppliers,
  supplierAssessments,
  supplierContracts,
  supplierIncidents,
  // Relations
  suppliersRelations,
  supplierAssessmentsRelations,
  supplierContractsRelations,
  supplierIncidentsRelations,
  // Types
  type Supplier,
  type SupplierInsert,
  type SupplierAssessment,
  type SupplierAssessmentInsert,
  type SupplierContract,
  type SupplierContractInsert,
  type SupplierIncident,
  type SupplierIncidentInsert,
  // Enum values & types
  supplierTypeValues,
  type SupplierType,
  supplierStatusValues,
  type SupplierStatus,
  supplierRiskLevelValues,
  type SupplierRiskLevel,
  supplierAssessmentResultValues,
  type SupplierAssessmentResult,
  supplierContractStatusValues,
  type SupplierContractStatus,
  supplierIncidentSeverityValues,
  type SupplierIncidentSeverity,
  supplierIncidentStatusValues,
  type SupplierIncidentStatus,
} from './suppliers'

// =========================================
// Auth Schema (Better Auth)
// =========================================
export {
  // Tables
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
  // Relations
  authUsersRelations,
  authSessionsRelations,
  authAccountsRelations,
  // Types
  type AuthUser,
  type AuthUserInsert,
  type AuthSession,
  type AuthSessionInsert,
  type AuthAccount,
  type AuthAccountInsert,
  type AuthVerification,
  type AuthVerificationInsert,
} from './auth'

export {
  // Two-factor tables
  twoFactor,
  twoFactorRelations,
  // Types
  type TwoFactor,
  type TwoFactorInsert,
} from './auth-two-factor'

// =========================================
// Management Reviews Schema
// =========================================
export {
  // Tables
  managementReviews,
  managementReviewItems,
  managementReviewActions,
  // Relations
  managementReviewsRelations,
  managementReviewItemsRelations,
  managementReviewActionsRelations,
  // Types
  type ManagementReview,
  type ManagementReviewInsert,
  type ManagementReviewItem,
  type ManagementReviewItemInsert,
  type ManagementReviewAction,
  type ManagementReviewActionInsert,
  // Enum values & types
  managementReviewStatusValues,
  type ManagementReviewStatus,
  reviewItemTypeValues,
  type ReviewItemType,
  reviewActionStatusValues,
  type ReviewActionStatus,
} from './management-reviews'

// =========================================
// Combined schema for Drizzle instance
// =========================================
import * as organizationsSchema from './organizations'
import * as usersSchema from './users'
import * as aiSchema from './ai'
import * as documentsSchema from './documents'
import * as tasksSchema from './tasks'
import * as approvalsSchema from './approvals'
import * as risksSchema from './risks'
import * as auditSchema from './audit'
import * as auditLogsSchema from './audit-logs'
import * as billingSchema from './billing'
import * as offboardingSchema from './offboarding'
import * as notificationsSchema from './notifications'
import * as incidentsSchema from './incidents'
import * as educationSchema from './education'
import * as bcpSchema from './bcp'
import * as authSchema from './auth'
import * as authTwoFactorSchema from './auth-two-factor'
import * as suppliersSchema from './suppliers'
import * as managementReviewsSchema from './management-reviews'

export const schema = {
  ...organizationsSchema,
  ...usersSchema,
  ...aiSchema,
  ...documentsSchema,
  ...tasksSchema,
  ...approvalsSchema,
  ...risksSchema,
  ...auditSchema,
  ...auditLogsSchema,
  ...billingSchema,
  ...offboardingSchema,
  ...notificationsSchema,
  ...incidentsSchema,
  ...educationSchema,
  ...bcpSchema,
  ...authSchema,
  ...authTwoFactorSchema,
  ...suppliersSchema,
  ...managementReviewsSchema,
}
