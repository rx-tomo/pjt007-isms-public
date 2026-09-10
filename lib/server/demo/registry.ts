import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'
import type { DemoAuthUser } from '@/lib/server/demo/sessionRotation'
import { publicDemoOrigin, type PublicDemoCatalog, type PublicDemoPersona, type PublicDemoScenario } from '@/lib/demo/contract'
import { getDb } from '@/lib/db/drizzle/client'
import { authUsers } from '@/lib/db/drizzle/schema/auth'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema/users'
import { fixtureManifest, type DemoFixturePersona, type DemoFixtureScenario } from '@/lib/server/demo/fixtureManifest'
import { assertPublicDemoRuntimeReady } from '@/lib/server/demo/publicDemoRuntimeGate'

const UNAVAILABLE_REASON = 'このシナリオは現在利用できません。'

function visibleFixtureManifest(): readonly DemoFixtureScenario[] {
  return publicDemoOrigin()
    ? fixtureManifest.filter((scenario) => scenario.scenarioId.startsWith('practical-'))
    : fixtureManifest
}

type VerifiedPersona = {
  user: DemoAuthUser
}

function toAuthUser(row: {
  userId: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}): DemoAuthUser {
  return {
    id: row.userId,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function verifyPersona(persona: DemoFixturePersona): Promise<VerifiedPersona | null> {
  const db = getDb()
  const [row] = await db
    .select({
      userId: authUsers.id,
      name: authUsers.name,
      email: authUsers.email,
      emailVerified: authUsers.emailVerified,
      image: authUsers.image,
      createdAt: authUsers.createdAt,
      updatedAt: authUsers.updatedAt,
      profileOrganizationId: userProfiles.organizationId,
      profileRole: userProfiles.role,
      membershipOrganizationId: userMemberships.organizationId,
      membershipRole: userMemberships.role,
      organizationId: organizations.id,
    })
    .from(authUsers)
    .innerJoin(
      userProfiles,
      and(
        eq(userProfiles.id, authUsers.id),
        eq(userProfiles.email, persona.email),
        eq(userProfiles.organizationId, persona.organizationId),
        eq(userProfiles.role, persona.role),
        eq(userProfiles.isActive, true),
      ),
    )
    .innerJoin(
      userMemberships,
      and(
        eq(userMemberships.userId, authUsers.id),
        eq(userMemberships.organizationId, persona.organizationId),
        eq(userMemberships.role, persona.role),
        eq(userMemberships.status, 'active'),
      ),
    )
    .innerJoin(
      organizations,
      and(
        eq(organizations.id, persona.organizationId),
        eq(organizations.subscriptionStatus, 'active'),
        eq(organizations.deletionStatus, 'active'),
        isNull(organizations.deletedAt),
      ),
    )
    .where(eq(authUsers.email, persona.email))
    .limit(1)

  if (!row) return null
  if (
    row.email !== persona.email ||
    row.profileOrganizationId !== persona.organizationId ||
    row.membershipOrganizationId !== persona.organizationId ||
    row.profileRole !== persona.role ||
    row.membershipRole !== persona.role ||
    row.organizationId !== persona.organizationId
  ) {
    return null
  }

  return { user: toAuthUser(row) }
}

function publicPersona(persona: DemoFixturePersona): PublicDemoPersona {
  return {
    personaId: persona.personaId,
    role: persona.role,
    displayName: persona.displayName,
    labelKey: persona.labelKey,
    descriptionKey: persona.descriptionKey,
    redirectPath: persona.redirectPath,
  }
}

function publicScenario(
  scenario: DemoFixtureScenario,
  availability: 'ready' | 'unavailable',
  personas: PublicDemoPersona[],
): PublicDemoScenario {
  return {
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    phase: scenario.phase,
    plan: scenario.plan,
    availability,
    ...(availability === 'unavailable'
      ? { unavailableReason: scenario.unavailableReason ?? UNAVAILABLE_REASON }
      : {}),
    personas: availability === 'ready' ? personas : [],
  }
}

function unavailableScenario(scenario: DemoFixtureScenario): PublicDemoScenario {
  return publicScenario(scenario, 'unavailable', [])
}

export function validateDemoManifest(): void {
  const scenarioIds = new Set<string>()
  const personaIds = new Set<string>()

  for (const scenario of fixtureManifest) {
    if (scenarioIds.has(scenario.scenarioId)) throw new Error('duplicate demo scenario alias')
    scenarioIds.add(scenario.scenarioId)
    for (const persona of scenario.personas) {
      if (personaIds.has(persona.personaId)) throw new Error('duplicate demo persona alias')
      personaIds.add(persona.personaId)
    }
  }
}

validateDemoManifest()

export async function buildPublicDemoCatalog(): Promise<PublicDemoCatalog> {
  await assertPublicDemoRuntimeReady()
  const scenarios = await Promise.all(
    visibleFixtureManifest().map(async (scenario) => {
      if (scenario.availability === 'unavailable') return unavailableScenario(scenario)

      const verified = await Promise.all(scenario.personas.map(verifyPersona))
      if (verified.some((entry) => entry === null)) return unavailableScenario(scenario)

      return publicScenario(
        scenario,
        'ready',
        scenario.personas.map(publicPersona),
      )
    }),
  )

  return { catalogVersion: 1, scenarios }
}

type DemoPersonaResolution =
  | { kind: 'unknown' }
  | { kind: 'fixture-conflict' }
  | { kind: 'resolved'; value: VerifiedPersona }

export async function resolveDemoPersona(personaId: string): Promise<DemoPersonaResolution> {
  const entry = visibleFixtureManifest()
    .flatMap((scenario) => scenario.personas.map((persona) => ({ scenario, persona })))
    .find(({ persona }) => persona.personaId === personaId)

  if (!entry || entry.scenario.availability === 'unavailable') return { kind: 'unknown' }

  const verified = await verifyPersona(entry.persona)
  return verified ? { kind: 'resolved', value: verified } : { kind: 'fixture-conflict' }
}
