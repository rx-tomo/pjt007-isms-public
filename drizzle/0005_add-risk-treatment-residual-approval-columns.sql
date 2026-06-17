ALTER TABLE risk_treatments ADD COLUMN residual_approval_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE risk_treatments ADD COLUMN residual_approved_by TEXT REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE risk_treatments ADD COLUMN residual_approved_at TEXT;
ALTER TABLE risk_treatments ADD COLUMN residual_rejection_reason TEXT;
