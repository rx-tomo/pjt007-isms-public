/**
 * Custom error for "not found" cases in service layer.
 * API routes can catch this to return 404 instead of 500.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}
