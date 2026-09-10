import type { RiskWithRelations } from '@/lib/db/repositories/interfaces/IRiskRepository'
import type { EffectiveCapabilities } from '@/lib/server/auth/actionPolicy'

type RiskTreatment = NonNullable<RiskWithRelations['treatments']>[number]

export type ProjectedRisk = Omit<RiskWithRelations, 'assets' | 'treatments'> & {
  assets?: RiskWithRelations['assets']
  treatments?: Array<
    Omit<RiskTreatment, 'control_links'>
    & { control_links?: RiskTreatment['control_links'] }
  >
}

export function projectRiskForCapabilities(
  risk: RiskWithRelations,
  capabilities: EffectiveCapabilities
): ProjectedRisk {
  const { assets, treatments, ...base } = risk
  const projectedTreatments = treatments?.map(treatment => {
    if (capabilities.modules.controls.read) return treatment
    const { control_links: _controlLinks, ...projected } = treatment
    return projected
  })

  return {
    ...base,
    ...(capabilities.modules.assets.read ? { assets } : {}),
    ...(treatments === undefined ? {} : { treatments: projectedTreatments }),
  }
}
