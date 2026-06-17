/**
 * Safe JSON parsing utilities.
 *
 * Provides wrappers around JSON.parse that handle malformed input
 * gracefully instead of throwing.
 *
 * @module lib/utils/safe-json
 */

/**
 * Safely parses a JSON string expected to contain an array.
 * Returns an empty array if parsing fails or input is null/undefined.
 *
 * @param json - The JSON string to parse (may be null or undefined)
 * @returns The parsed array, or [] on failure
 */
export function safeParseArray(json: string | null | undefined): unknown[] {
  if (json == null) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
