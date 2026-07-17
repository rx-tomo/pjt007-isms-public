/**
 * Local Storage File Serving API Route
 *
 * Serves files from `.storage/` directory for LocalFSStorageProvider.
 * Supports optional signed URL token validation.
 *
 * GET /api/storage/:bucket/:path
 */
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  createStorageDownloadHeaders,
  resolveStorageRoutePath,
} from '@/lib/storage/storageRoutePolicy'
import { isGenericDocumentStoragePathDenied } from '@/lib/storage/documentFilePolicy'

const STORAGE_ROOT = path.resolve(
  process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), '.storage')
)

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const pathSegments = params.path
  if (
    isGenericDocumentStoragePathDenied(pathSegments)
    || pathSegments?.[0] === 'task-attachments'
  ) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // ストレージは現状 LocalFSStorageProvider 固定のため、非本番では既定で配信を許可する。
  // 本番は STORAGE_MODE=local を明示した場合のみ（外部ストレージ移行時の閉塞用ガード）
  const storageMode =
    process.env.STORAGE_MODE || (process.env.NODE_ENV !== 'production' ? 'local' : '')
  if (storageMode !== 'local') {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }

  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json(
      { error: 'Invalid storage path' },
      { status: 400 }
    )
  }

  // Validate signed URL token if present
  const token = request.nextUrl.searchParams.get('token')
  const expires = request.nextUrl.searchParams.get('expires')

  // Signed URL token validation (required when STORAGE_SIGNING_KEY is configured)
  const signingKey = process.env.STORAGE_SIGNING_KEY
  if (!signingKey && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Storage temporarily unavailable' },
      { status: 503 }
    )
  }

  if (token && expires) {
    const expiresNum = parseInt(expires, 10)
    if (Date.now() > expiresNum) {
      return NextResponse.json(
        { error: 'Signed URL has expired' },
        { status: 403 }
      )
    }

    const filePath = pathSegments.join('/')
    const expectedToken = crypto
      .createHmac('sha256', signingKey || 'local-dev-key')
      .update(`${filePath}:${expires}`)
      .digest('hex')

    if (token !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid signed URL token' },
        { status: 403 }
      )
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Production: unsigned requests are rejected
    return NextResponse.json(
      { error: 'Signed URL token is required' },
      { status: 401 }
    )
  }

  // Resolve and validate file path (prevent directory traversal)
  // Use separator boundary to block sibling-prefix directories (e.g. .storage-evil)
  const resolvedPath = resolveStorageRoutePath(pathSegments, STORAGE_ROOT)
  if (!resolvedPath) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    )
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }

  const fileBuffer = fs.readFileSync(resolvedPath)
  return new NextResponse(fileBuffer, {
    headers: createStorageDownloadHeaders(resolvedPath),
  })
}
