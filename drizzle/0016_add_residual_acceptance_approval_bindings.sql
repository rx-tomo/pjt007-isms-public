ALTER TABLE risk_treatments
ADD COLUMN material_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE residual_acceptance_approval_bindings (
  approval_request_id TEXT PRIMARY KEY NOT NULL
    REFERENCES approval_requests(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  approver_id TEXT NOT NULL,
  responsible_id TEXT NOT NULL,
  resource_material_version INTEGER NOT NULL
);

CREATE TRIGGER residual_acceptance_approval_bindings_immutable
BEFORE UPDATE ON residual_acceptance_approval_bindings
BEGIN
  SELECT RAISE(ABORT, 'residual acceptance approval binding is immutable');
END;

CREATE TRIGGER residual_acceptance_approval_bindings_delete_guard
BEFORE DELETE ON residual_acceptance_approval_bindings
WHEN EXISTS (
  SELECT 1
  FROM approval_requests
  WHERE id = OLD.approval_request_id
)
BEGIN
  SELECT RAISE(ABORT, 'residual acceptance approval binding cannot be deleted directly');
END;
