import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, documents, documentVersions, auditLogs } from '@/lib/db/drizzle/schema'
import { eq, desc } from 'drizzle-orm'

interface VersionPayload {
  title?: string
  description?: string | null
  fileName?: string | null
  filePath?: string | null
  fileSize?: number | null
  changes?: string | null
  userId?: string
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const documentId = params.id
  if (!documentId) {
    return applyCookies(NextResponse.json({ error: 'Document ID is required' }, { status: 400 }))
  }

  let payload: VersionPayload
  try {
    payload = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }))
  }

  if (!payload.title) {
    return applyCookies(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
  }

  const db = getDb()

  // Get document to get organization_id and verify user belongs to the same org
  const [document] = await db
    .select({ organizationId: documents.organizationId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!document) {
    return applyCookies(NextResponse.json({ error: 'Document not found' }, { status: 404 }))
  }

  // Verify user belongs to the document's organization
  const [profile] = await db
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId || profile.organizationId !== document.organizationId) {
    return applyCookies(NextResponse.json({ error: 'Organization mismatch' }, { status: 403 }))
  }

  const [latestVersion] = await db
    .select({ versionNumber: documentVersions.versionNumber })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber))
    .limit(1)

  const nextVersion = (latestVersion?.versionNumber ?? 0) + 1
  const now = new Date().toISOString()

  try {
    await db.insert(documentVersions).values({
      id: crypto.randomUUID(),
      documentId: documentId,
      versionNumber: nextVersion,
      title: payload.title,
      description: payload.description ?? null,
      fileName: payload.fileName ?? null,
      filePath: payload.filePath ?? null,
      fileSize: payload.fileSize ?? null,
      changes: payload.changes ?? null,
      createdBy: user.id,
      createdAt: now,
    })
  } catch (insertError) {
    console.error('Failed to insert document version', insertError)
    return applyCookies(NextResponse.json({ error: 'Failed to create document version' }, { status: 500 }))
  }

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: document.organizationId ?? '',
      userId: user.id,
      action: 'document.version_created',
      resourceType: 'document',
      resourceId: documentId,
      changes: JSON.stringify({
        version_number: nextVersion,
        file_path: payload.filePath ?? null
      }),
      createdAt: now,
    })
  } catch (auditError) {
    console.error('Failed to insert audit log for document version', auditError)
  }

  return applyCookies(NextResponse.json({ data: { version_number: nextVersion } }))
}
