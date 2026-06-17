CREATE TABLE `soa_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`title` text NOT NULL,
	`snapshot` text NOT NULL,
	`control_count` integer DEFAULT 0 NOT NULL,
	`approved_control_count` integer DEFAULT 0 NOT NULL,
	`published_by` text,
	`published_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`published_by`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `soa_versions_org_version_unique` ON `soa_versions` (`organization_id`,`version_number`);
--> statement-breakpoint
CREATE INDEX `idx_soa_versions_org` ON `soa_versions` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_soa_versions_published_at` ON `soa_versions` (`published_at`);
