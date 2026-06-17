ALTER TABLE `soa_versions` ADD `review_status` text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE `soa_versions` ADD `reviewed_by` text REFERENCES `user_profiles`(`id`) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `soa_versions` ADD `reviewed_at` text;
--> statement-breakpoint
ALTER TABLE `soa_versions` ADD `rejection_reason` text;
