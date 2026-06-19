# シードデータガイド

## 概要

`scripts/seed-sqlite.mjs` は、開発・検証用のデモデータを local.db (SQLite) に投入するスクリプトです。
ISO 27001 認証取得に取り組む中規模IT企業グループをモデルとした、リアルなISMS運用環境を構築します。

## 実行方法

```bash
# シード投入（local.db にデータ作成）
npm run db:seed

# DB をクリーンリセットしてからシード
rm -f local.db local.db-shm local.db-wal
npx drizzle-kit push
npm run db:seed

# Turso Cloud に投入する場合
TURSO_DATABASE_URL=libsql://xxx.turso.io TURSO_AUTH_TOKEN=xxx npm run db:seed
```

## 実務検証seed

商用公開前の実務検証では、汎用デモseedではなく `scripts/seed-practical-verification.mjs` を使います。

```bash
npm run seed:practical-verification -- --reset
npm run qa:practical-seed
```

| ログイン | メール | ロール | テナント切替 | 確認用途 |
|----------|--------|--------|--------------|----------|
| Riscala AI for ISMS システム運営者 | `operator.practical@isms-practical.local` | `system_operator` | initial / surveillance の両方 | 管理者視点で2つのモデルテナント、組織、ユーザー、リスク、管理策、監査データを横断確認する |

この system_operator は `user_memberships` と `user_permission_sets` を両テナントに持ちます。各テナントでは `department_scope = all`、文書、リスク、タスク、監査、資産、管理策の全権限を持つため、ユーザーが事前に個別登録しなくてもロール切替・テナント切替の確認を始められます。

アプリ内では、この共有 system_operator でログインした後、ヘッダーの「確認中のテナント」セレクトから `初回登録準備モデル株式会社` と `継続運用モデル株式会社` を切り替えます。切替後は Home が選択テナントの ISMS フェーズに合わせて更新されるため、Dev Login をやり直さずに初回登録準備と継続運用の2ストーリーを見比べられます。この導線は `tests/e2e/system-operator-tenant-switch.spec.ts` で確認します。

| Scenario | 組織名 | モデル内容 |
|----------|--------|------------|
| `initial` | 初回登録準備モデル株式会社 | 初回審査登録準備用。組織、部門、ユーザー、体制ロール、ISMS適用範囲、文書、情報資産、リスク、対応策、管理策、初期タスクを含む |
| `surveillance` | 継続運用モデル株式会社 | 認証済み企業の年次運用用。月次運用、文書改訂、リスク見直し、内部監査、監査チーム、チェックリスト、不適合、是正、フォローアップ、マネジメントレビューを含む |

Super Admin のテナント一覧では、この2社がそれぞれ「初回登録準備」「継続運用」として表示されることを `tests/e2e/super-admin.spec.ts` で確認します。このE2Eは表示確認に必要な組織2行だけを最小upsertするため、フルseedが未投入の環境でもフェーズ表示契約を確認できます。実務検証では、この表示を起点にモデル会社を選び、後続のロール切替・テナント切替確認へ進みます。

## 汎用デモseedのテナント構成

以下は通常デモseedの構成です。実務検証では上記の `initial` / `surveillance` 固定テナントを正本として使います。

| ID | 組織名 | 従業員 | ISO認証状況 | ISMSフェーズ | プラン |
|----|--------|--------|------------|-------------|--------|
| `222...222` | Dev Manufacturing 株式会社 | 101-300名 | 取得中 (in_progress) | 構築 (implementation) | standard |
| `333...333` | Dev Solutions 株式会社 | 51-100名 | 計画中 (planning) | ギャップ分析 (gap_analysis) | starter |

**想定シナリオ**: Dev Manufacturing（親会社、200名規模のIT企業）が ISO 27001 を構築中。子会社 Dev Solutions（80名規模）はギャップ分析フェーズ。両社をシステム運営者が横断管理する、ホールディングス型の運用モデル。

## ロール構成

### プラットフォームレベル

| ロール | 名前 | メール | 組織所属 | 説明 |
|--------|------|--------|---------|------|
| **super_admin** | プラットフォーム管理者 | admin@riscala-isms.local | なし (null) | プラットフォーム全体を管理。テナント作成・削除、全監査ログ閲覧。組織に属さない |
| **system_operator** | 山田太郎 | yamada@riscala-isms.local | Dev Manufacturing (主) | 両テナントのシステム管理を担当。ITコンサルタント的立場で、全権限を保持 |

### ロール階層

```
super_admin          ← プラットフォーム管理者（組織横断、organization_id = null）
└── system_operator  ← システム運営者（複数組織に所属可、CROSS_ORG_ROLES）
    └── org_admin    ← 組織管理者
        ├── auditor  ← 内部監査員
        ├── approver ← 承認者
        └── user     ← 一般ユーザー
```

### system_operator の複数テナント管理

山田太郎は `user_memberships` テーブルで両組織に紐付いています:

| 組織 | ロール | 部門スコープ | 権限 |
|------|--------|------------|------|
| Dev Manufacturing 株式会社 | system_operator | all | 全権限 |
| Dev Solutions 株式会社 | system_operator | all | 全権限 |

**ユースケース例**:
- ホールディングスが複数事業会社のISMSを統合管理
- ITコンサル/代理店がクライアント企業のISMS運用を受託管理
- 1人のsystem_operatorが複数テナントに `user_memberships` でアサインされる

## 組織1: Dev Manufacturing 株式会社（200名IT企業）

### 部門構成（8部門）

| 部門 | 英語名 | 部門長 | 人数 | ISMS上の役割 |
|------|--------|--------|------|-------------|
| 経営企画部 | Corporate Planning | 佐藤美咲 | 25名 | トップマネジメント窓口 |
| 総務・人事部 | General Affairs & HR | 加藤麻衣 | 20名 | 教育訓練・労務管理 |
| 情報システム部 | IT Department | 田中花子 | 30名 | **ISMS推進事務局** |
| 第一開発部 | Development Div.1 | 高橋雄一 | 35名 | 自社プロダクト開発 |
| 第二開発部 | Development Div.2 | 木下直人 | 30名 | 受託開発 |
| 営業部 | Sales | 伊藤大輔 | 25名 | 法人営業 |
| カスタマーサポート部 | Customer Support | 渡辺さくら | 20名 | テクニカルサポート |
| 品質保証部 | Quality Assurance | 松本理恵 | 15名 | **内部監査** |

### 所属者（15名）

| 名前 | メール | ロール | 部門 | 役職 | 特別権限 |
|------|--------|--------|------|------|---------|
| 中村太郎 | nakamura@ | org_admin | 経営企画部 | 代表取締役/CISO | CISO, 全権限 |
| 田中花子 | tanaka@ | org_admin | 情報システム部 | 部長/ISMS推進事務局長 | セキュリティ管理者, 全権限 |
| 佐藤美咲 | sato@ | approver | 経営企画部 | 部長 | タスクのみ |
| 加藤麻衣 | kato@ | approver | 総務・人事部 | 部長 | 文書/リスク/タスク |
| 高橋雄一 | takahashi@ | user | 第一開発部 | 部長 | タスクのみ |
| 木下直人 | kinoshita@ | user | 第二開発部 | 部長 | タスクのみ |
| 伊藤大輔 | ito@ | user | 営業部 | 部長 | タスクのみ |
| 渡辺さくら | watanabe@ | user | CS部 | 部長 | タスクのみ |
| 小林誠 | kobayashi@ | user | 情報システム部 | 主任 | タスクのみ |
| 吉田翔 | yoshida@ | user | 第一開発部 | エンジニア | タスクのみ |
| 松本理恵 | matsumoto@ | **auditor** | 品質保証部 | 内部監査員 | **監査権限** |
| 井上拓也 | inoue@ | user | 営業部 | 営業主任 | タスクのみ |
| 木村真由美 | kimura@ | user | 総務・人事部 | 主任 | タスクのみ |
| 清水浩二 | shimizu@ | user | 情報システム部 | インフラ担当 | タスクのみ |
| 鈴木一郎 | suzuki@ | user | 第一開発部 | エンジニア | タスクのみ |

### リスク管理

**リスクカテゴリ（10分類）**: 技術的脆弱性、人的脅威、物理的脅威、運用リスク、コンプライアンス、サプライチェーン、自然災害、データ管理、アクセス制御、事業継続

**リスク基準**: 影響度5段階（軽微→甚大）× 発生可能性5段階（極低→極高）

**登録済みリスク（8件）**:

| リスク | 影響度 | 可能性 | スコア | ステータス | オーナー |
|--------|--------|--------|--------|-----------|---------|
| ランサムウェア攻撃 | 5(甚大) | 3(中) | 15 | 対応中 | 田中花子 |
| 内部者による情報漏洩 | 4(大) | 3(中) | 12 | 対応中 | 中村太郎 |
| フィッシング攻撃 | 3(中) | 4(高) | 12 | 監視中 | 田中花子 |
| クラウドサービス障害 | 3(中) | 3(中) | 9 | 分析中 | 小林誠 |
| サーバールーム電源障害 | 4(大) | 2(低) | 8 | 特定済み | 清水浩二 |
| 退職者アカウント不正利用 | 4(大) | 2(低) | 8 | 対応中 | 木村真由美 |
| 委託先からの情報漏洩 | 4(大) | 2(低) | 8 | 特定済み | 伊藤大輔 |
| ソフトウェアライセンス違反 | 2(小) | 3(中) | 6 | 監視中 | 小林誠 |

### 文書管理（6件）

| 文書名 | ステータス | 作成者 | カテゴリ |
|--------|-----------|--------|---------|
| 情報セキュリティ基本方針 | 承認済み | 中村太郎 | policy |
| リスクアセスメント手順書 | 承認済み | 田中花子 | procedure |
| インシデント対応手順書 | レビュー中 | 田中花子 | procedure |
| アクセス制御ポリシー | 下書き | 小林誠 | policy |
| 教育訓練計画書 | 承認済み | 加藤麻衣 | procedure |
| 事業継続計画(BCP) | 下書き | 佐藤美咲 | policy |

### 監査計画（3件）

| 監査名 | 種別 | ステータス | 主任監査員 | 期間 |
|--------|------|-----------|-----------|------|
| FY2025 内部監査(第1回) | 内部 | 完了 | 松本理恵 | 2025/10-11月 |
| FY2025 内部監査(第2回) | 内部 | 実施中 | 松本理恵 | 2026/01-02月 |
| 認証審査(ステージ1) | 認証 | 計画中 | 松本理恵 | 2026/04-05月 |

### タスク（5件）

| タスク名 | ステータス | 担当者 | 優先度 |
|----------|-----------|--------|--------|
| 情報セキュリティ方針の最終承認取得 | 完了 | 田中花子 | 高 |
| リスクアセスメント実施(第2四半期) | 進行中 | 田中花子 | 高 |
| 全社セキュリティ教育の実施 | 未着手 | 加藤麻衣 | 中 |
| サーバールーム入退室管理の改善 | 進行中 | 清水浩二 | 中 |
| 委託先管理台帳の整備 | 未着手 | 伊藤大輔 | 低 |

## 組織2: Dev Solutions 株式会社（80名ソフトウェア開発企業）

### 部門構成（3部門）

| 部門 | 英語名 | 部門長 | 人数 |
|------|--------|--------|------|
| 経営管理部 | Management | 山本健太 | 10名 |
| 開発部 | Development | 林誠一 | 40名 |
| 営業・CS部 | Sales & CS | 森田由美 | 30名 |

### 所属者（3名）

| 名前 | メール | ロール | 部門 | 役職 | 権限 |
|------|--------|--------|------|------|------|
| 山本健太 | yamamoto@dev-solutions.local | org_admin | 経営管理部 | 部長 | 全権限 |
| 林誠一 | hayashi@dev-solutions.local | user | 開発部 | 部長 | タスクのみ |
| 森田由美 | morita@dev-solutions.local | user | 営業・CS部 | 部長 | タスクのみ |

※ system_operator（山田太郎）も Dev Solutions の membership を持ち、横断管理可能。

## データ件数サマリー

| テーブル | 件数 |
|---------|------|
| organizations | 2 |
| organization_departments | 11 |
| user (Better Auth) | 20 |
| account (Better Auth) | 20 |
| user_profiles | 20 |
| user_memberships | 20 |
| user_permission_sets | 20 |
| risk_categories | 10 |
| risk_criteria | 10 |
| risks | 8 |
| task_categories | 8 |
| documents | 6 |
| audit_plans | 3 |
| tasks | 5 |
| **合計** | **163** |

## 実装上の注意

### system_operator の複数組織管理（現状）

DB・認可ロジック（`CROSS_ORG_ROLES` in `secureClient.ts`）は複数組織管理をサポートしています:
- `user_memberships` で同一ユーザーが複数組織に所属可能
- `user_permission_sets` で組織ごとに権限設定可能
- `session.activeOrganizationId` でアクティブ組織を切り替え

**未実装のUI/API（今後の課題）**:
- ~~組織切り替えUI（ヘッダーのorg selector等）~~ → dev-login画面でのテナント選択UIは実装済み
- 既存ユーザーへの追加メンバーシップ作成API
- 複数組織ダッシュボード

### dev-loginでのテスト手順

シードデータ投入後、dev-login画面で各ロールのログインテストを実施できます。

#### 前提条件

```bash
# DB をクリーンリセットしてシード投入
rm -f local.db local.db-shm local.db-wal
npx drizzle-kit push
npm run db:seed
npm run dev
```

#### テスト対象ロール（6ロール）

| ロール | メール | 組織 | 確認ポイント |
|--------|--------|------|-------------|
| super_admin | admin@riscala-isms.local | なし | テナント管理画面アクセス可 |
| system_operator | yamada@riscala-isms.local | Dev Manufacturing | 両組織データ閲覧可 |
| org_admin | tanaka@dev-mfg.local | Dev Manufacturing | 全権限、ISMS推進事務局 |
| user | suzuki@dev-mfg.local | Dev Manufacturing | タスクのみ操作可 |
| auditor | matsumoto@dev-mfg.local | Dev Manufacturing | 監査権限のみ |
| approver | sato@dev-mfg.local | Dev Manufacturing | タスクのみ操作可 |

#### チェック項目

- [ ] 全6ロールでログイン成功
- [ ] ゴースト組織（Dev Holdings等）が生成されない
- [ ] 権限に応じた画面アクセス制御が正常
- [ ] system_operator が複数組織を切り替え可能

### super_admin の特徴

- `organization_id = null`（組織に属さない）
- `user_memberships` レコードなし
- 全テナントのデータに管理者としてアクセス可能
- テナント作成・削除・ロック/ロック解除が可能
