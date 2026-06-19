作成日: 2026-01-27
記録者: Claude Code

# Pre-TDD ブリーフ: テストカバレッジ修正（CRITICAL + HIGH）

## 1. ユーザーストーリー

開発者として、`SQLiteAIUsageLogRepository` および `SQLiteAISuggestionRepository` のテストが**実クラスをインポートしてカバー**する状態にしたい。
なぜなら、Phase 1（better-sqlite3 → @libsql/client ドライバー統一）の Post-TDD カバレッジ分析で以下の CRITICAL なギャップが特定されたから:

- **CRITICAL**: `sqlite-ai-usage-log-repository.test.ts` は `MockSQLiteAIUsageLogRepository` クラスをテストファイル内に定義し、in-memory 配列（mockStore）で DB 操作をシミュレートしている。実際の `SQLiteAIUsageLogRepository` クラスは**一切インポートされておらず**、テストカバレッジがゼロ。
- **HIGH**: `sqlite-ai-suggestion-repository.test.ts` は実クラスを動的インポートし mock DB を注入するパターンを使用しているが、`mapRowToEntity` 関数がテストファイル内に再定義されており、実クラスの private メソッドをカバーしていない。

## 2. 受け入れ条件（Acceptance Criteria）

### AC-1: 実クラスインポート
`sqlite-ai-usage-log-repository.test.ts` が実クラス `SQLiteAIUsageLogRepository`（`lib/db/repositories/sqlite/AIUsageLogRepository.ts`）をインポートしてテストすること。`MockSQLiteAIUsageLogRepository` クラスは使用しない。

### AC-2: Mock クラス削除
`MockSQLiteAIUsageLogRepository` クラスおよび関連する in-memory モックインフラ（`mockStore` 配列、`mockCreateId` 関数、`mockTimestamp` 変数、ローカル型定義 `RequestType`/`AIUsageLog`/`CreateUsageLogInput`/`UsageStatistics`）がテストファイルから削除されていること。

### AC-3: constructor DI 追加
`AIUsageLogRepository` に `constructor(dbOverride?: DrizzleDb)` が追加されていること。パターンは `AISuggestionRepository` と統一:
```typescript
constructor(dbOverride?: DrizzleDb) {
  super()
  if (dbOverride) {
    this.db = dbOverride
  }
}
```
- 引数なしの場合は既存動作（`super()` → `getDb()`）と同一
- `DrizzleDb` 型は `@/lib/db/drizzle/client` からインポート

### AC-4: 既存テストケース全 PASS
既存テストケース（30+ 件）が全て PASS すること。テストの意図・アサーションは変更せず、テスト対象のみを `MockSQLiteAIUsageLogRepository` → `SQLiteAIUsageLogRepository` に切り替える。

### AC-5: mapRowToEntity テスト改善
`sqlite-ai-suggestion-repository.test.ts` の `Row-to-Entity mapping` テストセクション（7件）において:
- テストファイル内に再定義された `mapRowToEntity` 関数を削除
- 実クラスの `private mapRowToEntity` を間接的にテストする形に改善（`findById()` 経由で mock DB から DrizzleRow を返し、entity の各フィールドを検証）
- テストの意図・カバレッジは維持

### AC-6: typecheck 成功
`npm run typecheck` が成功すること。新規追加の `constructor` パラメータ型、import パスが正しいこと。

### AC-7: requireOrganizationId テスト追加
`SQLiteAIUsageLogRepository` のテストに以下を追加:
- `create()` に空文字列 `organizationId` を渡した場合、`OrganizationScopeError` が throw されること
- `findByOrganizationId()` に空文字列を渡した場合、`OrganizationScopeError` が throw されること
- `getStatistics()` に空文字列を渡した場合、`OrganizationScopeError` が throw されること

## 3. スコープ

### In scope

| 対象 | 作業内容 |
|------|----------|
| `lib/db/repositories/sqlite/AIUsageLogRepository.ts` | `constructor(dbOverride?: DrizzleDb)` を追加。`DrizzleDb` 型の import 追加 |
| `tests/unit/sqlite-ai-usage-log-repository.test.ts` (623行) | 全面書き換え: Mock クラス削除、実クラスインポート、mock DB 注入パターンへ移行、OrganizationScopeError テスト追加 |
| `tests/unit/sqlite-ai-suggestion-repository.test.ts` (949行) | `mapRowToEntity` 関数（L221-234）の削除、Row-to-Entity mapping テスト（L242-301）を findById 経由の間接テストに書き換え |

### Out of scope

| 対象 | 理由 |
|------|------|
| `AISuggestionRepository.ts` の既存コード | 既に `constructor(dbOverride?: DrizzleDb)` を持ち、テストも正しいパターン |
| `BaseSQLiteRepository.ts` | 変更不要。`OrganizationScopeError` は既に export されている |
| 他のリポジトリ（ConfigStore 等） | 今回のスコープ外。既にカバレッジ問題なし |
| AISuggestionRepository テストの CRUD/edge case セクション | 既に実クラスを動的インポート + mock DB 注入パターンで正しく実装済み |

## 4. インターフェース設計

### 4.1 AIUsageLogRepository constructor 変更

**変更前:**
```typescript
export class SQLiteAIUsageLogRepository extends BaseSQLiteRepository implements IAIUsageLogRepository {
  // constructor なし（BaseSQLiteRepository の constructor() → getDb() が呼ばれる）
```

**変更後:**
```typescript
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteAIUsageLogRepository extends BaseSQLiteRepository implements IAIUsageLogRepository {
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }
```

- **入力**: `dbOverride?: DrizzleDb` （オプショナル）
- **出力**: なし（コンストラクタ）
- **副作用**: `dbOverride` が渡された場合、`this.db` を上書き
- **後方互換性**: 引数なし呼び出しは既存動作と同一（`super()` で `getDb()` が実行される）
- **エラー**: なし

### 4.2 Mock DB インターフェース（テスト用）

Usage Log テストの mock DB は以下のチェーンをサポートする必要がある:

| メソッド | チェーン | 使用箇所 |
|----------|----------|----------|
| `insert` | `.insert(table).values(row)` → `Promise<void>` | `create()` |
| `select` | `.select().from(table).where(cond).orderBy(expr).limit(n)` → `Promise<Row[]>` | `findById()`, `findByOrganizationId()`, `findByUserId()` |
| `select` (集約) | `.select({...sql}).from(table).where(and(...))` → `Promise<AggRow[]>` | `getStatistics()` |

**注意**: `AIUsageLogRepository.create()` は `.returning()` を使用**しない**（`AISuggestionRepository` とは異なる）。`insert` 後に `mapRowToEntity(row)` をローカル変数から直接呼ぶ設計。

### 4.3 エラーインターフェース

```typescript
import { OrganizationScopeError } from './BaseSQLiteRepository'
```
- `requireOrganizationId('')` → `throw new OrganizationScopeError(operation)`
- `requireOrganizationId(undefined)` → `throw new OrganizationScopeError(operation)`
- `requireOrganizationId(null)` → `throw new OrganizationScopeError(operation)`

## 5. テスト方針

### 5.1 Usage Log テスト（全面書き換え）

**テストパターン**: 実クラスインポート + mock DB コンストラクタ注入

```typescript
// パターン例
import { SQLiteAIUsageLogRepository } from '@/lib/db/repositories/sqlite/AIUsageLogRepository'
import { OrganizationScopeError } from '@/lib/db/repositories/sqlite/BaseSQLiteRepository'

const mockDb = createMockDb({ insertResult: undefined })
const repository = new SQLiteAIUsageLogRepository(mockDb as never)
```

**Mock DB 設計**: `sqlite-ai-suggestion-repository.test.ts` の `createMockDb()` パターンを参考にしつつ、以下の差異を反映:
- `insert` チェーンは `.returning()` なし（`.values(row)` → `Promise<void>` で resolve）
- `select` チェーンに `.orderBy()` と `.limit()` を追加（`findByOrganizationId` 用）
- `select` の集約パターン（`getStatistics` 用）は `select({...})` → `.from()` → `.where()` → `Promise<[AggRow]>`

**テストケース移行方針**:
- 既存 30+ テストケースのアサーション・テスト意図はそのまま維持
- `mockStore` への直接アクセス（例: `assert.equal(mockStore[0].cached, 1)`）は mock DB の `_insertCalls` 検証に置換
- `mockTimestamp` / `mockCreateId` は `crypto.randomUUID` / `new Date().toISOString()` の実行に委ね、値の形式のみ検証

**追加テストケース**:
- `requireOrganizationId` エラーケース × 3（create, findByOrganizationId, getStatistics）

### 5.2 Suggestion テスト（mapRowToEntity 部分のみ改善）

**改善パターン**: `findById()` 経由で mock DB から DrizzleRow を返し、entity フィールドを検証

```typescript
// 変更前（テスト内再定義関数を使用）
const entity = mapRowToEntity(mockDrizzleRow)
assert.equal(entity.accepted, null)

// 変更後（実クラス経由）
const mockDb = createMockDb({ selectResult: [mockDrizzleRow] })
const repository = new SQLiteAISuggestionRepository(mockDb as never)
const entity = await repository.findById(mockSuggestionId)
assert.equal(entity!.accepted, null)
```

既存の 7 テストケース（Row-to-Entity mapping セクション）を上記パターンに書き換え。

### 5.3 テスト数見積もり

| テストファイル | 既存 | 追加 | 削除 | 最終 |
|---------------|------|------|------|------|
| `sqlite-ai-usage-log-repository.test.ts` | 30 | 3 (OrganizationScopeError) | 0 | 33 |
| `sqlite-ai-suggestion-repository.test.ts` | 30 | 0 | 0 | 30 |
| **合計** | **60** | **3** | **0** | **63** |

## 6. 品質ゲート

全ての品質ゲートを PASS してから完了とする:

| ゲート | コマンド | 基準 |
|--------|---------|------|
| TypeScript 型チェック | `npm run typecheck` | エラーゼロ |
| ESLint | `npm run lint` | エラーゼロ |
| ビルド | `npm run build` | 成功 |
| Unit Tests | `node --import tsx --test tests/unit/sqlite-ai-usage-log-repository.test.ts` | 全 PASS |
| Unit Tests | `node --import tsx --test tests/unit/sqlite-ai-suggestion-repository.test.ts` | 全 PASS |
| Unit Tests | `node --import tsx --test tests/unit/sqlite-config-store.test.ts` | 全 PASS（回帰なし） |
| Phase 1 全テスト | Phase 1 関連テスト全件 | 全 PASS（回帰なし） |

## 7. /tdd 実行可否

**可能**

### 実行条件
- 全ての AC が明確に定義されている
- テスト対象のソースコード構造が確認済み
- 参照パターン（`sqlite-config-store.test.ts`, `sqlite-ai-suggestion-repository.test.ts`）が明確
- mock DB のインターフェース設計が特定済み

### 推奨実行順序
1. **Step 1**: `AIUsageLogRepository.ts` に `constructor(dbOverride?: DrizzleDb)` を追加（AC-3）
2. **Step 2**: `sqlite-ai-usage-log-repository.test.ts` を全面書き換え（AC-1, AC-2, AC-4, AC-7）
3. **Step 3**: `sqlite-ai-suggestion-repository.test.ts` の mapRowToEntity テスト改善（AC-5）
4. **Step 4**: 品質ゲート実行（AC-6）

### リスク
- **LOW**: `AIUsageLogRepository.create()` は `.returning()` を使わず `insert().values()` のみのため、mock DB の設計が `AISuggestionRepository` とやや異なる。`insert` チェーンの戻り値を `Promise<void>` にする必要あり。
- **LOW**: `getStatistics()` の SQL 集約クエリ（`COUNT`, `SUM`, `COALESCE`, `CASE WHEN`）の mock は、集約結果オブジェクトを直接返す形で対応可能。
- **LOW**: `findByOrganizationId()` の `.orderBy().limit()` チェーンは mock DB に追加メソッドが必要。
