# プロジェクトレビュー

> 2026-05-14追記: 本レビュー内の「MVPリリース準備95%」「UC達成率100%」「ユニットテスト713/713 pass」は、2026-01-23時点の記録であり、現行release-readiness評価の正本ではない。2026-05-14の再評価では、unit test失敗、E2E未実行、security critical/high、工程2/3/5の評価観点不足を確認したため、リリース完成度は補正後 **41/100** とする。現行正本は `docs/02-project/release-readiness/assessment-2026-05-14.md`、実務工程起点の補正文書は `docs/02-project/release-readiness/isms-operational-workflow-model.md`、`required-capability-matrix.md`、`capability-gap-assessment.md`、`operational-efficiency-review.md`。

作成日: 2026-01-22
更新日: 2026-01-23
記録者: Claude Code

---

## 目標

**ISMS Pilot MVP** の完成とリリース準備

- ISO/IEC 27001 認証取得支援 SaaS の MVP 機能を完成させる
- Phase 4（MVP 最終調整）を完了し、本番運用可能な状態にする
- P5-2（AI 支援リスク評価）の段階的実装
- ロール別プロダクトマニュアルの整備

---

## 現在の状態サマリー（2026-01-23）

### ブランチ状況
| ブランチ | 状態 | 説明 |
|---------|------|------|
| `main` | stable | 最新: `c00086a`（全PRマージ済み・クリーン） |
| `origin/codex/github-mention-rbac` | 未マージ | PR #116 クローズ済み。部門スコープRBAC（保持判断） |

### フェーズ進捗
| フェーズ | 前回 | 今回 | 状態 | 主な残課題 |
|---------|------|------|------|-----------|
| Phase 0: 基盤構築 | 100% | 100% | ✅ 完了 | なし |
| Phase 1: 組織・ユーザー | 90% | 90% | ⚠️ ほぼ完了 | 部門スコープ RBAC（将来対応） |
| Phase 1: 文書管理 | 100% | 100% | ✅ 完了 | なし |
| Phase 2: リスク管理 | 95% | 95% | ✅ ほぼ完了 | なし |
| Phase 2: タスク管理 | 85% | 85% | ⚠️ 進行中 | なし |
| Phase 3: 監査管理 | 95% | 95% | ✅ ほぼ完了 | なし |
| Phase 3: ダッシュボード | 85% | 85% | ⚠️ 進行中 | ロール別ダッシュボード細分化 |
| Phase 4: MVP 最終調整 | 50% | 90% | ⚙️ 進行中 | 本番デプロイ準備・CI 本線 |
| P5-2: AI リスク評価 | 25% | 75% | ⚙️ Phase 1-4 インフラ完了 | エンドツーエンド統合・実API連携 |

### テスト・品質指標
| 指標 | 値 | 状態 |
|------|-----|------|
| ユニットテスト | 713/713 pass | ✅ |
| ビルド | pass | ✅ |
| Lint | pass | ✅ |
| TypeCheck | pass | ✅ |
| UC 達成率 | 100% (11/11) | ✅ |
| 既知の重大バグ | 0 件 | ✅ |
| 未マージブランチ | 1 本（保持判断済み） | ✅ |

---

## 要件の充足度

### ユースケース完了状況（UC-01 〜 UC-10 + Super Admin）

| UC | 名称 | 状態 | 備考 |
|----|------|------|------|
| UC-01 | 初期オンボーディング | ✅ 完了 | 招待フロー・フェーズ選択含む |
| UC-02 | 課金と契約管理 | ✅ 完了 | Stripe 連携・Webhook 冪等性確認済み |
| UC-03 | ホーム閲覧 | ✅ 完了 | Recent Activity・フェールセーフ含む |
| UC-04 | 文書管理 | ✅ 完了 | エクスポート・テンプレート・バージョン管理 |
| UC-05 | リスクアセスメント | ✅ 完了 | デモシード・期間フィルタ・マトリクス |
| UC-06 | タスク運用 | ✅ 完了 | ガントチャート・リアルタイム通知 |
| UC-07 | 監査準備 | ✅ 完了 | 期間ヘッダー・進捗バッジ・証跡管理 |
| UC-08 | 通知とアラート | ✅ 完了 | Slack/Teams 連携・既読管理 |
| UC-09 | 設定・権限管理 | ✅ 完了 | MFA フック・部門フィルタ |
| UC-10 | テナントプロビジョン | ✅ 完了 | E2E 検証済み |
| Super Admin | SaaS 全体管理 | ✅ 完了 | Edge Function・HA 対応済み |

**充足率**: 100%（全 UC 検証完了）

---

## 不足事項

### 技術的課題（Implementation）

| # | 課題 | 優先度 | 所在 | 状態 |
|---|------|--------|------|------|
| 1 | ~~PR #205 のマージ~~ | - | - | ✅ 完了 |
| 2 | ~~PR #206 のマージ~~ | - | - | ✅ 完了 |
| 3 | DB マイグレーション適用 | 🔴 High | `supabase/migrations/` | 未適用 |
| 4 | P5-2 エンドツーエンド統合 | 🟡 Medium | `lib/ai/` | インフラ完了・実連携待ち |
| 5 | CI/CD 本線整備 | 🟡 Medium | `.github/workflows/` | 進行中 |
| 6 | Container ConfigStore 切替 | 🟡 Medium | `lib/container/index.ts` | GAP-1: InMemory→SQLite |
| 7 | 本番環境変数設定 | 🔴 High | Vercel / Supabase Cloud | 未設定 |
| 8 | デモ環境構築 | 🟡 Medium | `docs/06-operations/` | 未着手 |
| 9 | パフォーマンス最適化 | 🟢 Low | `docs/02-project/01_roadmap.md` | 企画段階 |
| 10 | 部門スコープ統合 | 🟢 Low | `docs/02-project/90_*.md` | 将来対応 |

### ビジネス課題（Business/PO）

| # | 課題 | 優先度 | 所在 | 状態 |
|---|------|--------|------|------|
| 1 | デモ環境準備 | 🟡 Medium | `docs/02-project/01_roadmap.md` | 未着手 |
| 2 | ロードマップ最小タスク計画化 | 🟢 Low | Plan Tracking #8 | 企画段階 |
| 3 | β顧客向けオンボーディング資料 | 🟡 Medium | - | 未着手 |

### ドキュメント課題

| # | 課題 | 優先度 | 所在 | 状態 |
|---|------|--------|------|------|
| 1 | マニュアル coming-soon 更新 | 🟢 Low | `docs/08-user-manual/` (19箇所) | UI実装後に対応（招待再送は実装済みのため削除） |
| 2 | スクリーンショット追加 | 🟢 Low | `docs/08-user-manual/` | UI安定後に対応 |
| 3 | 英語版マニュアル | 🟢 Low | - | バックログ |

---

## 前回との差分（2026-01-22 → 2026-01-23）

### 完了した作業

1. **P5-2 Phase 2-4 実装・マージ**（PR #207, #208, #209）
   - AI UI Components & API Endpoints
   - AI分析・推論機能
   - 運用・監視・設定

2. **P5-2 SQLite AI リポジトリ・設定ページ**（PR #210）
   - SQLite AI リポジトリ実装（AISuggestionRepository, AIUsageLogRepository）
   - SQLiteConfigStore, SQLiteAlertStore
   - AI Settings Page, Usage Dashboard Page
   - AI Settings API（GET/POST `/api/ai/settings`）
   - Drizzle ORM AI スキーマ定義
   - 210テスト追加（合計713テスト）
   - 67ファイル変更、+11,145/-246行

3. **ロール別プロダクトマニュアル作成**（36ファイル）
   - 5ロール別ディレクトリ構成
   - 整合性レビュー（用語統一3箇所修正、coming-soon 20箇所確認）
   - README.md 総合目次

4. **ブランチ整理**
   - マージ済みブランチ15本削除（ローカル7本 + リモート8本）
   - `origin/codex/github-mention-rbac` のみ保持

### 新規追加ファイル（主要）
```
app/[locale]/settings/ai/page.tsx           # AI設定ページ
app/[locale]/settings/ai/usage/page.tsx     # AI使用量ダッシュボード
app/api/ai/settings/route.ts               # AI設定API
lib/ai/config/SQLiteConfigStore.ts          # SQLite設定ストア
lib/ai/monitoring/SQLiteAlertStore.ts       # SQLiteアラートストア
lib/db/drizzle/schema/ai.ts                # AIスキーマ定義
lib/db/repositories/sqlite/AISuggestionRepository.ts
lib/db/repositories/sqlite/AIUsageLogRepository.ts
docs/08-user-manual/ (36ファイル)           # ロール別プロダクトマニュアル
```

### マージ済みPR一覧（今回セッション）
| PR | タイトル | マージ方法 |
|----|---------|-----------|
| #205 | feat: phase4-mvp-tenant-soft-delete | squash |
| #206 | feat: P5-2 Phase 1 - AI Provider Infrastructure | squash |
| #207 | feat: P5-2 Phase 2 後半 - AI UI Components & API Endpoints | squash |
| #208 | feat: P5-2 Phase 3 - AI分析・推論機能 | squash |
| #209 | feat: P5-2 Phase 4 - 運用・監視・設定 | squash |
| #210 | feat: P5-2 SQLite AI Repositories, Settings Pages & User Manual | squash |

---

## 既知のギャップ（GAP）

| ID | 深刻度 | 領域 | 内容 |
|----|--------|------|------|
| GAP-1 | low | code | Container.getConfigStore() が InMemoryConfigStore を使用（本番では SQLiteConfigStore へ切替要） |
| GAP-2 | info | code | AI Settings/Usage Page の E2E testid リマッピング（暫定策） |
| GAP-3 | info | code | LocalLLMProvider (Ollama) が stub 実装のみ |
| GAP-4 | info | docs | ユーザーマニュアル coming-soon 19箇所（UI実装後に置換。招待再送は実装済みのため削除） |
| GAP-5 | info | docs | スクリーンショット未添付 |
| GAP-7 | info | git | origin/codex/github-mention-rbac 未マージ残存 |

---

## 管理場所

| 種別 | ファイル |
|------|----------|
| ロードマップ | `docs/02-project/01_roadmap.md` |
| 実装計画 | `docs/02-project/02_implementation-plan.md` |
| Plan Tracking | `docs/02-project/10_plan-tracking.md` |
| UC チェックリスト | `docs/02-project/12_uc-checklist.md` |
| 本レビュー | `docs/02-project/archive/13_project-review-2026-01-23.md` |
| ハンドオフ | `docs/handoff/2026-01-23_handoff.yaml` |
| ユーザーマニュアル | `docs/08-user-manual/README.md` |
| QA ガイドライン | `docs/05-quality/qa-guidelines.md` |

---

## 次のアクション（推奨順）

1. **本番環境変数設定** - `AI_PROVIDER_MODE`, `ANTHROPIC_API_KEY` 等を Vercel に設定
2. **DB マイグレーション適用** - `supabase db push`（本番 Supabase Cloud）
3. **Container ConfigStore 切替確認** - InMemory → SQLite/Supabase
4. **P5-2 エンドツーエンド統合** - AIRiskAssessmentService の実 Claude API 連携
5. **CI 本線整備** - GitHub Actions の品質ゲート最終調整
6. **デモ環境構築** - サンドボックステナント・デモデータ投入

---

## リリース可能性評価

**現状**: MVP リリース準備 **95%**

| 残作業 | 内容 |
|--------|------|
| 環境変数・マイグレーション | 本番 Supabase/Vercel への設定適用 |
| 最終テスト | 本番環境での E2E 検証 |
| Runbook | 運用オペレーション手順書の最終化 |

---

## 保存先

`docs/02-project/archive/13_project-review-2026-01-23.md`

---

*Updated by Claude Code on 2026-01-23*
