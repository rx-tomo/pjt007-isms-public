/**
 * ISMS Knowledge Base Module Exports
 */

export {
  IsmsKnowledgeBaseImpl,
  type IsmsKnowledgeBase,
  type IsoControl
} from './IsmsKnowledgeBase'

export { ISO_CONTROLS } from './IsmsControlData'

export {
  ThreatPatternLibraryImpl,
  type ThreatPatternLibrary,
  type ThreatPattern,
  type ThreatPatternMatch,
  type RiskCategory,
  type RiskLevel
} from './ThreatPatterns'

export { threatPatterns } from './ThreatPatternData'
