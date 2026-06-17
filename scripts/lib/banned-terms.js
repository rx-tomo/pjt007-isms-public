#!/usr/bin/env node
/**
 * 禁止用語リスト（共有モジュール）
 *
 * qa-public-copy-boundary.js と qa-submission-bundle-copy.js の両方で参照する。
 * 内部開発用語・旧外部公開用語が成果物に漏れることを防ぐ。
 *
 * 特殊ケース:
 *   - 'auditType' フィールドの値 'surveillance' は正規 ISO 用語のため禁止対象外。
 *   - 禁止しているのは「Surveillance cycle」等の内部フェーズラベルのみ。
 */

const bannedTerms = [
  { term: '実務検証', reason: 'internal development milestone' },
  { term: '検証版', reason: 'internal development milestone' },
  { term: '商用公開前', reason: 'internal development milestone' },
  { term: 'コードから仕様', reason: 'internal development process' },
  { term: 'spec-dsl', reason: 'internal specification map' },
  { term: 'spec DSL', reason: 'internal specification map' },
  { term: 'バイブコーディング', reason: 'internal development process' },
  { term: 'vibe coding', reason: 'internal development process' },
  { term: '開発プロセス', reason: 'internal development process' },
  { term: '審査提出束', reason: 'old external term' },
  { term: '確認用パッケージ', reason: 'old external term' },
  { term: 'Submission Bundle', reason: 'old external term' },
  { term: 'submission bundle', reason: 'old external term' },
  { term: 'Initial cycle', reason: 'internal phase label' },
  { term: 'Surveillance cycle', reason: 'internal phase label' },
]

module.exports = { bannedTerms }
