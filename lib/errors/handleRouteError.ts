import { NextResponse } from 'next/server'
import { NotFoundError } from './NotFoundError'

/**
 * Standard error handler for API routes.
 * Returns 404 for NotFoundError, 500 with generic message for everything else.
 */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  console.error('API route error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
