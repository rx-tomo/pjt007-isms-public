/**
 * Base Repository Interface
 *
 * Provides common CRUD operations for all repositories.
 * Each repository implementation (libSQL/Turso) must implement this interface.
 */
export interface IBaseRepository<T, TInsert, TUpdate> {
  /**
   * Find a single record by ID
   */
  findById(id: string): Promise<T | null>

  /**
   * Find multiple records with optional filters
   */
  findMany(filters?: Record<string, unknown>): Promise<T[]>

  /**
   * Create a new record
   */
  create(data: TInsert): Promise<T>

  /**
   * Update an existing record
   */
  update(id: string, data: TUpdate): Promise<T | null>

  /**
   * Delete a record by ID
   */
  delete(id: string): Promise<void>
}

/**
 * Base repository with organization context
 * Most repositories in this application are scoped to an organization
 */
export interface IOrganizationScopedRepository<T, TInsert, TUpdate> extends IBaseRepository<T, TInsert, TUpdate> {
  /**
   * Find all records for a specific organization
   */
  findByOrganizationId(organizationId: string): Promise<T[]>
}

/**
 * Query options for pagination and sorting
 */
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

/**
 * Paginated result type
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  hasMore: boolean
}
