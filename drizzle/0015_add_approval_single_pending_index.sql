CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_requests_single_pending_unique
ON approval_requests (organization_id, resource_type, resource_id)
WHERE status = 'pending';
