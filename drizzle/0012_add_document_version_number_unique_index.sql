CREATE UNIQUE INDEX IF NOT EXISTS `idx_document_versions_document_number_unique` ON `document_versions` (`document_id`, `version_number`);
