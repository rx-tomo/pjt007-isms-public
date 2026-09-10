import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  organizationInvitations,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import { authUsers } from '@/lib/db/drizzle/schema/auth'

type Db = ReturnType<typeof getDb>

const tenantInvitationRoles = new Set([
  'system_operator',
  'org_admin',
  'auditor',
  'approver',
  'user',
])

type InvitationAcceptanceErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_ACCEPTED'
  | 'EXPIRED'
  | 'EMAIL_MISMATCH'
  | 'FULL_NAME_REQUIRED'
  | 'USER_NOT_FOUND'
  | 'PROFILE_EXISTS'
  | 'INVALID_INVITATION_ROLE'
  | 'INVITATION_CONFLICT'

export class InvitationAcceptanceError extends Error {
  constructor(
    readonly status: number,
    readonly code: InvitationAcceptanceErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'InvitationAcceptanceError'
  }
}

interface AcceptInvitationInput {
  token: string
  userId: string
  authenticatedEmail?: string
  languagePreference: 'ja' | 'en'
  now?: Date
}

/**
 * Grant invitation-derived tenant access atomically.
 *
 * The invitation state and authenticated identity are deliberately re-read in
 * the same transaction that grants access. The accepted_at compare-and-set is
 * performed before inserts; any later profile, membership, or audit failure
 * rolls it back with the rest of the transaction.
 */
export async function acceptInvitationForAuthenticatedUser(
  db: Db,
  input: AcceptInvitationInput
): Promise<{ organizationId: string }> {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()

  return db.transaction(async tx => {
    const [invitation] = await tx
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, input.token))
      .limit(1)

    if (!invitation) {
      throw new InvitationAcceptanceError(404, 'NOT_FOUND', 'Invitation not found')
    }

    if (invitation.acceptedAt) {
      throw new InvitationAcceptanceError(
        409,
        'ALREADY_ACCEPTED',
        'Invitation already accepted'
      )
    }

    const expiresAt = new Date(invitation.expiresAt).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      throw new InvitationAcceptanceError(410, 'EXPIRED', 'Invitation expired')
    }

    if (!tenantInvitationRoles.has(invitation.role)) {
      throw new InvitationAcceptanceError(
        403,
        'INVALID_INVITATION_ROLE',
        'Invitation role is not allowed for a tenant membership'
      )
    }

    const [authUser] = await tx
      .select({ name: authUsers.name, email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, input.userId))
      .limit(1)

    if (!authUser) {
      throw new InvitationAcceptanceError(404, 'USER_NOT_FOUND', 'User not found')
    }

    const authenticatedEmail = input.authenticatedEmail?.trim().toLowerCase()
    const persistedEmail = authUser.email.trim().toLowerCase()
    const invitationEmail = invitation.email.trim().toLowerCase()
    if (
      !authenticatedEmail
      || authenticatedEmail !== persistedEmail
      || persistedEmail !== invitationEmail
    ) {
      throw new InvitationAcceptanceError(409, 'EMAIL_MISMATCH', 'Email mismatch')
    }

    const fullName = authUser.name.trim()
    if (!fullName) {
      throw new InvitationAcceptanceError(
        400,
        'FULL_NAME_REQUIRED',
        'Full name is required'
      )
    }

    const [existingProfileById] = await tx
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, input.userId))
      .limit(1)

    if (existingProfileById) {
      throw new InvitationAcceptanceError(409, 'PROFILE_EXISTS', 'Profile already exists')
    }

    const [existingProfileByEmail] = await tx
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(and(
        eq(userProfiles.organizationId, invitation.organizationId),
        eq(userProfiles.email, invitation.email)
      ))
      .limit(1)

    if (existingProfileByEmail) {
      throw new InvitationAcceptanceError(409, 'PROFILE_EXISTS', 'Profile already exists')
    }

    const claimedInvitations = await tx
      .update(organizationInvitations)
      .set({ acceptedAt: nowIso })
      .where(and(
        eq(organizationInvitations.id, invitation.id),
        eq(organizationInvitations.token, input.token),
        isNull(organizationInvitations.acceptedAt)
      ))
      .returning({ id: organizationInvitations.id })

    if (claimedInvitations.length !== 1) {
      throw new InvitationAcceptanceError(
        409,
        'INVITATION_CONFLICT',
        'Invitation was accepted concurrently'
      )
    }

    await tx.insert(userProfiles).values({
      id: input.userId,
      organizationId: invitation.organizationId,
      email: invitation.email,
      fullName,
      // Global authorization reads profile.role. Invitation roles are tenant
      // scoped and therefore belong only on the membership record.
      role: 'user',
      isActive: true,
      languagePreference: input.languagePreference,
      createdAt: nowIso,
      updatedAt: nowIso,
    })

    await tx.insert(userMemberships).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    })

    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: invitation.organizationId,
      userId: input.userId,
      action: 'invitation.accepted',
      resourceType: 'organization_invitation',
      resourceId: invitation.id,
      changes: JSON.stringify({ accepted_by: input.userId }),
      createdAt: nowIso,
    })

    return { organizationId: invitation.organizationId }
  })
}
