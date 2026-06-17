/**
 * ISMS Knowledge Base Interface and Implementation
 *
 * ISO 27001:2022 Annex A control data for offline risk assessment fallback.
 * Provides local knowledge base without requiring external AI calls.
 */

import { ISO_CONTROLS } from './IsmsControlData'

/**
 * ISO 27001:2022 Annex A Control Interface
 */
export interface IsoControl {
  /** Control identifier (e.g., "A.5.1") */
  id: string
  /** English title */
  title: string
  /** Japanese title */
  titleJa: string
  /** English description */
  description: string
  /** Japanese description */
  descriptionJa: string
  /** Control category: Organizational, People, Physical, Technological */
  category: 'Organizational' | 'People' | 'Physical' | 'Technological'
  /** Subcategory within the main category */
  subcategory: string
  /** Asset types this control applies to */
  applicability: string[]
  /** Implementation guidance steps */
  implementationGuidance: string[]
  /** Common threats this control addresses */
  commonThreats: string[]
  /** Common vulnerabilities this control mitigates */
  commonVulnerabilities: string[]
}

/**
 * ISMS Knowledge Base Interface
 */
export interface IsmsKnowledgeBase {
  /**
   * Get a specific control by its ID
   * @param id Control identifier (e.g., "A.5.1")
   * @returns The control or null if not found
   */
  getControl(id: string): IsoControl | null

  /**
   * Get all controls in the knowledge base
   * @returns Array of all controls
   */
  getAllControls(): IsoControl[]

  /**
   * Search controls by keyword
   * @param query Search query
   * @param locale Language locale ('ja' or 'en')
   * @returns Array of matching controls
   */
  searchControls(query: string, locale?: 'ja' | 'en'): IsoControl[]

  /**
   * Get controls filtered by category
   * @param category Control category
   * @returns Array of controls in the category
   */
  getControlsByCategory(category: string): IsoControl[]

  /**
   * Get controls that address a specific threat
   * @param threatKeyword Threat keyword to search
   * @returns Array of relevant controls
   */
  getControlsByThreat(threatKeyword: string): IsoControl[]

  /**
   * Get suggested controls based on asset type and threats
   * @param assetType Type of asset
   * @param threats Array of threat keywords
   * @returns Array of suggested controls
   */
  getSuggestedControls(assetType: string, threats: string[]): IsoControl[]
}

/**
 * ISMS Knowledge Base Implementation
 *
 * In-memory implementation using static control data.
 */
export class IsmsKnowledgeBaseImpl implements IsmsKnowledgeBase {
  private controls: Map<string, IsoControl>

  constructor() {
    this.controls = new Map()
    ISO_CONTROLS.forEach(control => {
      this.controls.set(control.id, control)
    })
  }

  getControl(id: string): IsoControl | null {
    if (!id || id === 'undefined') {
      return null
    }
    return this.controls.get(id) ?? null
  }

  getAllControls(): IsoControl[] {
    return Array.from(this.controls.values())
  }

  searchControls(query: string, locale: 'ja' | 'en' = 'en'): IsoControl[] {
    if (!query) {
      return []
    }

    const normalizedQuery = query.toLowerCase()

    return this.getAllControls().filter(control => {
      if (locale === 'ja') {
        return (
          control.titleJa.includes(query) ||
          control.descriptionJa.includes(query) ||
          control.title.toLowerCase().includes(normalizedQuery) ||
          control.description.toLowerCase().includes(normalizedQuery)
        )
      }
      return (
        control.title.toLowerCase().includes(normalizedQuery) ||
        control.description.toLowerCase().includes(normalizedQuery)
      )
    })
  }

  getControlsByCategory(category: string): IsoControl[] {
    return this.getAllControls().filter(control => control.category === category)
  }

  getControlsByThreat(threatKeyword: string): IsoControl[] {
    if (!threatKeyword) {
      return []
    }

    const normalizedKeyword = threatKeyword.toLowerCase()

    return this.getAllControls().filter(control =>
      control.commonThreats.some(threat =>
        threat.toLowerCase().includes(normalizedKeyword)
      )
    )
  }

  getSuggestedControls(assetType: string, threats: string[]): IsoControl[] {
    const controlSet = new Map<string, IsoControl>()
    const normalizedAssetType = assetType.toLowerCase()

    // Get controls by applicability (asset type)
    this.getAllControls().forEach(control => {
      const matchesAsset = control.applicability.some(
        app => app.toLowerCase().includes(normalizedAssetType) ||
               normalizedAssetType.includes(app.toLowerCase())
      )
      if (matchesAsset) {
        controlSet.set(control.id, control)
      }
    })

    // Get controls by threats
    threats.forEach(threat => {
      const threatControls = this.getControlsByThreat(threat)
      threatControls.forEach(control => {
        controlSet.set(control.id, control)
      })
    })

    return Array.from(controlSet.values())
  }
}
