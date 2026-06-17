ALTER TABLE `ai_suggestions` ADD `input_scope` text;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `decision_status` text NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `final_content` text;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `decision_reason` text;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `usage_log_id` text;--> statement-breakpoint
CREATE INDEX `idx_ai_suggestions_decision_status` ON `ai_suggestions` (`decision_status`);--> statement-breakpoint
CREATE INDEX `idx_ai_suggestions_usage_log` ON `ai_suggestions` (`usage_log_id`);--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `provider_mode` text NOT NULL DEFAULT 'mock';--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `model_label` text;--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `status` text NOT NULL DEFAULT 'succeeded';--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `input_scope` text;--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `target_records` text;--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `redaction_summary` text;--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `started_at` text;--> statement-breakpoint
ALTER TABLE `ai_usage_logs` ADD `completed_at` text;--> statement-breakpoint
CREATE INDEX `idx_ai_usage_logs_status` ON `ai_usage_logs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_logs_provider_mode` ON `ai_usage_logs` (`provider_mode`);
