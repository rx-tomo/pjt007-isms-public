ALTER TABLE `iso_controls` ADD `soa_status` text DEFAULT 'not_reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_applicability_reason` text;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_exclusion_reason` text;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_reviewed_by` text REFERENCES `user_profiles`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_reviewed_at` text;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_approval_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_approved_by` text REFERENCES `user_profiles`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_approved_at` text;--> statement-breakpoint
ALTER TABLE `iso_controls` ADD `soa_rejection_reason` text;
