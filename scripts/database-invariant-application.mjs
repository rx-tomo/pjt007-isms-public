import { createClient } from '@libsql/client'
import {
  invariantTriggerDefinitions,
  renderDropInvariantTriggersSql,
  renderInvariantTriggerSql,
} from './database-invariant-definitions.mjs'

export async function applyDatabaseInvariants(url, authToken) {
  const client = createClient({ url, authToken })

  try {
    const requiredTables = ['approval_requests', 'residual_acceptance_approval_bindings']
    for (const table of requiredTables) {
      const result = await client.execute({
        sql: 'SELECT COUNT(*) AS value FROM sqlite_master WHERE type = ? AND name = ?',
        args: ['table', table],
      })
      if (Number(result.rows[0]?.value ?? 0) !== 1) {
        throw new Error(`Required table is missing after schema push: ${table}`)
      }
    }

    const treatmentColumns = await client.execute("PRAGMA table_info('risk_treatments')")
    if (!treatmentColumns.rows.some(row => row.name === 'material_version')) {
      throw new Error('Required column is missing after schema push: risk_treatments.material_version')
    }

    const transaction = await client.transaction('write')
    try {
      const bindingColumns = await transaction.execute(
        "PRAGMA table_info('residual_acceptance_approval_bindings')"
      )
      if (!bindingColumns.rows.some(row => row.name === 'risk_id')) {
        await transaction.execute(
          'ALTER TABLE residual_acceptance_approval_bindings ADD COLUMN risk_id TEXT'
        )
      }

      await transaction.executeMultiple(`
      ${renderDropInvariantTriggersSql()}

      UPDATE residual_acceptance_approval_bindings
      SET risk_id = (
        SELECT treatment.risk_id
        FROM risk_treatments AS treatment
        WHERE treatment.id = residual_acceptance_approval_bindings.resource_id
      )
      WHERE risk_id IS NULL;

      `)

      const invalidLineage = await transaction.execute(`
        SELECT COUNT(*) AS value
        FROM residual_acceptance_approval_bindings AS binding
        LEFT JOIN risk_treatments AS treatment
          ON treatment.id = binding.resource_id
        LEFT JOIN risks AS risk
          ON risk.id = treatment.risk_id
        WHERE binding.risk_id IS NULL
          OR treatment.id IS NULL
          OR treatment.risk_id IS NULL
          OR binding.risk_id <> treatment.risk_id
          OR risk.id IS NULL
          OR risk.organization_id <> binding.organization_id
      `)
      if (Number(invalidLineage.rows[0]?.value ?? 0) > 0) {
        throw new Error('Cannot establish risk lineage for existing residual acceptance bindings')
      }

      const invariantTriggerSql = invariantTriggerDefinitions
        .map(renderInvariantTriggerSql)
        .join('\n\n')
      await transaction.executeMultiple(`
      CREATE INDEX IF NOT EXISTS idx_residual_acceptance_bindings_risk
      ON residual_acceptance_approval_bindings(risk_id);

      ${invariantTriggerSql}
      `)
      await transaction.commit()
    } catch (error) {
      if (!transaction.closed) await transaction.rollback()
      throw error
    } finally {
      transaction.close()
    }

    const triggerNames = invariantTriggerDefinitions.map(definition => definition.name)
    const triggers = await client.execute({
      sql: `
        SELECT name
        FROM sqlite_master
        WHERE type = 'trigger'
          AND name IN (${triggerNames.map(() => '?').join(', ')})
        ORDER BY name
      `,
      args: triggerNames,
    })
    if (triggers.rows.length !== triggerNames.length) {
      throw new Error('Database invariant triggers were not provisioned')
    }
  } finally {
    client.close()
  }
}
