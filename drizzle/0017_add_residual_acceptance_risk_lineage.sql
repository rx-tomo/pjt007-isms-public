DROP TRIGGER residual_acceptance_approval_bindings_immutable;

ALTER TABLE residual_acceptance_approval_bindings
ADD COLUMN risk_id TEXT;

UPDATE residual_acceptance_approval_bindings
SET risk_id = (
  SELECT risk_treatments.risk_id
  FROM risk_treatments
  WHERE risk_treatments.id = residual_acceptance_approval_bindings.resource_id
)
WHERE risk_id IS NULL;

CREATE INDEX idx_residual_acceptance_bindings_risk
ON residual_acceptance_approval_bindings(risk_id);

CREATE TRIGGER residual_acceptance_approval_bindings_immutable
BEFORE UPDATE ON residual_acceptance_approval_bindings
BEGIN
  SELECT RAISE(ABORT, 'residual acceptance approval binding is immutable');
END;

-- Runtime provisioning validates that no unresolved lineage remains and installs
-- the insert/delete guards after this schema migration.
