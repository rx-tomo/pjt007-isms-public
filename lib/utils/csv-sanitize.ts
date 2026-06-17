/**
 * CSV Injection (Formula Injection) Prevention Utilities
 *
 * Prevents Excel/spreadsheet formula injection by escaping cell values
 * that begin with dangerous characters (=, +, -, @).
 *
 * @module lib/utils/csv-sanitize
 */

/**
 * Escapes a CSV cell value to prevent formula injection.
 *
 * 1. Prepends a single quote if value starts with =, +, -, or @
 * 2. Escapes double quotes by doubling them
 * 3. Wraps the result in double quotes
 *
 * @param value - The cell value to escape
 * @returns The escaped, double-quoted cell value
 */
export function escapeCsvCell(value: string): string {
  let sanitized = value
  if (/^[=+\-@]/.test(sanitized)) {
    sanitized = "'" + sanitized
  }
  const escaped = sanitized.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Nullable variant of escapeCsvCell.
 * Returns empty string for null/undefined, otherwise calls escapeCsvCell.
 *
 * @param val - The cell value (may be null or undefined)
 * @returns The escaped cell value or empty string
 */
export function escapeCsvCellNullable(val: string | null | undefined): string {
  if (val == null) return ''
  return escapeCsvCell(val)
}
