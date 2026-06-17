/**
 * Privacy Filter
 *
 * Anonymizes sensitive information before sending to AI providers
 * and restores original values after receiving responses.
 *
 * Supported patterns:
 * - Email addresses
 * - Japanese phone numbers
 * - IP addresses
 * - Japanese names (common patterns)
 */

/**
 * Result of anonymization operation
 */
export interface AnonymizationResult {
  /** Text with sensitive data replaced by placeholders */
  anonymizedText: string
  /** Map of placeholder -> original value for restoration */
  mappings: Map<string, string>
}

/**
 * Pattern configuration for anonymization
 */
interface PatternConfig {
  /** Regular expression pattern to match sensitive data */
  pattern: RegExp
  /** Prefix for placeholder (e.g., 'EMAIL' -> [EMAIL_1]) */
  prefix: string
  /** Description of what this pattern matches */
  description: string
}

/**
 * Supported sensitive data types
 */
export type SensitiveDataType = 'EMAIL' | 'PHONE' | 'IP' | 'NAME'

/**
 * Privacy filter for anonymizing and restoring sensitive data
 *
 * @example
 * ```typescript
 * const filter = new PrivacyFilter()
 *
 * // Anonymize before sending to AI
 * const { anonymizedText, mappings } = filter.anonymize(
 *   'Contact john@example.com at 03-1234-5678'
 * )
 * // anonymizedText: 'Contact [EMAIL_1] at [PHONE_1]'
 *
 * // Restore after receiving AI response
 * const restored = filter.restore(aiResponse, mappings)
 * ```
 */
export class PrivacyFilter {
  /** Default patterns for sensitive data detection */
  private static readonly DEFAULT_PATTERNS: PatternConfig[] = [
    {
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      prefix: 'EMAIL',
      description: 'Email addresses (e.g., user@example.com)'
    },
    {
      pattern: /0\d{1,4}-?\d{1,4}-?\d{3,4}/g,
      prefix: 'PHONE',
      description: 'Japanese phone numbers (e.g., 03-1234-5678, 090-1234-5678)'
    },
    {
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      prefix: 'IP',
      description: 'IPv4 addresses (e.g., 192.168.1.1)'
    },
    {
      // CJK kanji (U+4E00-U+9FAF) and repetition mark (U+3005)
      // Half-width space (U+0020) and full-width space (U+3000)
      pattern: /[\u4e00-\u9faf\u3005]{2,4}[\s\u3000][\u4e00-\u9faf\u3005]{2,4}/g,
      prefix: 'NAME',
      description: 'Japanese names with kanji (e.g., 田中 太郎)'
    }
  ]

  private readonly patterns: PatternConfig[]

  /**
   * Create a new PrivacyFilter instance
   * @param customPatterns - Optional custom patterns to use instead of defaults
   */
  constructor(customPatterns?: PatternConfig[]) {
    this.patterns = customPatterns ?? PrivacyFilter.DEFAULT_PATTERNS
  }

  /**
   * Anonymize sensitive data in text
   *
   * Replaces sensitive data with placeholders like [EMAIL_1], [PHONE_1], etc.
   * Returns mappings for later restoration.
   *
   * @param text - Input text that may contain sensitive data
   * @returns Anonymization result with anonymized text and mappings
   */
  anonymize(text: string): AnonymizationResult {
    const mappings = new Map<string, string>()
    let anonymizedText = text
    const counter: Record<string, number> = {}

    for (const config of this.patterns) {
      anonymizedText = this.processPattern(
        anonymizedText,
        config,
        counter,
        mappings
      )
    }

    return { anonymizedText, mappings }
  }

  /**
   * Restore anonymized text to original
   *
   * Replaces placeholders with original values using the provided mappings.
   *
   * @param anonymizedText - Text with placeholders
   * @param mappings - Map of placeholder -> original value
   * @returns Restored text with original values
   */
  restore(anonymizedText: string, mappings: Map<string, string>): string {
    let restoredText = anonymizedText

    for (const [placeholder, original] of mappings) {
      restoredText = this.replaceAll(restoredText, placeholder, original)
    }

    return restoredText
  }

  /**
   * Get the list of supported patterns
   * @returns Array of pattern descriptions
   */
  getSupportedPatterns(): string[] {
    return this.patterns.map((p) => p.description)
  }

  /**
   * Process a single pattern and update the anonymized text
   */
  private processPattern(
    text: string,
    config: PatternConfig,
    counter: Record<string, number>,
    mappings: Map<string, string>
  ): string {
    const { pattern, prefix } = config

    // Reset the regex for global matching
    pattern.lastIndex = 0

    // Find all matches
    const matches = text.match(pattern)
    if (!matches) return text

    // Initialize counter for this prefix if needed
    if (!counter[prefix]) {
      counter[prefix] = 1
    }

    let result = text

    // Process unique matches to avoid duplicate replacements
    const uniqueMatches = [...new Set(matches)]
    for (const match of uniqueMatches) {
      const placeholder = this.createPlaceholder(prefix, counter[prefix])
      mappings.set(placeholder, match)
      result = this.replaceAll(result, match, placeholder)
      counter[prefix]++
    }

    return result
  }

  /**
   * Create a placeholder string
   */
  private createPlaceholder(prefix: string, index: number): string {
    return `[${prefix}_${index}]`
  }

  /**
   * Replace all occurrences of a string
   */
  private replaceAll(text: string, search: string, replacement: string): string {
    return text.split(search).join(replacement)
  }
}
