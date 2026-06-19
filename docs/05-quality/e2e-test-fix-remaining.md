# E2E Journey テスト修正 - 残タスク一覧

> 作成日: 2025-12-04
> 更新日: 2025-12-04
> 記録者: Codex

## 概要

Journey E2Eテスト（全36件）のうち、9件が修正完了し、残り27件が未修正となっています。本ドキュメントでは、修正完了テストのサマリー、残作業の一覧、および各テストの修正方針をまとめます。

## 修正完了テストのサマリー

### 成功テスト（9件）

| テストID | テスト名 | 修正内容 | 検証日 |
|---------|---------|---------|--------|
| SA-01 | テナント作成と初期設定 | セレクタ修正済み | 2025-12-03 |
| SA-02 | テナントステータス管理（ロック/解除） | セレクタ修正済み | 2025-12-03 |
| SA-03 | テナント削除フロー | セレクタ修正済み | 2025-12-03 |
| SA-04 | グローバル監査ログの閲覧 | セレクタ修正済み | 2025-12-03 |
| SA-05 | 招待トークン管理とクリーンアップ | セレクタ修正済み | 2025-12-03 |
| OA-01 | ユーザー招待と権限設定 | セレクタ修正済み | 2025-12-03 |
| OA-03 | リスク登録から対応策設定まで | createRiskヘルパーをUI操作ベースに変更 | 2025-12-04 |
| OA-07 | 情報資産登録と管理 | セレクタ修正済み | 2025-12-03 |
| OA-10 | 監査計画作成と実行 | セレクタ修正済み | 2025-12-03 |

### セレクタ修正済み（未検証: 2件）

| テストID | テスト名 | 修正内容 | 検証予定 |
|---------|---------|---------|---------|
| SO-01 | 組織基本情報の設定と更新 | セレクタ修正済み | 次回テスト実行時 |
| SO-03 | 体制ロール管理 | セレクタ修正済み | 次回テスト実行時 |

## 残作業テスト一覧

### 1. Super Admin ジャーニー（2件未修正）

| テストID | テスト名 | 失敗原因 | 優先度 |
|---------|---------|---------|--------|
| SA-06 | System Operatorユーザー作成 | フォームセレクタ不一致 | 中 |
| SA-07 | 招待トークン管理とクリーンアップ | モーダルセレクタ不一致 | 低 |
| SA-08 | グローバル監査ログのフィルタ機能 | フィルタUI構造変更 | 低 |
| SA-09 | 複数テナント同時管理 | テナント選択UI不一致 | 低 |

### 2. Org Admin ジャーニー（6件未修正）

| テストID | テスト名 | 失敗原因 | 優先度 |
|---------|---------|---------|--------|
| OA-02 | 文書作成と承認フロー（単一承認者） | 文書フォームセレクタ不一致 | 高 |
| OA-04 | タスク作成と担当者割当 | タスクフォームセレクタ不一致 | 高 |
| OA-05 | 課金・サブスクリプション変更 | Stripe Checkout UI変更 | 中 |
| OA-06 | 2段階承認フロー（承認者2名） | 承認ステップUI変更 | 中 |
| OA-08 | リスク対応計画作成 | リスク対応フォーム不一致 | 中 |
| OA-09 | タスク完了とレビュー | タスク完了UI変更 | 中 |

### 3. System Operator ジャーニー（2件未修正）

| テストID | テスト名 | 失敗原因 | 優先度 |
|---------|---------|---------|--------|
| SO-02 | 部門階層の作成と管理 | 部門フォームセレクタ不一致 | 中 |
| SO-04 | ユーザー招待・受諾・ログインフロー | 招待モーダルセレクタ不一致 | 高 |

### 4. ライフサイクルテスト（3件未修正）

| ファイル名 | テスト名 | 失敗原因 | 優先度 |
|-----------|---------|---------|--------|
| user-lifecycle.spec.ts | 新規ユーザー作成→ログアウト→再ログイン | 認証フロー変更 | 高 |
| user-lifecycle.spec.ts | 招待フロー完全テスト（複数ロール） | 招待フローセレクタ不一致 | 高 |
| user-lifecycle.spec.ts | ログアウト→複数回再ログインサイクル | ログアウトUI変更 | 中 |

### 5. マルチユーザー承認テスト（2件未修正）

| ファイル名 | テスト名 | 失敗原因 | 優先度 |
|-----------|---------|---------|--------|
| multi-user-approval.spec.ts | Org Admin と Approver の2者間承認 | 承認UIセレクタ不一致 | 高 |
| multi-user-approval.spec.ts | 2段階承認ワークフロー | 承認ステップUI変更 | 高 |

### 6. Full ISMS Cycle テスト（1件）

| ファイル名 | テスト名 | 失敗原因 | 優先度 |
|-----------|---------|---------|--------|
| full-isms-cycle.spec.ts | テナント作成から内部監査完了まで | 複数フェーズ連携問題 | 高 |

## エラーパターン分析

### パターン1: フォームセレクタ不一致（最多）

**症状**: `getByLabel()`, `getByPlaceholder()` が要素を見つけられない

**影響テスト**: OA-02, OA-04, OA-06, OA-08, OA-09, SO-02, SO-04

**原因**:
- UIコンポーネントのリファクタリングによるラベル変更
- プレースホルダーテキストの変更または削除
- フォーム構造の階層変更

**修正方針**:
1. 実際のUIを確認し、最新のラベル/プレースホルダーを特定
2. `data-testid` 属性を使った安定したセレクタに変更検討
3. 複数セレクタのフォールバック実装

**参考コード**:
```typescript
// Before（不安定）
await page.getByLabel('リスク名').fill('テストリスク')

// After（安定）
const titleInput = page.locator('[data-testid="risk-title-input"]')
  .or(page.getByLabel('リスク名'))
  .or(page.getByPlaceholder('例：情報漏洩リスク'))
await titleInput.fill('テストリスク')
```

### パターン2: モーダル/ダイアログUI変更

**症状**: モーダルの見出し、ボタンが見つからない

**影響テスト**: SA-07, SO-04, multi-user-approval.spec.ts

**原因**:
- モーダルコンポーネントのリファクタリング
- ダイアログライブラリの変更
- 見出しテキストの変更

**修正方針**:
1. モーダルの開閉状態を `state: 'visible'` で確認
2. `role="dialog"` などの構造的セレクタを使用
3. 正規表現で複数バリエーションに対応

**参考コード**:
```typescript
// Before
const modalHeading = page.getByRole('heading', { name: 'メンバーを招待' })

// After
const modal = page.locator('[role="dialog"]').or(page.locator('[data-testid="invite-modal"]'))
await modal.waitFor({ state: 'visible', timeout: 5_000 })
const modalHeading = modal.getByRole('heading', { name: /メンバーを招待|ユーザーを招待/ })
```

### パターン3: 認証フロー変更

**症状**: ログイン後のリダイレクト、セッション状態の不整合

**影響テスト**: user-lifecycle.spec.ts（3件）

**原因**:
- 認証フローのリファクタリング
- DevLogin APIとフォームログインの挙動差異
- セッションCookieの保存タイミング変更

**修正方針**:
1. `waitForURL()` のパターンを緩和（`**/home**` → `**/home*` など）
2. 認証後の待機時間を調整
3. セッション確認APIを追加で呼び出し

**参考コード**:
```typescript
// Before
await page.waitForURL('**/home**', { timeout: 20_000 })

// After
await page.waitForURL(url => url.pathname.includes('/home'), { timeout: 20_000 })
await page.waitForLoadState('networkidle')

// セッション確認
const session = await page.evaluate(() => fetch('/api/dev/whoami').then(r => r.json()))
expect(session.userId).toBeTruthy()
```

### パターン4: 承認ワークフロー変更

**症状**: 承認依頼、承認ボタンが見つからない

**影響テスト**: OA-02, OA-06, multi-user-approval.spec.ts

**原因**:
- 承認UIコンポーネントの再設計
- 承認ステップ数の変更
- 承認者セレクトの実装変更

**修正方針**:
1. 承認依頼ボタンの新しいラベルを確認
2. 承認者セレクトの構造を再調査
3. 承認完了後のステータス表示を更新

**参考コード**:
```typescript
// Before
await page.getByRole('button', { name: '承認依頼を送る' }).click()

// After
const requestApprovalBtn = page.locator('button').filter({ hasText: /承認依頼|承認を依頼/ }).first()
await requestApprovalBtn.click()

// 承認者選択（IDベース）
const approverSelect = page.locator('#approval-step1, [data-testid="approval-step1-select"]')
```

## 修正優先順位

### 最優先（Phase 1: 即座に対応）

これらのテストはコアユーザーフロー（文書管理、リスク管理、承認ワークフロー）に関連し、MVPリリース前に必須です。

1. **OA-02**: 文書作成と承認フロー（単一承認者）
2. **OA-04**: タスク作成と担当者割当
3. **SO-04**: ユーザー招待・受諾・ログインフロー
4. **user-lifecycle.spec.ts** - 全3件
5. **multi-user-approval.spec.ts** - 全2件
6. **full-isms-cycle.spec.ts**

**完了条件**: 上記9件がすべて成功

### 高優先度（Phase 2: リリース前に対応）

ビジネス機能として重要だが、暫定的な手動テストで代替可能。

8. **OA-06**: 2段階承認フロー
9. **OA-08**: リスク対応計画作成
10. **OA-09**: タスク完了とレビュー
11. **SO-02**: 部門階層の作成と管理
12. **OA-05**: 課金・サブスクリプション変更

**完了条件**: 上記5件がすべて成功

### 中優先度（Phase 3: リリース後に対応可能）

運用効率化に寄与するが、緊急性は低い。

13. **SA-06**: System Operatorユーザー作成
14. **SA-07**: 招待トークン管理とクリーンアップ
15. **SA-08**: グローバル監査ログのフィルタ機能
16. **SA-09**: 複数テナント同時管理

**完了条件**: 上記4件がすべて成功

## 修正手順

### Step 1: UIセレクタの実態調査

各失敗テストについて、以下の調査を実施：

```bash
# 開発サーバー起動
npm run dev

# ブラウザで該当画面を開き、DevToolsで要素を確認
# - ラベルテキスト
# - プレースホルダー
# - data-testid 属性
# - role 属性
# - class 名
```

### Step 2: セレクタの更新

調査結果をもとに、テストコードのセレクタを更新：

```typescript
// 例: OA-02 文書作成フォーム
const titleInput = page.locator('[data-testid="document-title"]')
  .or(page.getByLabel('文書タイトル'))
  .or(page.getByPlaceholder('例：情報セキュリティ基本方針'))

await titleInput.fill('テスト文書')
```

### Step 3: テスト実行と検証

```bash
# 単一テスト実行
npm run e2e:journeys -- --grep "OA-02"

# 修正済みテストのみ実行
npm run e2e:journeys -- --grep "OA-0[234]|SO-04"

# 全テスト実行（最終確認）
npm run e2e:journeys
```

### Step 4: 安定化対策

テストが不安定になりやすいポイントに対策を追加：

```typescript
// 1. 要素が表示されるまで明示的に待機
await element.waitFor({ state: 'visible', timeout: 10_000 })

// 2. ネットワークアイドルを待つ
await page.waitForLoadState('networkidle')

// 3. デバウンス後の保存を待つ
await page.waitForTimeout(500)

// 4. レスポンスを待つ
const [response] = await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/documents')),
  page.getByRole('button', { name: '保存' }).click()
])
```

## QA チェックリスト

各テスト修正完了時に以下を確認：

- [ ] テストが3回連続で成功する（安定性確認）
- [ ] 実際のUIと乖離がない（手動操作と同じ動作）
- [ ] セレクタが `data-testid` または構造的（role, heading）を優先
- [ ] エラーメッセージが適切（失敗時のデバッグ容易性）
- [ ] クリーンアップが正しく動作（テストデータ残留なし）
- [ ] コメントが最新の実装を反映

## 関連ドキュメント

- [テスト戦略](./testing-strategy.md) - テスト全体のアーキテクチャ
- [QAガイドライン](./qa-guidelines.md) - 品質保証の標準手順
- [Plan Tracking](../02-project/10_plan-tracking.md) - 開発計画と進捗管理

## 変更履歴

| 日付 | 変更内容 | 記録者 |
|-----|---------|--------|
| 2025-12-04 | 初版作成、残タスク28件を整理 | Codex |
| 2025-12-04 | OA-03修正完了、createRiskヘルパーをUI操作ベースに変更、残タスク27件 | Codex |
