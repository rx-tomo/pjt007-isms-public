CREATE UNIQUE INDEX IF NOT EXISTS `idx_document_approval_single_pending_unique`
ON `approval_requests` (`organization_id`, `resource_id`)
WHERE `resource_type` = 'document' AND `status` = 'pending';
