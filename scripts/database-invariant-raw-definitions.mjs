export const invariantTriggerDefinitions = Object.freeze([
  {
    behaviorId: 'DB-INV-RESIDUAL-BINDING-LINEAGE',
    name: 'residual_acceptance_approval_bindings_insert_guard',
    table: 'residual_acceptance_approval_bindings',
    timing: 'BEFORE',
    event: 'INSERT',
    when: `NEW.risk_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM risk_treatments AS treatment
      INNER JOIN risks AS risk ON risk.id = treatment.risk_id
      WHERE treatment.id = NEW.resource_id
        AND treatment.risk_id = NEW.risk_id
        AND risk.organization_id = NEW.organization_id
    )`,
    body: "SELECT RAISE(ABORT, 'residual acceptance approval binding lineage is invalid');",
    error: 'residual acceptance approval binding lineage is invalid',
  },
  {
    behaviorId: 'DB-INV-RESIDUAL-BINDING-IMMUTABLE',
    name: 'residual_acceptance_approval_bindings_immutable',
    table: 'residual_acceptance_approval_bindings',
    timing: 'BEFORE',
    event: 'UPDATE',
    when: null,
    body: "SELECT RAISE(ABORT, 'residual acceptance approval binding is immutable');",
    error: 'residual acceptance approval binding is immutable',
  },
  {
    behaviorId: 'DB-INV-RESIDUAL-BINDING-DIRECT-DELETE',
    name: 'residual_acceptance_approval_bindings_delete_guard',
    table: 'residual_acceptance_approval_bindings',
    timing: 'BEFORE',
    event: 'DELETE',
    when: `EXISTS (
      SELECT 1
      FROM approval_requests
      WHERE id = OLD.approval_request_id
    )`,
    body: "SELECT RAISE(ABORT, 'residual acceptance approval binding cannot be deleted directly');",
    error: 'residual acceptance approval binding cannot be deleted directly',
  },
  {
    behaviorId: 'DB-INV-TREATMENT-APPROVAL-HISTORY-RETENTION',
    name: 'risk_treatment_approval_history_delete_guard',
    table: 'risk_treatments',
    timing: 'BEFORE',
    event: 'DELETE',
    when: `EXISTS (
      SELECT 1
      FROM residual_acceptance_approval_bindings
      WHERE resource_id = OLD.id
    )`,
    body: "SELECT RAISE(ABORT, 'risk treatment with approval history cannot be deleted');",
    error: 'risk treatment with approval history cannot be deleted',
  },
  {
    behaviorId: 'DB-INV-LINKED-CONTROL-RETENTION',
    name: 'iso_controls_linked_delete_guard',
    table: 'iso_controls',
    timing: 'BEFORE',
    event: 'DELETE',
    when: `EXISTS (
      SELECT 1
      FROM risk_control_links
      WHERE iso_control_id = OLD.id
    )`,
    body: "SELECT RAISE(ABORT, 'linked ISO control cannot be deleted');",
    error: 'linked ISO control cannot be deleted',
  },
  {
    behaviorId: 'DB-INV-RISK-TREATMENT-HISTORY-RETENTION',
    name: 'risks_treatment_delete_guard',
    table: 'risks',
    timing: 'BEFORE',
    event: 'DELETE',
    when: `EXISTS (SELECT 1 FROM risk_treatments WHERE risk_id = OLD.id)
      OR EXISTS (
        SELECT 1
        FROM residual_acceptance_approval_bindings
        WHERE risk_id = OLD.id
      )`,
    body: "SELECT RAISE(ABORT, 'risk with treatments or approval history cannot be deleted');",
    error: 'risk with treatments or approval history cannot be deleted',
  },
])
