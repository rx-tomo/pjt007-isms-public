CREATE TABLE IF NOT EXISTS `twoFactor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backupCodes` text NOT NULL,
	`userId` text NOT NULL REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_twoFactor_userId` ON `twoFactor` (`userId`);
