---
title: RBAC（ロールベースアクセス制御）設計 - 改訂版
category: architecture
last_updated: 2025-06-10
status: approved
---

# RBAC（ロールベースアクセス制御）設計 - 改訂版

## 概要

ユーザージャーニーとISO 27001認証プロセスの実態を踏まえ、より実践的なロール設計に改訂しました。

## 現在のロール設計の問題点

### 1. 不足しているロール
- **ISMS責任者/管理責任者**: ISO 27001で必須の役割が定義されていない
- **文書管理者**: 文書の最終承認権限を持つ専門ロール
- **経営層**: マネジメントレビューを実施する役割

### 2. 役割が不明確なロール
- **operator**: サービス運用者としての位置づけが曖昧
- **user**: 一般利用者の権限範囲が広すぎる

## 改訂後のロール設計

### 1. システム管理者ロール

#### 1.1 Super Admin（スーパー管理者）
- **説明**: SaaSプラットフォーム全体の管理者（マルチテナント管理）
- **主な権限**:
  - 全組織の管理
  - システム設定の変更
  - 課金・請求管理
  - システムメンテナンス
- **想定ユーザー**: SaaS提供者側の管理者

### 2. 組織内ロール（ISO 27001準拠）

#### 2.1 Executive（経営層）
- **説明**: 経営層・最高責任者
- **主な権限**:
  - マネジメントレビューの実施
  - ISMS方針の承認
  - 重要な意思決定
  - 全データの閲覧権限
- **想定ユーザー**: CEO、CTO、CISO

#### 2.2 ISMS Manager（ISMS管理責任者）
- **説明**: ISMS全体の管理責任者
- **主な権限**:
  - ISMS運用全般の管理
  - リスクアセスメントの承認
  - 内部監査計画の承認
  - KPI/KRIの管理
  - すべての機能へのアクセス（経営層向け機能を除く）
- **想定ユーザー**: ISMS管理責任者、情報セキュリティ責任者

#### 2.3 Organization Admin（組織管理者）
- **説明**: 組織の技術的な管理者
- **主な権限**:
  - ユーザー管理
  - 組織設定
  - サブスクリプション管理
  - システム連携設定
- **想定ユーザー**: IT部門責任者、システム管理者

#### 2.4 Document Manager（文書管理者）
- **説明**: ISMS文書体系の管理者
- **主な権限**:
  - 文書の最終承認
  - 文書体系の管理
  - テンプレートの作成・管理
  - 文書配布の管理
- **想定ユーザー**: 品質管理責任者、文書管理責任者

#### 2.5 Risk Manager（リスク管理者）
- **説明**: リスクアセスメントの責任者
- **主な権限**:
  - リスクアセスメントの実施
  - リスク対応計画の策定
  - リスクレビューの実施
  - リスクレポートの作成
- **想定ユーザー**: リスク管理責任者、セキュリティ担当者

#### 2.6 Internal Auditor（内部監査員）
- **説明**: 内部監査の実施者
- **主な権限**:
  - 監査計画の作成
  - 監査の実施
  - 不適合の記録
  - 監査報告書の作成
  - 全データの閲覧権限（読み取り専用）
- **想定ユーザー**: 内部監査員、監査責任者

#### 2.7 Department Head（部門責任者）
- **説明**: 各部門のISMS推進責任者
- **主な権限**:
  - 部門のリスク評価
  - 部門タスクの管理
  - 部門文書の作成・承認
  - 部門メンバーの管理
- **想定ユーザー**: 部門長、チームリーダー

#### 2.8 Employee（一般従業員）
- **説明**: ISMSに参画する一般従業員
- **主な権限**:
  - 割り当てられたタスクの実行
  - インシデントの報告
  - 文書の閲覧（権限のあるもののみ）
  - 教育の受講
- **想定ユーザー**: 一般社員

#### 2.9 External Auditor（外部監査員）※ゲストロール
- **説明**: 認証機関の審査員
- **主な権限**:
  - 指定された文書の閲覧
  - 監査記録の閲覧
  - 証跡の確認
  - コメントの追加
- **想定ユーザー**: 認証機関審査員、外部コンサルタント

## ロール階層と関係性

```
Super Admin
    └── Organization
            ├── Executive
            ├── ISMS Manager
            │   ├── Document Manager
            │   ├── Risk Manager
            │   └── Internal Auditor
            ├── Organization Admin
            ├── Department Head
            │   └── Employee
            └── External Auditor (Guest)
```

## 権限マトリクス（主要機能）

| 機能 | Executive | ISMS Manager | Org Admin | Doc Manager | Risk Manager | Auditor | Dept Head | Employee | External |
|------|-----------|--------------|-----------|-------------|--------------|---------|-----------|----------|----------|
| マネジメントレビュー | ◎ | ○ | - | - | - | ○ | △ | - | △ |
| ISMS方針管理 | ◎ | ◎ | - | ○ | - | △ | △ | △ | △ |
| ユーザー管理 | △ | ○ | ◎ | - | - | - | ○ | - | - |
| 文書作成 | ○ | ◎ | ○ | ◎ | ○ | △ | ◎ | ○ | - |
| 文書承認 | ◎ | ◎ | - | ◎ | - | - | ○ | - | - |
| リスク評価 | △ | ◎ | - | - | ◎ | △ | ◎ | ○ | △ |
| 内部監査 | △ | ○ | - | - | - | ◎ | △ | △ | - |
| タスク管理 | △ | ◎ | ○ | ○ | ○ | ○ | ◎ | ◎ | - |
| レポート閲覧 | ◎ | ◎ | ○ | ○ | ○ | ◎ | ○ | △ | △ |

凡例: ◎=フル権限、○=編集可能、△=閲覧のみ、-=アクセス不可

## 実装への影響

### 1. データベース変更
```sql
-- usersテーブルのrole列を更新
ALTER TYPE user_role ADD VALUE 'executive';
ALTER TYPE user_role ADD VALUE 'isms_manager';
ALTER TYPE user_role ADD VALUE 'document_manager';
ALTER TYPE user_role ADD VALUE 'risk_manager';
ALTER TYPE user_role ADD VALUE 'department_head';
ALTER TYPE user_role ADD VALUE 'external_auditor';
-- 'admin' → 'organization_admin'
-- 'user' → 'employee'
-- 'auditor' → 'internal_auditor'
-- 'approver' → 削除（各ロールが承認権限を持つ）
```

### 2. 開発用擬似ログイン更新
dev-loginのプルダウンには以下のコアロールを表示し、DB上の `user_profiles.role`（`system_operator`,`org_admin`,`user`,`auditor`,`approver`）と整合させる。
1. System Operator（テナント運営者）
2. Organization Admin（組織管理者）
3. Member（一般ユーザー）
4. Auditor（内部監査員）
5. Approver（承認者）

### 3. UI/UXへの影響
- ダッシュボードをロールごとに最適化
- メニュー項目をロールに応じて動的に表示
- 承認ワークフローを複数ロールで実装

## 移行計画

### Phase 1: 基本ロールの実装
1. Executive, ISMS Manager, Organization Admin
2. 既存の admin → organization_admin への移行

### Phase 2: 専門ロールの追加
1. Document Manager, Risk Manager
2. Internal Auditor の機能拡張

### Phase 3: 詳細ロールの実装
1. Department Head, Employee
2. External Auditor (ゲストアクセス)

## セキュリティ考慮事項

1. **最小権限の原則**: 各ロールに必要最小限の権限のみ付与
2. **職務分離**: 監査員は実行権限を持たない
3. **承認フロー**: 重要な操作は複数の承認を必要とする
4. **監査証跡**: すべてのロール変更を記録

## まとめ

この改訂により、ISO 27001の要求事項により適合し、実際の組織運営に即したロール設計となります。特に、ISMS管理責任者の明確化と、部門単位での権限管理により、大規模組織でも効率的な運用が可能になります。

## 実装フェーズと役割マッピング

| フェーズ | 収録ロール | 主要ユースケース | 備考 |
| --- | --- | --- | --- |
| Phase 1 (現行) | super_admin / system_operator / org_admin / user / auditor / approver | テナント運用、組織設定、文書・リスク・監査・承認ワークフロー | 既存コード・QA が対象。設計上は Super Admin 向け API/Edge Function もここに含める。 |
| Phase 1.5 | document_manager / risk_manager | 文書・リスク責任者の承認権限を専用ロールへ切り出し、既存 UI にスコープガードを追加 | Service Role 強化と同タイミングで導入予定。 |
| Phase 2 | executive / isms_manager / department_head | マネジメントレビュー、部門別アクセス制御、オンボーディング体制管理 | `organization_departments` と `user_permission_sets` 拡張が前提。 |
| Phase 3 | employee（既存 user から改名） / external_auditor | ゲストアクセス、委託先監査、従業員セルフサービス | Federation/SSO の導入と並行してリリースする。 |

この表を基準に `docs/03-architecture/rbac-development-tasks.md` や Plan Tracking 上の Issue を整理し、追加ロールが UI・API・QA のどこへ波及するか事前に可視化する。
