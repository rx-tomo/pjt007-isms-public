/**
 * CacheManager
 *
 * In-memory cache with TTL support for AI responses.
 * Provides efficient caching of AI completion responses to reduce API calls
 * and improve response times for repeated queries.
 *
 * @module lib/ai/cache/CacheManager
 */

/**
 * Internal cache entry structure
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Configuration options for CacheManager
 */
export interface CacheManagerConfig {
  /**
   * Default TTL in milliseconds for cache entries
   * @default 3600000 (1 hour)
   */
  defaultTtlMs?: number
}

/**
 * Cache manager interface
 */
export interface ICacheManager {
  /**
   * Get a cached value by key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time to live in milliseconds (optional, uses default if not specified)
   */
  set<T>(key: string, value: T, ttlMs?: number): void

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean

  /**
   * Remove a specific key from cache
   * @returns true if key was removed, false if it didn't exist or was expired
   */
  invalidate(key: string): boolean

  /**
   * Remove all keys that start with the given prefix
   * @returns Number of valid (non-expired) keys removed
   */
  invalidateByPrefix(prefix: string): number

  /**
   * Remove all entries from cache
   */
  clear(): void

  /**
   * Get the number of valid (non-expired) entries in cache
   */
  size(): number

  /**
   * Get all valid (non-expired) keys with the given prefix
   * @param prefix - Key prefix to filter by
   * @returns Array of matching keys
   */
  getKeysByPrefix(prefix: string): string[]
}

/**
 * Default TTL: 1 hour in milliseconds
 */
const DEFAULT_TTL_MS = 60 * 60 * 1000

/**
 * In-memory cache implementation with TTL support
 */
export class CacheManager implements ICacheManager {
  private cache: Map<string, CacheEntry<unknown>>
  private defaultTtlMs: number

  constructor(config?: CacheManagerConfig) {
    this.cache = new Map()
    this.defaultTtlMs = config?.defaultTtlMs ?? DEFAULT_TTL_MS
  }

  /**
   * Get current time in milliseconds
   * Extracted for testability
   */
  private now(): number {
    return Date.now()
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return this.now() >= entry.expiresAt
  }

  /**
   * Get a cached value by key
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    if (this.isExpired(entry)) {
      // Clean up expired entry
      this.cache.delete(key)
      return undefined
    }

    return entry.value as T
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs
    const entry: CacheEntry<T> = {
      value,
      expiresAt: this.now() + ttl
    }
    this.cache.set(key, entry)
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (this.isExpired(entry)) {
      // Clean up expired entry
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Remove a specific key from cache
   */
  invalidate(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (this.isExpired(entry)) {
      // Clean up expired entry
      this.cache.delete(key)
      return false
    }

    this.cache.delete(key)
    return true
  }

  /**
   * Remove all keys that start with the given prefix
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        const entry = this.cache.get(key)
        // Only count valid (non-expired) entries
        if (entry && !this.isExpired(entry)) {
          count++
        }
        this.cache.delete(key)
      }
    }

    return count
  }

  /**
   * Remove all entries from cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get the number of valid (non-expired) entries in cache
   */
  size(): number {
    let count = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        // Clean up expired entry
        this.cache.delete(key)
      } else {
        count++
      }
    }

    return count
  }

  /**
   * Get all valid (non-expired) keys with the given prefix
   */
  getKeysByPrefix(prefix: string): string[] {
    const keys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        if (this.isExpired(entry)) {
          // Clean up expired entry
          this.cache.delete(key)
        } else {
          keys.push(key)
        }
      }
    }

    return keys
  }
}
