CREATE TABLE `ai_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`threshold` real NOT NULL,
	`current_usage` integer NOT NULL,
	`limit_value` integer NOT NULL,
	`percentage` real NOT NULL,
	`alert_level` text NOT NULL,
	`message` text NOT NULL,
	`message_ja` text NOT NULL,
	`month` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_alerts_org` ON `ai_alerts` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_alerts_month` ON `ai_alerts` (`organization_id`,`month`);--> statement-breakpoint
CREATE TABLE `ai_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`risk_id` text,
	`suggestion_type` text NOT NULL,
	`input_context` text NOT NULL,
	`suggestion_content` text NOT NULL,
	`accepted` integer,
	`accepted_at` text,
	`accepted_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_suggestions_org` ON `ai_suggestions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_suggestions_risk` ON `ai_suggestions` (`risk_id`);--> statement-breakpoint
CREATE TABLE `ai_usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`provider` text NOT NULL,
	`request_type` text NOT NULL,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cached` integer,
	`latency_ms` integer,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_logs_org` ON `ai_usage_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_logs_user` ON `ai_usage_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_logs_created` ON `ai_usage_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `approval_escalation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`escalation_target_type` text NOT NULL,
	`escalation_user_id` text,
	`escalation_role_flag` text,
	`cc_role_flags` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`escalation_user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approval_escalation_rules_org_resource_unique` ON `approval_escalation_rules` (`organization_id`,`resource_type`);--> statement-breakpoint
CREATE INDEX `idx_approval_escalation_rules_org` ON `approval_escalation_rules` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_approval_escalation_rules_type` ON `approval_escalation_rules` (`resource_type`);--> statement-breakpoint
CREATE TABLE `approval_events` (
	`id` text PRIMARY KEY NOT NULL,
	`approval_request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_approval_events_request_id` ON `approval_events` (`approval_request_id`);--> statement-breakpoint
CREATE INDEX `idx_approval_events_created_at` ON `approval_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text,
	`requested_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`approver_id` text,
	`approved_at` text,
	`rejection_reason` text,
	`due_at` text,
	`notified_at` text,
	`escalation_notified_at` text,
	`step_number` integer,
	`reverted_at` text,
	`revert_reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approver_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_approval_requests_org_status` ON `approval_requests` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_resource` ON `approval_requests` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_due_at` ON `approval_requests` (`due_at`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_resource_step` ON `approval_requests` (`resource_type`,`resource_id`,`step_number`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_reverted_at` ON `approval_requests` (`reverted_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`changes` text,
	`ip_address` text,
	`user_agent` text,
	`scope` text DEFAULT 'tenant' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_organization_id` ON `audit_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user_id` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_resource` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_scope` ON `audit_logs` (`scope`);--> statement-breakpoint
CREATE TABLE `audit_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_plan_id` text,
	`requirement_id` text,
	`check_item` text NOT NULL,
	`evidence_required` text,
	`auditor_id` text,
	`status` text DEFAULT 'not_started',
	`result` text,
	`findings` text,
	`evidence_provided` text,
	`reviewed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`audit_plan_id`) REFERENCES `audit_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requirement_id`) REFERENCES `iso27001_requirements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auditor_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_checklists_audit_plan_id` ON `audit_checklists` (`audit_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_checklists_requirement_id` ON `audit_checklists` (`requirement_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_checklists_status` ON `audit_checklists` (`status`);--> statement-breakpoint
CREATE TABLE `audit_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_checklist_id` text,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`description` text,
	`uploaded_by` text,
	`uploaded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`audit_checklist_id`) REFERENCES `audit_checklists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_evidence_audit_checklist_id` ON `audit_evidence` (`audit_checklist_id`);--> statement-breakpoint
CREATE TABLE `audit_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`title` text NOT NULL,
	`description` text,
	`audit_type` text,
	`standard` text DEFAULT 'ISO27001',
	`planned_start_date` text,
	`planned_end_date` text,
	`actual_start_date` text,
	`actual_end_date` text,
	`lead_auditor_id` text,
	`status` text DEFAULT 'planning',
	`audit_period` text,
	`audited_unit_id` text,
	`auditor_signature` text,
	`auditor_signed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_auditor_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audited_unit_id`) REFERENCES `audit_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_plans_organization_id` ON `audit_plans` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_plans_status` ON `audit_plans` (`status`);--> statement-breakpoint
CREATE INDEX `idx_audit_plans_audit_period` ON `audit_plans` (`audit_period`);--> statement-breakpoint
CREATE INDEX `idx_audit_plans_audited_unit_id` ON `audit_plans` (`audited_unit_id`);--> statement-breakpoint
CREATE TABLE `audit_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_plan_id` text,
	`executive_summary` text,
	`scope` text,
	`methodology` text,
	`positive_findings` text,
	`improvement_opportunities` text,
	`conclusion` text,
	`report_date` text,
	`approved_by` text,
	`approved_at` text,
	`approval_status` text DEFAULT 'draft' NOT NULL,
	`rejection_reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`audit_plan_id`) REFERENCES `audit_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_reports_audit_plan_id` ON `audit_reports` (`audit_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_reports_approval_status` ON `audit_reports` (`approval_status`);--> statement-breakpoint
CREATE TABLE `audit_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_plan_id` text,
	`user_id` text,
	`role` text,
	`assigned_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`audit_plan_id`) REFERENCES `audit_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_team_members_plan` ON `audit_team_members` (`audit_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_team_members_user` ON `audit_team_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_units` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`unit_type` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_units_org_name_unique` ON `audit_units` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_audit_units_organization_id` ON `audit_units` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_units_unit_type` ON `audit_units` (`unit_type`);--> statement-breakpoint
CREATE TABLE `corrective_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`nonconformity_id` text,
	`action_description` text NOT NULL,
	`responsible_id` text,
	`planned_date` text,
	`completion_date` text,
	`status` text DEFAULT 'planned',
	`effectiveness_review` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`nonconformity_id`) REFERENCES `nonconformities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responsible_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_corrective_actions_nonconformity_id` ON `corrective_actions` (`nonconformity_id`);--> statement-breakpoint
CREATE TABLE `follow_up_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`audit_plan_id` text NOT NULL,
	`nonconformity_id` text,
	`title` text NOT NULL,
	`description` text,
	`assigned_to` text,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` text,
	`completed_at` text,
	`verified_at` text,
	`verified_by` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audit_plan_id`) REFERENCES `audit_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nonconformity_id`) REFERENCES `nonconformities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_follow_up_records_org` ON `follow_up_records` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_follow_up_records_plan` ON `follow_up_records` (`audit_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_follow_up_records_status` ON `follow_up_records` (`status`);--> statement-breakpoint
CREATE TABLE `iso27001_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`clause_number` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`parent_id` text,
	`is_applicable` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE `nonconformities` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_checklist_id` text,
	`nc_number` text NOT NULL,
	`type` text,
	`description` text NOT NULL,
	`root_cause` text,
	`corrective_action` text,
	`preventive_action` text,
	`responsible_id` text,
	`due_date` text,
	`status` text DEFAULT 'open',
	`resolution_date` text,
	`verification_date` text,
	`verified_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`audit_checklist_id`) REFERENCES `audit_checklists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responsible_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nonconformities_nc_number_unique` ON `nonconformities` (`nc_number`);--> statement-breakpoint
CREATE INDEX `idx_nonconformities_audit_checklist_id` ON `nonconformities` (`audit_checklist_id`);--> statement-breakpoint
CREATE INDEX `idx_nonconformities_status` ON `nonconformities` (`status`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`idToken` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_userId` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`activeOrganizationId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_userId` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `billing_info` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`company_name` text,
	`company_name_kana` text,
	`postal_code` text,
	`prefecture` text,
	`city` text,
	`address_line1` text,
	`address_line2` text,
	`phone` text,
	`tax_id` text,
	`billing_email` text,
	`billing_contact_name` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_info_organization_id_unique` ON `billing_info` (`organization_id`);--> statement-breakpoint
CREATE TABLE `payment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`subscription_id` text,
	`stripe_payment_intent_id` text,
	`stripe_invoice_id` text,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'JPY',
	`status` text,
	`description` text,
	`payment_method_type` text,
	`paid_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_history_stripe_invoice_id_unique` ON `payment_history` (`stripe_invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_history_organization_id` ON `payment_history` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_history_subscription_id` ON `payment_history` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `pricing_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_monthly` integer NOT NULL,
	`stripe_price_id` text,
	`features` text,
	`max_users` integer,
	`max_storage_gb` integer,
	`is_active` integer DEFAULT true,
	`display_order` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_data` text,
	`processed` integer DEFAULT false,
	`error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_events_stripe_event_id_unique` ON `stripe_events` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `idx_stripe_events_stripe_event_id` ON `stripe_events` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `idx_stripe_events_processed` ON `stripe_events` (`processed`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`pricing_plan_id` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`status` text,
	`current_period_start` text,
	`current_period_end` text,
	`trial_start` text,
	`trial_end` text,
	`cancel_at` text,
	`canceled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pricing_plan_id`) REFERENCES `pricing_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_id_unique` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_organization_id` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_stripe_subscription_id` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `usage_tracking` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`metric_type` text,
	`current_value` integer DEFAULT 0,
	`limit_value` integer,
	`measured_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`step` integer NOT NULL,
	`approver_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`comment` text,
	`acted_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_approvals_unique_step` ON `document_approvals` (`document_id`,`step`);--> statement-breakpoint
CREATE INDEX `idx_document_approvals_document` ON `document_approvals` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_document_approvals_approver` ON `document_approvals` (`approver_id`);--> statement-breakpoint
CREATE TABLE `document_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`path` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_document_folders_organization` ON `document_folders` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_document_folders_parent` ON `document_folders` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_document_folders_path` ON `document_folders` (`path`);--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`iso_reference` text,
	`content_template` text NOT NULL,
	`language` text DEFAULT 'ja',
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`file_name` text,
	`file_path` text,
	`file_size` integer,
	`changes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_document_versions_document` ON `document_versions` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_document_versions_created_at` ON `document_versions` (`created_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`file_name` text,
	`file_path` text,
	`file_size` integer,
	`mime_type` text,
	`version_number` integer DEFAULT 1,
	`status` text DEFAULT 'draft',
	`category` text,
	`tags` text DEFAULT '[]',
	`folder_id` text,
	`created_by` text NOT NULL,
	`updated_by` text,
	`approved_by` text,
	`approved_at` text,
	`retention_delete_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `document_folders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_organization` ON `documents` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_status` ON `documents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_documents_category` ON `documents` (`category`);--> statement-breakpoint
CREATE INDEX `idx_documents_created_at` ON `documents` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_folder` ON `documents` (`folder_id`);--> statement-breakpoint
CREATE TABLE `incident_links` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`link_type` text NOT NULL,
	`link_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_incident_links_unique` ON `incident_links` (`incident_id`,`link_type`,`link_id`);--> statement-breakpoint
CREATE INDEX `idx_incident_links_incident_id` ON `incident_links` (`incident_id`);--> statement-breakpoint
CREATE TABLE `incident_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`update_type` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_incident_updates_incident_id` ON `incident_updates` (`incident_id`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`occurred_at` text NOT NULL,
	`detected_at` text,
	`severity` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`department_id` text,
	`reporter_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_incidents_organization_id` ON `incidents` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_incidents_occurred_at` ON `incidents` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_incidents_status` ON `incidents` (`status`);--> statement-breakpoint
CREATE TABLE `control_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`template_key` text NOT NULL,
	`locale` text DEFAULT 'ja' NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`control_code` text,
	`annex_reference` text,
	`default_tags` text DEFAULT '[]',
	`is_default_selected` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_templates_key_locale_unique` ON `control_templates` (`template_key`,`locale`);--> statement-breakpoint
CREATE INDEX `idx_control_templates_locale` ON `control_templates` (`locale`);--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text,
	`user_id` text NOT NULL,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`sent_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_email_logs_notification_id` ON `email_logs` (`notification_id`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_status` ON `email_logs` (`status`);--> statement-breakpoint
CREATE TABLE `information_asset_import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by` text,
	`original_filename` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`mode` text DEFAULT 'insert' NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`error_summary` text,
	`backup_snapshot` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_information_asset_import_jobs_org` ON `information_asset_import_jobs` (`organization_id`);--> statement-breakpoint
CREATE TABLE `information_asset_import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`raw_data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text,
	`asset_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `information_asset_import_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `information_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_information_asset_import_rows_job` ON `information_asset_import_rows` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_information_asset_import_rows_status` ON `information_asset_import_rows` (`status`);--> statement-breakpoint
CREATE TABLE `information_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`asset_type` text DEFAULT 'data',
	`classification` text DEFAULT 'internal',
	`criticality` text DEFAULT 'medium',
	`owner_id` text,
	`location` text,
	`status` text DEFAULT 'in_use',
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_information_assets_org` ON `information_assets` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_information_assets_owner` ON `information_assets` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_information_assets_status` ON `information_assets` (`status`);--> statement-breakpoint
CREATE TABLE `iso_controls` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`control_code` text,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text DEFAULT '[]',
	`template_key` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_iso_controls_org_code` ON `iso_controls` (`organization_id`,`control_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_iso_controls_org_template_key` ON `iso_controls` (`organization_id`,`template_key`);--> statement-breakpoint
CREATE INDEX `idx_iso_controls_org_category` ON `iso_controls` (`organization_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_iso_controls_org_title` ON `iso_controls` (`organization_id`,`title`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`app_enabled` integer DEFAULT true NOT NULL,
	`task_reminders` integer DEFAULT true NOT NULL,
	`document_approvals` integer DEFAULT true NOT NULL,
	`audit_schedules` integer DEFAULT true NOT NULL,
	`risk_alerts` integer DEFAULT true NOT NULL,
	`reminder_days_before` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_id_unique` ON `notification_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_preferences_user_id` ON `notification_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`link` text,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`read_at` text,
	`archived_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_status` ON `notifications` (`status`);--> statement-breakpoint
CREATE INDEX `idx_notifications_created_at` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_org_id` ON `notifications` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organization_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`parent_department_id` text,
	`manager` text,
	`description` text,
	`member_count` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_organization_departments_org` ON `organization_departments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_organization_departments_parent` ON `organization_departments` (`parent_department_id`);--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invitations_token_unique` ON `organization_invitations` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_pending_invitation` ON `organization_invitations` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_invitations_token` ON `organization_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invitations_email` ON `organization_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_invitations_expires_at` ON `organization_invitations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `organization_isms_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`physical_locations` text DEFAULT '[]' NOT NULL,
	`it_systems` text DEFAULT '[]' NOT NULL,
	`departments` text DEFAULT '[]' NOT NULL,
	`processes` text DEFAULT '[]' NOT NULL,
	`exclusions` text DEFAULT '[]' NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_isms_scopes_unique_org` ON `organization_isms_scopes` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_organization_isms_scopes_org` ON `organization_isms_scopes` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organization_notification_channel_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`notification_id` text,
	`status` text NOT NULL,
	`attempt` integer NOT NULL,
	`response_status` integer,
	`response_body` text,
	`error_message` text,
	`details` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `organization_notification_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_notification_channel_logs_channel` ON `organization_notification_channel_logs` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_channel_logs_notification` ON `organization_notification_channel_logs` (`notification_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_channel_logs_status` ON `organization_notification_channel_logs` (`status`);--> statement-breakpoint
CREATE TABLE `organization_notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`notification_type` text NOT NULL,
	`channel_type` text NOT NULL,
	`webhook_url` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`last_status` text,
	`last_attempted_at` text,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`custom_payload_template` text,
	`custom_headers` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notification_channels_org` ON `organization_notification_channels` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_channels_type` ON `organization_notification_channels` (`notification_type`);--> statement-breakpoint
CREATE TABLE `organization_phase_history` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`phase` text NOT NULL,
	`source` text DEFAULT 'system' NOT NULL,
	`changed_by` text,
	`notes` text,
	`recorded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_organization_phase_history_org` ON `organization_phase_history` (`organization_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `organization_structure_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`snapshot_name` text NOT NULL,
	`snapshot_payload` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_org_snapshots_org` ON `organization_structure_snapshots` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_org_snapshots_created` ON `organization_structure_snapshots` (`created_at`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`employee_count_range` text,
	`industry` text,
	`iso_certification_status` text,
	`subscription_plan` text DEFAULT 'trial',
	`subscription_status` text DEFAULT 'active',
	`isms_phase` text,
	`isms_phase_set_at` text,
	`trial_ends_at` text,
	`created_at` text,
	`ai_config` text,
	`updated_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_organizations_subscription_status` ON `organizations` (`subscription_status`);--> statement-breakpoint
CREATE INDEX `idx_organizations_created_at` ON `organizations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_organizations_deleted_at` ON `organizations` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `project_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`role_id` text NOT NULL,
	`user_id` text,
	`invitation_id` text,
	`assigned_by` text,
	`note` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `project_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_assignments_org` ON `project_assignments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_project_assignments_role` ON `project_assignments` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_project_assignments_user` ON `project_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_project_assignments_invitation` ON `project_assignments` (`invitation_id`);--> statement-breakpoint
CREATE TABLE `project_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`description` text,
	`responsibilities` text,
	`display_order` integer DEFAULT 0,
	`is_required` integer DEFAULT false,
	`seed_source` text,
	`seeded_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_roles_key_unique` ON `project_roles` (`organization_id`,`key`);--> statement-breakpoint
CREATE INDEX `idx_project_roles_org` ON `project_roles` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_project_roles_display_order` ON `project_roles` (`organization_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `risk_assessment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`risk_id` text,
	`assessed_by` text,
	`assessment_date` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`previous_impact_level` integer,
	`new_impact_level` integer,
	`previous_likelihood_level` integer,
	`new_likelihood_level` integer,
	`notes` text,
	FOREIGN KEY (`risk_id`) REFERENCES `risks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessed_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_risk_assessment_history_risk_id` ON `risk_assessment_history` (`risk_id`);--> statement-breakpoint
CREATE TABLE `risk_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`risk_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`risk_id`) REFERENCES `risks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `information_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `risk_assets_risk_asset_unique` ON `risk_assets` (`risk_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_risk_assets_risk` ON `risk_assets` (`risk_id`);--> statement-breakpoint
CREATE INDEX `idx_risk_assets_asset` ON `risk_assets` (`asset_id`);--> statement-breakpoint
CREATE TABLE `risk_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`display_order` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_risk_categories_org` ON `risk_categories` (`organization_id`);--> statement-breakpoint
CREATE TABLE `risk_control_links` (
	`id` text PRIMARY KEY NOT NULL,
	`risk_treatment_id` text NOT NULL,
	`iso_control_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`risk_treatment_id`) REFERENCES `risk_treatments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`iso_control_id`) REFERENCES `iso_controls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `risk_control_links_treatment_control_unique` ON `risk_control_links` (`risk_treatment_id`,`iso_control_id`);--> statement-breakpoint
CREATE INDEX `idx_risk_control_links_treatment` ON `risk_control_links` (`risk_treatment_id`);--> statement-breakpoint
CREATE INDEX `idx_risk_control_links_control` ON `risk_control_links` (`iso_control_id`);--> statement-breakpoint
CREATE TABLE `risk_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`type` text NOT NULL,
	`level` integer NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_risk_criteria_org` ON `risk_criteria` (`organization_id`);--> statement-breakpoint
CREATE TABLE `risk_treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`risk_id` text,
	`treatment_type` text NOT NULL,
	`description` text NOT NULL,
	`responsible_id` text,
	`due_date` text,
	`status` text DEFAULT 'planned',
	`cost_estimate` real,
	`actual_cost` real,
	`effectiveness_rating` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`risk_id`) REFERENCES `risks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responsible_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_risk_treatments_risk_id` ON `risk_treatments` (`risk_id`);--> statement-breakpoint
CREATE INDEX `idx_risk_treatments_status` ON `risk_treatments` (`status`);--> statement-breakpoint
CREATE TABLE `risks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`category_id` text,
	`title` text NOT NULL,
	`description` text,
	`impact_level` integer,
	`likelihood_level` integer,
	`risk_score` integer,
	`status` text DEFAULT 'identified',
	`identified_date` text,
	`identified_by` text,
	`owner_id` text,
	`assessment_period` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `risk_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`identified_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_risks_organization_id` ON `risks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_risks_category_id` ON `risks` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_risks_status` ON `risks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_risks_risk_score` ON `risks` (`risk_score`);--> statement-breakpoint
CREATE INDEX `idx_risks_assessment_period` ON `risks` (`assessment_period`);--> statement-breakpoint
CREATE TABLE `task_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`uploaded_by` text,
	`uploaded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_attachments_task_id` ON `task_attachments` (`task_id`);--> statement-breakpoint
CREATE TABLE `task_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`color` text,
	`icon` text,
	`display_order` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`user_id` text,
	`comment` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_comments_task_id` ON `task_comments` (`task_id`);--> statement-breakpoint
CREATE TABLE `task_history` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`field_name` text,
	`old_value` text,
	`new_value` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_history_task_id` ON `task_history` (`task_id`);--> statement-breakpoint
CREATE TABLE `task_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`user_id` text,
	`reminder_date` text NOT NULL,
	`reminder_type` text,
	`is_sent` integer DEFAULT false,
	`sent_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_reminders_task_id` ON `task_reminders` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_reminders_reminder_date` ON `task_reminders` (`reminder_date`);--> statement-breakpoint
CREATE TABLE `task_tag_relations` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `task_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_tag_relations_task_id` ON `task_tag_relations` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_tag_relations_tag_id` ON `task_tag_relations` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_task_tag_relations_order` ON `task_tag_relations` (`task_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`color` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`title` text NOT NULL,
	`description` text,
	`category_id` text,
	`assignee_id` text,
	`reporter_id` text,
	`status` text DEFAULT 'todo',
	`priority` text DEFAULT 'medium',
	`due_date` text,
	`estimated_hours` real,
	`actual_hours` real,
	`progress` integer DEFAULT 0,
	`parent_task_id` text,
	`related_document_id` text,
	`related_risk_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`completed_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `task_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_risk_id`) REFERENCES `risks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_organization_id` ON `tasks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assignee_id` ON `tasks` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_priority` ON `tasks` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due_date` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `user_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`department_scope` text,
	`assigned_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_memberships_user_org_unique` ON `user_memberships` (`user_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_user_memberships_user` ON `user_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_memberships_org` ON `user_memberships` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_user_memberships_role` ON `user_memberships` (`role`);--> statement-breakpoint
CREATE TABLE `user_permission_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`can_manage_documents` integer DEFAULT false,
	`can_manage_risks` integer DEFAULT false,
	`can_manage_tasks` integer DEFAULT false,
	`can_manage_audit` integer DEFAULT false,
	`can_manage_assets` integer DEFAULT false,
	`can_manage_controls` integer DEFAULT false,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_permission_sets_user_org_unique` ON `user_permission_sets` (`user_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_user_permission_sets_org` ON `user_permission_sets` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_user_permission_sets_user` ON `user_permission_sets` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`full_name_en` text,
	`role` text NOT NULL,
	`department` text,
	`position` text,
	`phone` text,
	`is_active` integer DEFAULT true,
	`avatar_url` text,
	`language_preference` text DEFAULT 'ja',
	`primary_department_id` text,
	`is_ciso` integer DEFAULT false,
	`is_security_manager` integer DEFAULT false,
	`is_org_admin` integer DEFAULT false,
	`is_audit_committee` integer DEFAULT false,
	`is_isms_promoter` integer DEFAULT false,
	`created_at` text,
	`updated_at` text,
	`last_login_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_department_id`) REFERENCES `organization_departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_org_email_unique` ON `user_profiles` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_organization_id` ON `user_profiles` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_email` ON `user_profiles` (`email`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_role` ON `user_profiles` (`role`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_is_active` ON `user_profiles` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_org_flags` ON `user_profiles` (`organization_id`,`is_ciso`,`is_security_manager`,`is_org_admin`,`is_audit_committee`,`is_isms_promoter`);