/**
 * Compatibility export for the SQLite audit plan repository.
 *
 * The runtime container historically imports this path. Keep that import stable
 * while routing it to the implemented repository.
 */

export { SQLiteAuditPlanRepository } from './SQLiteAuditPlanRepository'
