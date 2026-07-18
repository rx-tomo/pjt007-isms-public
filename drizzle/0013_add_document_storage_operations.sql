CREATE TABLE `document_storage_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`document_id` text NOT NULL,
	`operation_key` text NOT NULL,
	`kind` text NOT NULL,
	`operation_mode` text DEFAULT 'normal' NOT NULL,
	`status` text NOT NULL,
	`request_fingerprint` text,
	`file_paths` text DEFAULT '[]' NOT NULL,
	`version_id` text,
	`created_by` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`lease_token` text,
	`lease_expires_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_storage_operations_org_key_unique` ON `document_storage_operations` (`organization_id`,`operation_key`);
--> statement-breakpoint
CREATE INDEX `idx_document_storage_operations_org_status` ON `document_storage_operations` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_document_storage_operations_document` ON `document_storage_operations` (`document_id`);
