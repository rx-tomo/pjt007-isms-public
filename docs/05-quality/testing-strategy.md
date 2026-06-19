> 作成日: 2025-11-01
> 更新日: 2025-12-09
> 記録者: Codex

# テスト戦略

> **参照元**: qa-guidelines.md と連携し、本ドキュメントはテスト全体の構造と設計方針を定義

## 概要

本ドキュメントはRiscala AI for ISMSのテスト戦略を定義します。テストは以下の3層で構成されます:

| レイヤー | 目的 | 実行タイミング | ツール |
|---------|------|---------------|--------|
| Unit | ビジネスロジック・ユーティリティの検証 | 常時/CI | Node Test Runner |
| Feature E2E | 機能単位の動作検証 | 常時/CI | Playwright |
| Journey | ユーザーストーリー・ビジネスフロー全体の検証 | CI/手動 | Playwright |

## ディレクトリ構成

```
tests/
├── unit/                      # Unit テスト
│   ├── risk-gap-analysis.test.ts
│   ├── task-export.test.ts
│   ├── audit-report-pdf.test.ts
│   ├── audit-progress-status.test.ts
│   ├── risk-excel-export.test.ts
│   ├── super-admin-config.test.ts
│   └── project-structure-summary.test.ts
├── e2e/                       # Feature E2E テスト
│   ├── *.spec.ts              # 機能別テスト
│   ├── journeys/              # Journey テスト（ビジネスフロー全体）
│   │   ├── full-isms-cycle.spec.ts          # ISMS認証サイクル一気通貫
│   │   ├── multi-user-approval.spec.ts      # 複数ユーザー承認フロー
│   │   ├── super-admin-journeys.spec.ts     # SA-01〜SA-10
│   │   ├── org-admin-journeys.spec.ts       # OA-01〜OA-10
│   │   ├── system-operator-journeys.spec.ts # SO-01〜SO-10
│   │   ├── user-lifecycle.spec.ts           # ユーザーライフサイクル
│   │   ├── audit-corrective-action-journey.spec.ts  # 是正措置ワークフロー
│   │   ├── risk-lifecycle-journey.spec.ts   # リスクライフサイクル
│   │   ├── document-revision-journey.spec.ts # 文書改訂フロー
│   │   ├── notification-reminder-journey.spec.ts    # 通知・リマインダー
│   │   ├── employee-daily-workflow-journey.spec.ts  # EMPLOYEE日常ワークフロー
│   │   └── boundary-conditions-journey.spec.ts      # 境界条件・エッジケース
│   └── utils/
│       └── test-helpers.ts    # 共通ヘルパー

scripts/
├── qa-*.js                    # CLI QA スクリプト
├── test-*.js                  # 品質テストスクリプト
```

## 各テストレイヤーの詳細

### 1. Unit テスト

**目的**: 純粋なビジネスロジック・ユーティリティ関数の検証

**配置**: `tests/unit/`

**対象**:
- リスク分析ロジック (`risk-gap-analysis.test.ts`)
- タスクエクスポート (`task-export.test.ts`)
- 監査レポートPDF生成 (`audit-report-pdf.test.ts`)
- 監査進捗ステータス (`audit-progress-status.test.ts`)
- リスクExcelエクスポート (`risk-excel-export.test.ts`)
- スーパー管理者設定 (`super-admin-config.test.ts`)

**実行**:
```bash
npm run test:unit              # 全Unit テスト実行（ビルド→実行→クリーン）
```

### 2. Feature E2E テスト

**目的**: 機能単位での動作検証。UIコンポーネント、ナビゲーション、RBAC

**配置**: `tests/e2e/*.spec.ts`

**命名規則**: `{機能名}.spec.ts` または `{uc-id}.spec.ts`

**対象例**:
- `rbac-matrix.spec.ts` - ロールベースアクセス制御マトリクス
- `settings-toast.spec.ts` - 設定画面トースト
- `documents-new.spec.ts` - 新規文書作成
- `documents-upload-download.spec.ts` - 文書アップロード・ダウンロード
- `risks.spec.ts` - リスク管理
- `risks-matrix.spec.ts` - リスクマトリクス
- `tasks.spec.ts` - タスク管理
- `audit-walkthrough.spec.ts` - 監査ウォークスルー
- `audit-progress.spec.ts` - 監査進捗
- `audit-reports.spec.ts` - 監査レポート
- `super-admin.spec.ts` - スーパー管理者機能
- `super-admin-users.spec.ts` - スーパー管理者ユーザー管理
- `tenant-provision.spec.ts` - テナントプロビジョニング
- `tenant-import.spec.ts` - テナントインポート
- `auth-mfa.spec.ts` - MFA認証
- `invite-acceptance.spec.ts` - 招待受諾
- `home-*.spec.ts` - ホーム画面関連

**実行**:
```bash
npm run test:e2e                              # 全テスト実行
npm run test:e2e:smoke                        # スモークテストのみ
npm run e2e:super-admin                       # スーパー管理者テスト
npx playwright test tests/e2e/risks.spec.ts   # 特定テスト実行
```

### 3. Journey テスト

**目的**: エンドユーザーの視点でビジネスフロー全体を検証

**配置**: `tests/e2e/journeys/`

**テスト構成** (2025-12-09 更新):

| カテゴリ | テストファイル | テスト数 | ステータス |
|---------|---------------|---------|-----------|
| ISMS認証サイクル | `full-isms-cycle.spec.ts` | 1 | 実装済 |
| 複数ユーザー承認 | `multi-user-approval.spec.ts` | 2 | 実装済 |
| スーパー管理者 | `super-admin-journeys.spec.ts` | 10 | 実装済 |
| 組織管理者 | `org-admin-journeys.spec.ts` | 10 | 実装済 |
| システム運営者 | `system-operator-journeys.spec.ts` | 10 | 実装済 |
| ユーザーライフサイクル | `user-lifecycle.spec.ts` | 1 | 実装済 |
| 是正措置ワークフロー | `audit-corrective-action-journey.spec.ts` | 1 | 実装済 |
| リスクライフサイクル | `risk-lifecycle-journey.spec.ts` | 4 | 実装済 |
| 文書改訂 | `document-revision-journey.spec.ts` | 4 | 実装済 |
| 通知・リマインダー | `notification-reminder-journey.spec.ts` | 3 | 実装済 |
| EMPLOYEE日常ワークフロー | `employee-daily-workflow-journey.spec.ts` | 5 | 実装済 |
| 境界条件・エッジケース | `boundary-conditions-journey.spec.ts` | 4 | 実装済 |

**特徴**:
- 複数ページ・複数ロールを横断
- テストデータ作成から後処理まで一貫して実行
- ユニークIDでテストデータを分離（`[E2E-TEST]` プレフィックス）
- `@journey` タグでフィルタリング可能

**実行**:
```bash
# 全ジャーニーテスト実行
npm run test:journey

# クリーンアップなしで実行（テストデータを残す）
npm run test:journey:keep
# または
SKIP_CLEANUP=1 npx playwright test tests/e2e/journeys/

# 個別実行
npx playwright test tests/e2e/journeys/full-isms-cycle.spec.ts --project=chromium
```

## CLI QA スクリプト

ブラウザ操作に依存しない軽量な品質チェックを `scripts/` 配下に配置しています。

### 利用可能なQAスクリプト

| コマンド | 目的 |
|---------|------|
| `npm run qa:i18n` | i18n整合性チェック |
| `npm run qa:public-copy` | 顧客向けUI/翻訳の内部語・旧語混入チェック |
| `npm run qa:stripe` | Stripeチェックアウト検証 |
| `npm run qa:documents` | 文書管理QA |
| `npm run qa:documents:upload` | 文書アップロードE2E |
| `npm run qa:risks` | リスク管理QA |
| `npm run qa:risks:matrix` | リスクマトリクスQA |
| `npm run qa:tasks` | タスク管理QA |
| `npm run qa:audit-report` | 監査レポートQA |
| `npm run qa:notifications` | 通知機能QA |
| `npm run qa:settings` | 設定画面QA |
| `npm run qa:home` | ホーム画面QA |
| `npm run qa:onboarding` | オンボーディングQA |
| `npm run qa:rbac:matrix` | RBACマトリクス検証 |
| `npm run qa:lighthouse` | Lighthouseベンチマーク |
| `npm run qa:security` | 依存脆弱性スキャン |
| `npm run qa:all` | 全QAメトリクス実行 |

## テストデータ管理

### テストデータの分離

ジャーニーテストで作成されたテナントは `[E2E-TEST]` プレフィックスで識別可能です。

### クリーンアップ

```bash
# 削除対象を確認（実際には削除しない）
npm run test:cleanup:dry-run

# テストテナントを削除
npm run test:cleanup

```

### デバッグ時のクリーンアップスキップ

```bash
SKIP_CLEANUP=1 npm run test:journey
```

## ヘルパー関数

### 現在利用可能

`tests/e2e/utils/test-helpers.ts` に以下のヘルパーを用意しています:

- `devLogin(page, role, email?)` - Dev Login API経由でログイン
- `waitForDevLoginReady(page)` - DevLogin APIの応答待機
- `createTestTenant(page, options)` - Super Adminとしてテナント作成
- `cleanupTestTenant(page, organizationId)` - テナントを削除
- `shouldSkipCleanup()` - 環境変数 `SKIP_CLEANUP=1` を判定

## CI/CD 統合

### Smoke Tests vs. Full Suite

| 種別 | 実行条件 | 対象 | 所要時間目安 |
|------|---------|------|-------------|
| Smoke | 全push/PR | 主要フロー (login, home, dev-login) | 〜2分 |
| Feature | push/PR | tests/e2e/*.spec.ts | 〜10分 |
| Journey | mainマージ/日次 | tests/e2e/journeys/*.spec.ts | 〜15分 |

### 実行コマンド

```bash
# Smokeテスト
npm run test:e2e:smoke

# Feature E2E
npm run test:e2e

# Journey テスト
npm run test:journey

# CI向け（lineレポーター）
npm run e2e:ci
```

## テスト成果物・エビデンス管理

| 種別 | デフォルト出力先 | 保持方針 |
|------|------------------|----------|
| HTMLレポート | `playwright-report/` | 直近5回分を保持 |
| トレース | `test-results/*/trace.zip` | 失敗時のみ保持 |
| スクリーンショット | `test-results/*/screenshot.png` | 失敗時のみ保持 |
| Lighthouseレポート | `test-results/lighthouse/` | 週次実行時保持 |
| セキュリティスキャン | `test-results/security/` | 週次実行時保持 |

## テスト失敗時の対応フロー

1. 失敗直後に trace / screenshot / console log を回収（Playwright 標準出力＋`test-results/`）。
2. Issue 起票: テンプレに「失敗テスト名・再現手順・環境情報（Node/Playwright）・trace/スクショへのパス」を記載。
3. 修正後: 同一テストを最小3回連続パスさせてクローズ。

---

## テスト設計の3つの観点

> **背景**: Feature E2E テストが全てパスしていても、実際のユーザー操作で問題が発覚することがあります（例: ログイン方法によるセッション情報の欠落）。これは「Happy Path」中心のテスト設計では、横断的な課題を見落としやすいためです。以下の3つの観点を用いて、テスト設計の網羅性を高めます。

### 観点1: ユーザージャーニー全体の検証

**目的**: 機能単位ではなく、ユーザーが実際に行う一連の操作フロー全体を検証する

**チェック項目**:

| ジャーニー | 検証ポイント | テストシナリオ例 |
|-----------|-------------|-----------------|
| 新規ユーザー作成→ログアウト→再ログイン | 作成したユーザーで正しくログインできるか | ORG_ADMINがユーザー招待→招待受諾→新ユーザーでログイン |
| テナント作成→担当者割当→担当者ログイン | 割り当てられたテナントが見えるか | SUPER_ADMINがテナント作成→組織管理者割当→その管理者でログイン→ダッシュボード確認 |
| 招待送信→トークン取得→承諾→ログイン | 招待フロー全体が機能するか | ORG_ADMINが招待→メール内トークン→ユーザー登録→ログイン→権限確認 |
| ISMS運用サイクル | 文書登録→リスク評価→監査計画→是正 | 一気通貫のISMS認証準備フロー |

**実装指針**:
- ヘルパー関数の内部実装（既存ユーザーID使用など）に依存しない
- 実際のUI操作を可能な限り再現する
- 作成→ログアウト→再ログインのサイクルを必ず含める

### 観点2: 境界条件・エッジケースの列挙

**目的**: 正常系だけでなく、境界条件や異常系を網羅的にテストする

**チェック項目**:

| 条件 | 状態 | 期待動作 | テスト実装 |
|------|------|---------|-----------|
| テナント未割当 | 組織管理者に`organizationId`が未設定 | 適切な空状態表示または警告 | `edge-cases.spec.ts` |
| ユーザー削除後 | 削除されたユーザーIDでログイン試行 | エラーメッセージ表示、ログイン拒否 | 要実装 |
| テナント削除後 | 削除されたテナントに所属するユーザー | 適切なエラー処理、孤立ユーザー対応 | 要実装 |
| セッション期限切れ | 長時間操作なし後の操作 | 再ログイン促進、データ損失なし | `edge-cases.spec.ts` |
| ロール変更後 | ログイン中にロール変更 | 次回アクセス時に新ロール適用 | `edge-cases.spec.ts` |
| 招待期限切れ | 期限切れトークンでアクセス | 明確なエラーメッセージ | `edge-cases.spec.ts` |
| ストレージクォータ超過 | 組織の5GB制限超過 | アップロード拒否メッセージ | QAガイドライン記載 |
| ファイルサイズ超過 | 25MB超のファイルアップロード | アップロード拒否メッセージ | QAガイドライン記載 |

**実装指針**:
- 各エッジケースに対して明示的なテストケースを作成
- エラーメッセージの内容も検証対象に含める
- 回復手順（リカバリーパス）も検証する

### 観点3: 「誰が」×「何を」×「どの状態で」マトリクス

**目的**: ログイン方法・ロール・操作の組み合わせを体系的に検証する

**ログイン方法 × ロール × 期待動作マトリクス**:

| ログイン方法 | ロール | 期待動作 | 現状 |
|-------------|--------|---------|------|
| Dev Login | EMPLOYEE/APPROVER/ORG_ADMIN | デモユーザーとして動作 | ✓ 動作 |
| Dev Login | SUPER_ADMIN | テナント非依存で動作 | ✓ 動作 |
| Dev Login | SYSTEM_OPERATOR | 共有オペレーターとして動作 | ✓ 動作 |
| 通常ログイン | 全ロール | ユーザーデータに基づき完全な情報でログイン | ✓ 動作 |

**システムロール × 必要コンテキスト**:

| ロール | 必要なコンテキスト | セッションに保存すべき情報 |
|--------|-------------------|--------------------------|
| SUPER_ADMIN | なし（全テナント管理可能） | `userId`, `systemRole` |
| SYSTEM_OPERATOR | 担当テナント | `userId`, `systemRole`, `organizationId` |
| ORG_ADMIN | 所属テナント | `userId`, `organizationId`, `role` |
| APPROVER | 所属テナント | `userId`, `organizationId`, `role` |
| EMPLOYEE | 所属テナント | `userId`, `organizationId`, `role` |
| AUDITOR | 所属テナント | `userId`, `organizationId`, `role` |
| FINANCE | 所属テナント | `userId`, `organizationId`, `role` |

**実装指針**:
- マトリクスの各セルに対してテストケースを作成
- 新しいロール追加時はマトリクスを更新する
- `rbac-matrix.spec.ts` でカバレッジを確保

### 観点適用のタイミング

| フェーズ | 適用する観点 | 目的 |
|---------|-------------|------|
| 設計レビュー | 観点3（マトリクス） | 仕様の抜け漏れ検出 |
| 実装完了時 | 観点1（ジャーニー） | 機能連携の検証 |
| リリース前 | 観点2（境界条件） | エッジケース対応確認 |
| 新機能追加時 | 全観点 | 既存機能への影響確認 |

---

## 汎用ガイドライン追補（再利用可能な設計・テスト指針）

マルチテナント/RBAC SaaS 全般で再利用できる考え方をここにまとめます。

### 1. セッション完全性テンプレ

- セッション必須要素を「要素 / 必須 or 任意 / 欠落時の動作（拒否・リダイレクト・警告・縮退） / 検知手段（UI・ログ・メトリクス）」で表にする。
- 欠落時の動作とテスト期待値をセットで記述し、表が埋まらなければ設計レビューは通過させない。

### 2. 認証経路 × 権限レベル マトリクス（テンプレ）

- 軸1: 認証経路（パスワード、SSO、Dev Login、招待トークンなど）。
- 軸2: 権限レベル（システムスコープ、組織/テナントスコープ、機能スコープ）。
- 各セルに「許可/禁止/限定」「要求コンテキスト」「検証手段（E2E/ユニット/契約）」を記入。

### 3. 負のシナリオ 5 分類（必須カバレッジ）

- コンテキスト欠落 / 期限切れ / 権限不整合 / リソース不整合 / 競合・同時実行
- 各カテゴリから最低1ケースをテスト計画に入れることを必須要件とする。

### 4. リリース判定の抽象ポリシー

- 「誤スコープ書き込み」「機密データ露出」「なりすまし可能性」「不可逆操作の認可漏れ」は常にブロッカー。
- これらに直結する欠落は `@smoke` 相当で検出し、解消されるまでリリース不可とする。

### 5. 防御 × 検知 の二段検証

- 重要ガードは「UI/API での防御」と「監査ログ/メトリクスでの検知」をペアで設計する。
- テストでは防御が効くことと検知が残ることの双方を確認するケースを用意する。

### 6. テストヘルパー使用制約（抽象化）

- コンテキストを省略するショートカット（モックログイン、直書きCookieなど）は、権限境界・多テナント境界・決済などクリティカル領域では原則禁止またはレビュー必須とする。

---

## テストカバレッジ目標

### 機能別カバレッジ

| 機能 | Unit | Feature E2E | Journey | 優先度 |
|------|------|-------------|---------|--------|
| 認証・ログイン | - | ✓ | ✓ | 必須 |
| RBAC・認可 | - | ✓ | ✓ (boundary-conditions) | 必須 |
| 文書管理 | - | ✓ | ✓ (document-revision) | 必須 |
| リスク管理 | ✓ | ✓ | ✓ (risk-lifecycle) | 必須 |
| タスク管理 | ✓ | ✓ | ✓ (employee-daily-workflow) | 必須 |
| 監査管理 | ✓ | ✓ | ✓ (audit-corrective-action) | 必須 |
| 通知機能 | - | ✓ | ✓ (notification-reminder) | 推奨 |
| 設定画面 | - | ✓ | - | 推奨 |
| スーパー管理者 | ✓ | ✓ | ✓ | 必須 |
| テナント管理 | - | ✓ | ✓ | 必須 |
| Stripe決済 | - | ✓ | - | 必須 |
| MFA認証 | - | ✓ | - | 推奨 |

### ロール別カバレッジ (2025-12-09 更新)

| ロール | 認可テスト | 画面アクセス | ワークフロー | ジャーニーテスト |
|--------|-----------|-------------|-------------|-----------------|
| EMPLOYEE | ✓ | ✓ | ✓ | ✓ (employee-daily-workflow) |
| APPROVER | ✓ | ✓ | ✓ | ✓ |
| ORG_ADMIN | ✓ | ✓ | ✓ | ✓ |
| AUDITOR | ✓ | ✓ | ✓ | ✓ (audit-corrective-action) |
| FINANCE | ✓ | ✓ | ✓ | - |
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ |
| SYSTEM_OPERATOR | ✓ | ✓ | ✓ | ✓ |

## タグ規約

テストにタグを付与してフィルタリング可能にします:

| タグ | 用途 | 例 |
|-----|------|-----|
| `@smoke` | CI必須の最小テスト | ログイン、ホーム表示 |
| `@journey` | ビジネスフロー全体 | ISMS認証サイクル一気通貫 |
| `@slow` | 長時間実行 | 大量データ処理 |
| `@flaky` | 不安定テスト（修正中） | 一時的なスキップ対象 |
| `@wip` | 作成中 | 未完成テスト |

```typescript
test.describe('@smoke login', () => {
  test('should login successfully', async ({ page }) => {
    // ...
  });
});
```

## デバッグ・トラブルシューティング

### テスト失敗時の調査

1. **トレースの確認**: `test-results/` 配下のトレースファイル
2. **スクリーンショット**: 失敗時に自動保存
3. **ビデオ録画**: `video: 'on-first-retry'` 設定で再試行時録画

### ヘッドフルモードでの実行

```bash
PWDEBUG=1 npx playwright test tests/e2e/target-test.spec.ts
```

### Playwright実行の注意点

- サーバ起動を固定: `HOST=127.0.0.1 PORT=3007 npm run dev`
- E2Eモード: `E2E_MODE=1 NEXT_PUBLIC_E2E_MODE=1` を設定
- セレクタ安定化: 可能なら `data-testid` を付ける
- トレース常用: `--trace on` を基本とする

---

## 関連ドキュメント

- [QAガイドライン](./qa-guidelines.md) - UC⇔要件⇔テストのトレーサビリティ、詳細な実行手順
- [ユースケース別QA Plan](./uc/) - UC-01〜UC-10の詳細QA計画
- コーディング規約 - テストID命名規則
