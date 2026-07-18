import { createHash } from 'node:crypto'
import { invariantTriggerDefinitions } from './database-invariant-raw-definitions.mjs'

export { invariantTriggerDefinitions }

function indentSql(sql) {
  return sql
    .trim()
    .split('\n')
    .map(line => `  ${line.trimEnd()}`)
    .join('\n')
}

export function renderInvariantTriggerSql(definition) {
  const whenClause = definition.when ? `\nWHEN ${definition.when.trim()}` : ''
  return `CREATE TRIGGER ${definition.name}
${definition.timing} ${definition.event} ON ${definition.table}${whenClause}
BEGIN
${indentSql(definition.body)}
END;`
}

export function renderDropInvariantTriggersSql() {
  return invariantTriggerDefinitions
    .map(definition => `DROP TRIGGER IF EXISTS ${definition.name};`)
    .join('\n')
}

export function normalizeInvariantSql(sql) {
  return sql.replace(/\s+/g, ' ').trim()
}

export function hashInvariantSql(sql) {
  return createHash('sha256').update(normalizeInvariantSql(sql)).digest('hex')
}
