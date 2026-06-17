/**
 * AI Error Handler
 *
 * Central error handling for AI providers with retry logic and graceful degradation.
 * Provides error classification, exponential backoff retry, and bilingual error messages.
 *
 * @module lib/ai/errors/AIErrorHandler
 */

/**
 * Type of AI error for classification and handling decisions.
 *
 * - rate_limit: 429 - Recoverable with backoff
 * - timeout: Request timeout - Recoverable with retry
 * - network: Network failure - Fallback to offline
 * - auth: 401/403 - Unrecoverable
 * - invalid_request: 400 - Unrecoverable
 * - parse_error: Response parsing failed - Unrecoverable
 * - provider_error: 500 from provider - Recoverable with retry
 * - unknown: Unknown error
 */
export type AIErrorType =
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'invalid_request'
  | 'parse_error'
  | 'provider_error'
  | 'unknown'

/**
 * Detailed error information for AI errors.
 */
export interface AIErrorInfo {
  /** The classified error type */
  type: AIErrorType
  /** Human-readable error message in English */
  message: string
  /** Human-readable error message in Japanese */
  messageJa: string
  /** Whether this error can be recovered from with retry */
  recoverable: boolean
  /** Suggested retry delay in milliseconds (for recoverable errors) */
  retryAfterMs?: number
  /** The original error that was classified */
  originalError?: Error
}

/**
 * Configuration for retry with exponential backoff.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Base delay in milliseconds before first retry */
  baseDelayMs: number
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number
  /** Multiplier for exponential backoff (e.g., 2 for doubling) */
  backoffMultiplier: number
}

/**
 * Service context for error handling decisions.
 */
export interface ServiceContext {
  /** Organization ID for logging and metrics */
  organizationId: string
  /** User ID for logging (optional) */
  userId?: string
  /** Locale for error messages */
  locale: 'ja' | 'en'
  /** Whether to use cache (optional) */
  useCache?: boolean
  /** Whether to save suggestions (optional) */
  saveSuggestion?: boolean
}

/**
 * Interface for error handler implementations.
 */
export interface IErrorHandler {
  /**
   * Classifies an error into a specific AI error type.
   * @param error The error to classify
   * @returns Detailed error information
   */
  classifyError(error: Error): AIErrorInfo

  /**
   * Checks if an error is recoverable through retry.
   * @param error The error to check
   * @returns true if the error can be recovered from
   */
  isRecoverableError(error: Error): boolean

  /**
   * Executes an operation with exponential backoff retry.
   * @param operation The async operation to execute
   * @param config Optional retry configuration
   * @returns Promise resolving to the operation result
   * @throws AIServiceError if all retries fail
   */
  retryWithBackoff<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T>

  /**
   * Handles a provider error and determines if fallback should be used.
   * @param error The error from the provider
   * @param context Service context for the request
   * @returns Object indicating whether to use fallback and error info
   */
  handleProviderError(
    error: Error,
    context: ServiceContext
  ): Promise<{ useFallback: boolean; errorInfo: AIErrorInfo }>
}

/**
 * Error messages for each error type in both languages.
 */
const ERROR_MESSAGES: Record<AIErrorType, { en: string; ja: string }> = {
  rate_limit: {
    en: 'Request rate limit exceeded. Please wait and try again.',
    ja: 'リクエストのレート制限を超過しました。しばらく待ってから再試行してください。'
  },
  timeout: {
    en: 'Request timed out. Please try again.',
    ja: 'リクエストがタイムアウトしました。再試行してください。'
  },
  network: {
    en: 'Network connection error. Operating in offline mode.',
    ja: 'ネットワーク接続エラーが発生しました。オフラインモードで動作しています。'
  },
  auth: {
    en: 'Authentication failed. Please check your API credentials.',
    ja: '認証に失敗しました。APIの認証情報を確認してください。'
  },
  invalid_request: {
    en: 'Invalid request. Please check your input.',
    ja: '無効なリクエストです。入力内容を確認してください。'
  },
  parse_error: {
    en: 'Failed to parse AI response. Please try again.',
    ja: 'AIレスポンスの解析に失敗しました。再試行してください。'
  },
  provider_error: {
    en: 'AI provider is experiencing issues. Please try again later.',
    ja: 'AIプロバイダーで問題が発生しています。しばらく後に再試行してください。'
  },
  unknown: {
    en: 'An unexpected error occurred. Please try again.',
    ja: '予期しないエラーが発生しました。再試行してください。'
  }
}

/**
 * Custom error class for AI service errors.
 * Includes detailed error information for error handling and display.
 */
export class AIServiceError extends Error {
  /** Detailed error information */
  public readonly errorInfo: AIErrorInfo

  /**
   * Creates a new AIServiceError.
   * @param message Error message
   * @param errorInfo Detailed error information
   */
  constructor(message: string, errorInfo: AIErrorInfo) {
    super(message)
    this.name = 'AIServiceError'
    this.errorInfo = errorInfo

    // Maintains proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIServiceError)
    }
  }
}

/**
 * Central error handler for AI operations.
 *
 * Provides:
 * - Error classification based on HTTP status codes and error types
 * - Exponential backoff retry with jitter
 * - Graceful degradation to fallback mode
 * - Bilingual error messages
 */
export class AIErrorHandler implements IErrorHandler {
  /**
   * Default retry configuration.
   */
  static DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  }

  /**
   * Classifies an error into a specific AI error type.
   */
  classifyError(error: Error): AIErrorInfo {
    const errorType = this.determineErrorType(error)
    const recoverable = this.isRecoverableType(errorType)
    const retryAfterMs = this.extractRetryAfter(error, errorType)

    return {
      type: errorType,
      message: ERROR_MESSAGES[errorType].en,
      messageJa: ERROR_MESSAGES[errorType].ja,
      recoverable,
      retryAfterMs,
      originalError: error
    }
  }

  /**
   * Determines the error type based on error properties.
   */
  private determineErrorType(error: Error): AIErrorType {
    const status = (error as any).status
    const code = (error as any).code

    // Check HTTP status codes first
    if (status === 429) {
      return 'rate_limit'
    }
    if (status === 401 || status === 403) {
      return 'auth'
    }
    if (status === 400) {
      return 'invalid_request'
    }
    if (status === 500 || status === 502 || status === 503) {
      return 'provider_error'
    }

    // Check error codes for network/timeout issues
    if (code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
      return 'timeout'
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
      return 'network'
    }

    // Check for parse errors
    if (error instanceof SyntaxError) {
      return 'parse_error'
    }

    return 'unknown'
  }

  /**
   * Checks if an error type is recoverable.
   */
  private isRecoverableType(type: AIErrorType): boolean {
    return type === 'rate_limit' || type === 'timeout' || type === 'provider_error'
  }

  /**
   * Extracts retry-after time from error or uses default.
   */
  private extractRetryAfter(error: Error, type: AIErrorType): number | undefined {
    if (type !== 'rate_limit' && type !== 'timeout' && type !== 'provider_error') {
      return undefined
    }

    // Try to extract from headers
    const headers = (error as any).headers
    if (headers && headers['retry-after']) {
      const retryAfter = parseInt(headers['retry-after'], 10)
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000 // Convert seconds to milliseconds
      }
    }

    // Default values
    if (type === 'rate_limit') {
      return 60000 // 60 seconds default for rate limit
    }

    return undefined
  }

  /**
   * Checks if an error is recoverable through retry.
   */
  isRecoverableError(error: Error): boolean {
    const type = this.determineErrorType(error)
    return this.isRecoverableType(type)
  }

  /**
   * Executes an operation with exponential backoff retry.
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const fullConfig: RetryConfig = {
      ...AIErrorHandler.DEFAULT_RETRY_CONFIG,
      ...config
    }

    let lastError: Error | null = null
    let attempt = 0

    while (attempt <= fullConfig.maxRetries) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        // Check if error is recoverable
        if (!this.isRecoverableError(lastError)) {
          throw new AIServiceError(
            lastError.message,
            this.classifyError(lastError)
          )
        }

        // If we've exhausted retries, throw
        if (attempt >= fullConfig.maxRetries) {
          break
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt + 1, fullConfig)
        await this.sleep(delay)

        attempt++
      }
    }

    // All retries exhausted
    throw new AIServiceError(
      lastError?.message || 'Operation failed after retries',
      this.classifyError(lastError!)
    )
  }

  /**
   * Calculates delay for exponential backoff with jitter.
   * Formula: min(maxDelay, baseDelay * multiplier^attempt * (1 + random jitter))
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Calculate exponential delay
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)

    // Add jitter (0-25% of the delay)
    const jitter = Math.random() * 0.25

    // Apply jitter
    const delayWithJitter = exponentialDelay * (1 + jitter)

    // Cap at maxDelayMs
    return Math.min(delayWithJitter, config.maxDelayMs)
  }

  /**
   * Sleeps for the specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Handles a provider error and determines if fallback should be used.
   */
  async handleProviderError(
    error: Error,
    _context: ServiceContext
  ): Promise<{ useFallback: boolean; errorInfo: AIErrorInfo }> {
    const errorInfo = this.classifyError(error)

    // Determine if we should use fallback
    let useFallback = false

    switch (errorInfo.type) {
      case 'network':
        // Network errors should always fall back
        useFallback = true
        break

      case 'provider_error':
        // Provider errors should fall back after exhausting retries
        useFallback = true
        break

      case 'auth':
      case 'invalid_request':
      case 'parse_error':
        // These are unrecoverable - don't use fallback
        useFallback = false
        break

      case 'rate_limit':
      case 'timeout':
        // These might be recovered, but if we're here, retries failed
        useFallback = true
        break

      default:
        useFallback = false
    }

    return { useFallback, errorInfo }
  }
}
