import 'server-only'

import type { DemoPhase, DemoRole } from '@/lib/demo/contract'

export interface DemoFixturePersona {
  personaId: string
  role: DemoRole
  displayName: string
  email: string
  organizationId: string
  labelKey: string
  descriptionKey: string
  redirectPath: string
}

export interface DemoFixtureScenario {
  scenarioId: string
  title: string
  phase: DemoPhase
  plan: string
  organizationId: string
  availability: 'ready' | 'unavailable'
  unavailableReason?: string
  personas: readonly DemoFixturePersona[]
}

const persona = (
  personaId: string,
  role: DemoRole,
  displayName: string,
  email: string,
  organizationId: string,
): DemoFixturePersona => ({
  personaId,
  role,
  displayName,
  email,
  organizationId,
  labelKey: `roles.${role}.name`,
  descriptionKey: `roles.${role}.summary`,
  redirectPath: '/home',
})

export const fixtureManifest: readonly DemoFixtureScenario[] = [
  {
    scenarioId: 'standard-manufacturing',
    title: 'Dev Manufacturing 株式会社',
    phase: 'initial',
    plan: 'standard',
    organizationId: '22222222-2222-4222-8222-222222222222',
    availability: 'ready',
    personas: [
      persona('standard-manufacturing-system-operator', 'system_operator', '山田太郎', 'yamada@riscala-isms.local', '22222222-2222-4222-8222-222222222222'),
      persona('standard-manufacturing-org-admin', 'org_admin', '田中花子', 'tanaka@dev-mfg.local', '22222222-2222-4222-8222-222222222222'),
      persona('standard-manufacturing-approver', 'approver', '佐藤美咲', 'sato@dev-mfg.local', '22222222-2222-4222-8222-222222222222'),
      persona('standard-manufacturing-auditor', 'auditor', '松本理恵', 'matsumoto@dev-mfg.local', '22222222-2222-4222-8222-222222222222'),
      persona('standard-manufacturing-user', 'user', '鈴木一郎', 'suzuki@dev-mfg.local', '22222222-2222-4222-8222-222222222222'),
    ],
  },
  {
    scenarioId: 'standard-solutions',
    title: 'Dev Solutions 株式会社',
    phase: 'initial',
    plan: 'starter',
    organizationId: '33333333-3333-4333-8333-333333333333',
    availability: 'ready',
    personas: [
      persona('standard-solutions-org-admin', 'org_admin', '山本健太', 'yamamoto@dev-solutions.local', '33333333-3333-4333-8333-333333333333'),
      persona('standard-solutions-user', 'user', '林誠一', 'hayashi@dev-solutions.local', '33333333-3333-4333-8333-333333333333'),
    ],
  },
  {
    scenarioId: 'practical-initial',
    title: '初回登録準備モデル株式会社',
    phase: 'initial',
    plan: 'trial',
    organizationId: '70000000-0000-4000-8000-000000000001',
    availability: 'ready',
    personas: [
      persona('practical-initial-system-operator', 'system_operator', 'Riscala AI for ISMS システム運営者', 'operator.practical@isms-practical.local', '70000000-0000-4000-8000-000000000001'),
      persona('practical-initial-org-admin-ciso', 'org_admin', '佐藤真理', 'sato.initial@isms-practical.local', '70000000-0000-4000-8000-000000000001'),
      persona('practical-initial-org-admin-secretariat', 'org_admin', '田中航', 'tanaka.initial@isms-practical.local', '70000000-0000-4000-8000-000000000001'),
      persona('practical-initial-approver', 'approver', '鈴木玲奈', 'suzuki.initial@isms-practical.local', '70000000-0000-4000-8000-000000000001'),
      persona('practical-initial-auditor', 'auditor', '松本結衣', 'matsumoto.initial@isms-practical.local', '70000000-0000-4000-8000-000000000001'),
      persona('practical-initial-user', 'user', '高橋誠', 'takahashi.initial@isms-practical.local', '70000000-0000-4000-8000-000000000001'),
    ],
  },
  {
    scenarioId: 'practical-surveillance',
    title: '継続運用モデル株式会社',
    phase: 'surveillance',
    plan: 'standard',
    organizationId: '70000000-0000-4000-8000-000000000002',
    availability: 'ready',
    personas: [
      persona('practical-surveillance-org-admin-ciso', 'org_admin', '山本彩', 'yamamoto.surveillance@isms-practical.local', '70000000-0000-4000-8000-000000000002'),
      persona('practical-surveillance-org-admin-secretariat', 'org_admin', '井上拓', 'inoue.surveillance@isms-practical.local', '70000000-0000-4000-8000-000000000002'),
      persona('practical-surveillance-auditor', 'auditor', '中村凛', 'nakamura.surveillance@isms-practical.local', '70000000-0000-4000-8000-000000000002'),
      persona('practical-surveillance-approver', 'approver', '小林優', 'kobayashi.surveillance@isms-practical.local', '70000000-0000-4000-8000-000000000002'),
      persona('practical-surveillance-user', 'user', '伊藤悠', 'ito.surveillance@isms-practical.local', '70000000-0000-4000-8000-000000000002'),
    ],
  },
  {
    scenarioId: 'practical-enterprise',
    title: '製造委託管理モデル株式会社',
    phase: 'surveillance',
    plan: 'enterprise',
    organizationId: '70000000-0000-4000-8000-000000000003',
    availability: 'ready',
    personas: [
      persona('practical-enterprise-org-admin-ciso', 'org_admin', '森田直子', 'morita.enterprise@isms-practical.local', '70000000-0000-4000-8000-000000000003'),
      persona('practical-enterprise-org-admin-secretariat', 'org_admin', '加藤大地', 'kato.enterprise@isms-practical.local', '70000000-0000-4000-8000-000000000003'),
      persona('practical-enterprise-auditor', 'auditor', '石川葵', 'ishikawa.enterprise@isms-practical.local', '70000000-0000-4000-8000-000000000003'),
      persona('practical-enterprise-approver', 'approver', '藤井健', 'fujii.enterprise@isms-practical.local', '70000000-0000-4000-8000-000000000003'),
      persona('practical-enterprise-user', 'user', '長谷川亮', 'hasegawa.enterprise@isms-practical.local', '70000000-0000-4000-8000-000000000003'),
    ],
  },
  {
    scenarioId: 'practical-suspended',
    title: '休止中モデル株式会社',
    phase: 'initial',
    plan: 'starter',
    organizationId: '70000000-0000-4000-8000-000000000004',
    availability: 'unavailable',
    unavailableReason: 'このシナリオは現在利用できません。',
    personas: [],
  },
]

export function validateDemoFixtureManifest(manifest: readonly DemoFixtureScenario[] = fixtureManifest): void {
  const scenarioIds = new Set<string>()
  const personaIds = new Set<string>()
  const scenarioCounts = { standard: 0, practical: 0 }

  for (const scenario of manifest) {
    if (!/^[a-z0-9-]+$/.test(scenario.scenarioId) || scenarioIds.has(scenario.scenarioId)) {
      throw new Error('invalid demo fixture scenario alias')
    }
    scenarioIds.add(scenario.scenarioId)
    if (scenario.scenarioId.startsWith('standard-')) scenarioCounts.standard += 1
    if (scenario.scenarioId.startsWith('practical-')) scenarioCounts.practical += 1
    if (scenario.availability === 'unavailable' && scenario.personas.length > 0) {
      throw new Error('unavailable demo fixture cannot expose personas')
    }
    if (scenario.availability === 'ready' && scenario.personas.length === 0) {
      throw new Error('ready demo fixture must declare personas')
    }

    for (const personaEntry of scenario.personas) {
      if (!/^[a-z0-9-]+$/.test(personaEntry.personaId) || personaIds.has(personaEntry.personaId)) {
        throw new Error('invalid demo fixture persona alias')
      }
      if (personaEntry.organizationId !== scenario.organizationId || !/^[^@\s]+@[^@\s]+$/.test(personaEntry.email)) {
        throw new Error('invalid demo fixture persona binding')
      }
      personaIds.add(personaEntry.personaId)
    }
  }

  if (scenarioCounts.standard !== 2 || scenarioCounts.practical !== 4) {
    throw new Error('incomplete demo fixture coverage')
  }
}

validateDemoFixtureManifest()
