/**
 * Threat Pattern Library
 *
 * Provides threat pattern definitions and library for offline risk assessment fallback.
 * Supports pattern matching by keywords, filtering by asset type and category,
 * and offline risk estimation.
 *
 * @module lib/ai/knowledgeBase/ThreatPatterns
 */

import { threatPatterns } from './ThreatPatternData'

/**
 * Risk category classification based on CIA triad
 */
export type RiskCategory = 'confidentiality' | 'integrity' | 'availability'

/**
 * Risk level classification for probability and impact assessment
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Represents a security threat pattern with multilingual support
 */
export interface ThreatPattern {
  /** Unique identifier for the threat pattern (e.g., "THREAT-001") */
  id: string
  /** English name of the threat */
  name: string
  /** Japanese name of the threat */
  nameJa: string
  /** English description of the threat */
  description: string
  /** Japanese description of the threat */
  descriptionJa: string
  /** CIA triad category this threat primarily affects */
  category: RiskCategory
  /** Types of assets this threat applies to (e.g., ['database', 'server', 'network']) */
  assetTypes: string[]
  /** Default/typical probability level for this threat */
  defaultProbability: RiskLevel
  /** Default/typical impact level for this threat */
  defaultImpact: RiskLevel
  /** Keywords for matching this threat to descriptions */
  keywords: string[]
  /** Applicable ISO 27001 control IDs (e.g., ["A.8.2", "A.8.3"]) */
  applicableControls: string[]
  /** Suggested mitigations for this threat */
  mitigationSuggestions: string[]
}

/**
 * Represents a match between a description and a threat pattern
 */
export interface ThreatPatternMatch {
  /** The matched threat pattern */
  pattern: ThreatPattern
  /** Confidence score between 0.0 and 1.0 */
  confidence: number
  /** Keywords that matched in the description */
  matchedKeywords: string[]
}

/**
 * Interface for the threat pattern library
 */
export interface ThreatPatternLibrary {
  /**
   * Get a specific pattern by ID
   * @param id - Pattern ID
   * @returns The pattern or null if not found
   */
  getPattern(id: string): ThreatPattern | null

  /**
   * Get all available patterns
   * @returns Array of all threat patterns
   */
  getAllPatterns(): ThreatPattern[]

  /**
   * Get patterns that apply to a specific asset type
   * @param assetType - Asset type to filter by
   * @returns Filtered array of patterns
   */
  getPatternsByAssetType(assetType: string): ThreatPattern[]

  /**
   * Get patterns by risk category
   * @param category - Risk category to filter by
   * @returns Filtered array of patterns
   */
  getPatternsByCategory(category: RiskCategory): ThreatPattern[]

  /**
   * Match patterns to a description using keyword matching
   * @param description - Text description to match against
   * @param locale - Language locale ('ja' or 'en', defaults to 'en')
   * @returns Array of matches sorted by confidence descending
   */
  matchPatterns(description: string, locale?: 'ja' | 'en'): ThreatPatternMatch[]

  /**
   * Estimate risk levels offline based on pattern defaults
   * @param pattern - The threat pattern to estimate risk for
   * @returns Numeric impact and likelihood scores (1-4)
   */
  estimateRiskOffline(pattern: ThreatPattern): { impact: number; likelihood: number }
}

/**
 * Numeric mapping for risk levels
 */
const RISK_LEVEL_SCORES: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
}

/**
 * Japanese keywords mapping for pattern matching
 */
const JAPANESE_KEYWORDS: Record<string, string[]> = {
  'THREAT-001': ['データ漏洩', '不正アクセス', 'ハッキング', '情報漏洩'],
  'THREAT-002': ['内部脅威', '従業員', 'インサイダー'],
  'THREAT-003': ['フィッシング', 'なりすまし', '詐欺メール'],
  'THREAT-004': ['パスワード', '認証情報', 'クレデンシャル'],
  'THREAT-005': ['盗聴', 'スニッフィング', '傍受'],
  'THREAT-006': ['盗難', 'デバイス紛失', '物理的'],
  'THREAT-007': ['クラウド', '設定ミス', '露出'],
  'THREAT-008': ['サードパーティ', 'ベンダー', 'サプライヤー'],
  'THREAT-009': ['データベース', 'DB', '不正アクセス'],
  'THREAT-010': ['APIキー', 'シークレット', 'トークン'],
  'THREAT-011': ['ソーシャルエンジニアリング', '偽装'],
  'THREAT-012': ['ショルダーサーフィン', '覗き見'],
  'THREAT-013': ['廃棄', 'ゴミ箱', '文書破棄'],
  'THREAT-014': ['セッション', 'ハイジャック', '乗っ取り'],
  'THREAT-015': ['プライバシー', '個人情報', '個人データ'],
  'THREAT-016': ['マルウェア', 'ウイルス', 'トロイの木馬', 'ワーム'],
  'THREAT-017': ['SQLインジェクション', 'SQL', 'インジェクション'],
  'THREAT-018': ['中間者', 'MITM', '傍受'],
  'THREAT-019': ['改ざん', 'データ改ざん', '変更'],
  'THREAT-020': ['XSS', 'クロスサイト', 'スクリプト'],
  'THREAT-021': ['コード注入', 'コマンド注入'],
  'THREAT-022': ['サプライチェーン', '依存関係'],
  'THREAT-023': ['設定', '構成変更'],
  'THREAT-024': ['ログ', '監査ログ', 'ログ改ざん'],
  'THREAT-025': ['DNS', 'スプーフィング', 'ポイズニング'],
  'THREAT-026': ['ルートキット', '潜伏'],
  'THREAT-027': ['ファームウェア', 'BIOS', 'UEFI'],
  'THREAT-028': ['CSRF', 'リクエストフォージェリ'],
  'THREAT-029': ['ファイルインクルージョン', 'パス'],
  'THREAT-030': ['不正ソフトウェア', 'シャドーIT'],
  'THREAT-031': ['DDoS', 'サービス拒否', 'DoS', '攻撃'],
  'THREAT-032': ['ランサムウェア', '身代金', '暗号化'],
  'THREAT-033': ['ハードウェア障害', 'ディスク障害', '故障'],
  'THREAT-034': ['停電', '電源', '電力'],
  'THREAT-035': ['自然災害', '地震', '洪水', '火災'],
  'THREAT-036': ['ネットワーク障害', '接続断', '通信障害'],
  'THREAT-037': ['クラッシュ', 'アプリケーション障害', 'バグ'],
  'THREAT-038': ['データベース破損', 'データ破損'],
  'THREAT-039': ['リソース枯渇', 'メモリ不足', 'ディスク容量'],
  'THREAT-040': ['サービス停止', 'クラウド障害'],
  'THREAT-041': ['DNS障害', '名前解決'],
  'THREAT-042': ['証明書期限', 'SSL', 'TLS'],
  'THREAT-043': ['誤削除', 'データ消失', 'ヒューマンエラー'],
  'THREAT-044': ['更新失敗', 'パッチ失敗'],
  'THREAT-045': ['レート制限', 'スロットリング', 'API制限']
}

/**
 * Implementation of the threat pattern library
 */
export class ThreatPatternLibraryImpl implements ThreatPatternLibrary {
  private patterns: ThreatPattern[]

  constructor() {
    this.patterns = threatPatterns
  }

  /**
   * Get a specific pattern by ID
   */
  getPattern(id: string): ThreatPattern | null {
    if (!id || typeof id !== 'string') {
      return null
    }
    return this.patterns.find(p => p.id === id) || null
  }

  /**
   * Get all available patterns
   */
  getAllPatterns(): ThreatPattern[] {
    return [...this.patterns]
  }

  /**
   * Get patterns that apply to a specific asset type
   */
  getPatternsByAssetType(assetType: string): ThreatPattern[] {
    if (!assetType || typeof assetType !== 'string') {
      return []
    }
    const normalizedAssetType = assetType.toLowerCase()
    return this.patterns.filter(p =>
      p.assetTypes.some(at => at.toLowerCase() === normalizedAssetType)
    )
  }

  /**
   * Get patterns by risk category
   */
  getPatternsByCategory(category: RiskCategory): ThreatPattern[] {
    return this.patterns.filter(p => p.category === category)
  }

  /**
   * Match patterns to a description using keyword matching
   */
  matchPatterns(description: string, locale: 'ja' | 'en' = 'en'): ThreatPatternMatch[] {
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return []
    }

    const normalizedDescription = description.toLowerCase()
    const matches: ThreatPatternMatch[] = []

    for (const pattern of this.patterns) {
      const matchResult = this.calculateMatch(pattern, normalizedDescription, locale)
      if (matchResult.confidence > 0) {
        matches.push({
          pattern,
          confidence: matchResult.confidence,
          matchedKeywords: matchResult.matchedKeywords
        })
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence)

    return matches
  }

  /**
   * Calculate match score for a pattern against a description
   */
  private calculateMatch(
    pattern: ThreatPattern,
    normalizedDescription: string,
    locale: 'ja' | 'en'
  ): { confidence: number; matchedKeywords: string[] } {
    const matchedKeywords: string[] = []

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (normalizedDescription.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword)
      }
    }

    // Check Japanese keywords in name and description for Japanese locale
    if (locale === 'ja') {
      // Check if Japanese name matches
      if (normalizedDescription.includes(pattern.nameJa.toLowerCase())) {
        matchedKeywords.push(pattern.nameJa)
      }

      // Check Japanese keywords from mapping
      const japaneseKeywords = JAPANESE_KEYWORDS[pattern.id] || []
      for (const jaKeyword of japaneseKeywords) {
        if (normalizedDescription.includes(jaKeyword.toLowerCase())) {
          if (!matchedKeywords.includes(jaKeyword)) {
            matchedKeywords.push(jaKeyword)
          }
        }
      }
    }

    // Check English name match
    if (normalizedDescription.includes(pattern.name.toLowerCase())) {
      if (!matchedKeywords.includes(pattern.name)) {
        matchedKeywords.push(pattern.name)
      }
    }

    if (matchedKeywords.length === 0) {
      return { confidence: 0, matchedKeywords: [] }
    }

    // Calculate confidence based on number of matched keywords
    // Base confidence starts at 0.3 for single match, increases with more matches
    const baseConfidence = 0.3
    const additionalPerKeyword = 0.15
    const maxConfidence = 1.0

    const confidence = Math.min(
      baseConfidence + (matchedKeywords.length - 1) * additionalPerKeyword,
      maxConfidence
    )

    return { confidence, matchedKeywords }
  }

  /**
   * Estimate risk levels offline based on pattern defaults
   */
  estimateRiskOffline(pattern: ThreatPattern): { impact: number; likelihood: number } {
    return {
      impact: RISK_LEVEL_SCORES[pattern.defaultImpact],
      likelihood: RISK_LEVEL_SCORES[pattern.defaultProbability]
    }
  }
}
