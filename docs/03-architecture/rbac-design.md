---
title: ISMS SaaS RBAC（ロールベースアクセス制御）設計書
category: architecture
created: 2025-06-05
last_updated: 2025-12-01
author: tom
ears_compliant: true
---

# ISMS SaaS RBAC（ロールベースアクセス制御）設計書

## 1. 概要

本ドキュメントは、ISMS管理支援SaaSアプリケーションにおけるロールベースアクセス制御（RBAC）の設計について定義します。ISO/IEC 27001の要求事項に準拠し、適切な職務分離と最小権限の原則を実現します。

## 2. ロール定義

### 2.1 スーパー管理者（Super Admin）
**概要**: テナント横断でプラットフォーム全体を統括し、テナントのライフサイクル・グローバル監査ログ・課金設定を担う最上位ロール。`/ja/dev-login` に追加された「スーパー管理者」オプションはこのロールの疑似ログインを提供する。

**主な責任**:
- 新規テナントの作成・初期 System Operator 発行
- テナントのロック／解除および監査ログ（scope=`global`）の追跡
- プラットフォーム横断 KPI・課金設定・Edge Function 管理
- System Operator 以上の権限確認と緊急対応

### 2.2 システム運営者（System Operator）
**概要**: 各テナント内での最上位権限ロール。Super Admin が用意したテナントを運用し、組織設定やユーザー管理を担当する。2025-11 時点で複数名の System Operator を同一テナントに登録できるようになっており、既存の System Operator が追加の System Operator を招待する。

**主な責任**:
- テナント単位での稼働状況監視
- ユーザー招待・体制/権限管理（System Operator ロールを含む）
- 料金プラン・課金設定の確認（テナント内）
- テナント内のシステムメンテナンスと一次サポート

### 2.3 組織管理者（Organization Admin）
**概要**: 各テナント組織内での最高管理権限を持つロール

**主な責任**:
- 組織内ユーザーの管理
- 組織設定の管理
- ISMS基本方針の承認
- 監査計画の承認
- リスク対応計画の最終承認

### 2.4 一般ユーザー（General User）
**概要**: ISMS運用に関わる一般的な作業を実施するロール

**主な責任**:
- 担当文書の作成・編集
- リスクアセスメントの実施
- タスクの実行・報告
- 教育訓練の受講

### 2.5 監査員（Auditor）
**概要**: 内部監査の計画・実施・報告を行うロール

**主な責任**:
- 監査計画の作成
- 監査チェックリストの実施
- 不適合の指摘
- 監査報告書の作成
- 是正措置の確認

### 2.6 承認者（Approver）
**概要**: 文書やリスク対応策などの承認権限を持つロール

**主な責任**:
- 文書の承認・却下
- リスク対応策の承認
- 変更管理の承認
- 予算承認（リスク対応）

## 3. 機能別アクセス権限マトリックス

Super Admin は各機能テーブルで「テナント横断」を意味し、System Operator 以降の列はテナント内ロールの権限を示す。

### 3.1 文書管理機能

| 機能 | Super Admin | System Operator | Org Admin | User | Auditor | Approver |
|------|-------------|----------------|-----------|------|---------|----------|
| 文書テンプレート管理 | ✓ | ✓ | - | - | - | - |
| 文書作成 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 文書編集（自分が作成） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 文書編集（他者が作成） | ✓ | ✓ | ✓ | - | - | ✓ |
| 文書削除 | ✓ | ✓ | ✓ | - | - | - |
| 文書承認 | ✓ | ✓ | ✓ | - | - | ✓ |
| 文書履歴閲覧 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 文書エクスポート | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 3.2 リスクアセスメント機能

| 機能 | Super Admin | System Operator | Org Admin | User | Auditor | Approver |
|------|-------------|----------------|-----------|------|---------|----------|
| リスクカテゴリ管理 | ✓ | ✓ | ✓ | - | - | - |
| リスク登録 | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| リスク評価 | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| リスク対応策作成 | ✓ | ✓ | ✓ | ✓ | - | - |
| リスク対応策承認 | ✓ | ✓ | ✓ | - | - | ✓ |
| リスク台帳閲覧 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| リスクレポート生成 | ✓ | ✓ | ✓ | - | ✓ | ✓ |

### 3.3 タスク管理機能

| 機能 | Super Admin | System Operator | Org Admin | User | Auditor | Approver |
|------|-------------|----------------|-----------|------|---------|----------|
| タスク作成 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| タスク編集（自分が担当） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| タスク編集（他者が担当） | ✓ | ✓ | ✓ | - | - | - |
| タスク削除 | ✓ | ✓ | ✓ | - | - | - |
| タスク割当 | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| タスク進捗更新 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| タスクレポート閲覧 | ✓ | ✓ | ✓ | △ | ✓ | ✓ |

△: 自分に関連するタスクのみ

### 3.4 監査管理機能

| 機能 | Super Admin | System Operator | Org Admin | User | Auditor | Approver |
|------|-------------|----------------|-----------|------|---------|----------|
| 監査計画作成 | ✓ | ✓ | - | - | ✓ | - |
| 監査計画承認 | ✓ | ✓ | ✓ | - | - | - |
| 監査実施 | ✓ | ✓ | - | - | ✓ | - |
| 不適合登録 | ✓ | ✓ | - | - | ✓ | - |
| 是正措置作成 | ✓ | ✓ | ✓ | ✓ | - | - |
| 是正措置承認 | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| 監査報告書作成 | ✓ | ✓ | - | - | ✓ | - |
| 監査履歴閲覧 | ✓ | ✓ | ✓ | △ | ✓ | ✓ |

△: 自部門に関連する監査のみ

### 3.5 システム管理機能

| 機能 | Super Admin | System Operator | Org Admin | User | Auditor | Approver |
|------|-------------|----------------|-----------|------|---------|----------|
| テナント管理（複数組織） | ✓ | - | - | - | - | - |
| 組織情報管理（自組織） | ✓ | ✓ | ✓ | - | - | - |
| ユーザー管理 | ✓ | ✓ | ✓ | - | - | - |
| ロール割当 | ✓ | ✓ | ✓ | - | - | - |
| 料金プラン管理 | ✓ | ✓ | - | - | - | - |
| システム設定（グローバル） | ✓ | - | - | - | - | - |
| システム設定（テナント内） | ✓ | ✓ | - | - | - | - |
| 監査ログ閲覧 | ✓ | ✓ | - | ✓ | - | - |
| データバックアップ | ✓ | ✓ | - | - | - | - |

## 4. EARS形式 動作要件定義

### 4.1 認証・認可要件

#### ユビキタス要件
- EARS-RBAC-001: The system shall 全てのユーザーに対してロールベースのアクセス制御を適用する。
- EARS-RBAC-002: The system shall ユーザーに割り当てられたロールに基づいて機能へのアクセスを許可または拒否する。
- EARS-RBAC-003: The system shall 全てのデータをテナント（組織）単位で完全に分離する。

#### イベント駆動要件（認証）
- EARS-RBAC-010: When ユーザーがログインを試みたとき、the system shall 資格情報を検証し、成功した場合はJWTトークンを発行する。
- EARS-RBAC-011: When ログインが成功したとき、the system shall ユーザーのロールと組織情報をセッションに格納し、監査ログに認証成功を記録する。
- EARS-RBAC-012: When ログインが失敗したとき、the system shall 失敗理由を監査ログに記録し、ユーザーにエラーメッセージを表示する。
- EARS-RBAC-013: When ユーザーが3回連続でログインに失敗したとき、the system shall 当該アカウントを15分間一時ロックする。
- EARS-RBAC-014: When MFAが有効なアカウントでログインが試みられたとき、the system shall 第2要素（OTPまたは認証アプリ）による追加認証を要求する。
- EARS-RBAC-015: When ユーザーがログアウトしたとき、the system shall セッションを無効化し、監査ログにログアウトを記録する。

#### イベント駆動要件（認可）
- EARS-RBAC-020: When ユーザーが機能にアクセスしようとしたとき、the system shall 当該ユーザーのロールに付与された権限を確認し、許可された場合のみアクセスを許可する。
- EARS-RBAC-021: When ユーザーが権限のない機能にアクセスしようとしたとき、the system shall アクセスを拒否し、権限不足エラーを表示し、試行を監査ログに記録する。
- EARS-RBAC-022: When ユーザーが自組織以外のデータにアクセスしようとしたとき、the system shall RLSポリシーによりアクセスを拒否する。
- EARS-RBAC-023: When Super Adminがテナント横断アクセスを実行したとき、the system shall アクセス対象とアクション内容を監査ログに記録する。

### 4.2 ロール管理要件

#### イベント駆動要件
- EARS-RBAC-030: When Org Adminが新規ユーザーを招待したとき、the system shall 招待メールを送信し、招待ステータスを「保留中」として記録する。
- EARS-RBAC-031: When 招待されたユーザーが招待を受諾したとき、the system shall ユーザーアカウントを作成し、指定されたロールを割り当て、監査ログに記録する。
- EARS-RBAC-032: When Org Adminがユーザーのロールを変更したとき、the system shall 新しいロールを適用し、変更前後の情報を監査ログに記録する。
- EARS-RBAC-033: When System Operatorがユーザーを招待し「システム運営者」ロールを指定したとき、the system shall System Operatorロールでの招待を許可する。
- EARS-RBAC-034: When Org Admin（非System Operator）がユーザーを招待したとき、the system shall 「システム運営者」ロールの選択肢を表示しない。
- EARS-RBAC-035: When ユーザーが組織から削除されたとき、the system shall 当該ユーザーの全ロール割り当てを解除し、監査ログに記録する。

#### 状態駆動要件
- EARS-RBAC-040: While ユーザーアカウントが無効化されている間、the system shall 当該ユーザーからのログイン要求を拒否する。
- EARS-RBAC-041: While 招待が保留中の状態である間、the system shall 招待リンクの有効期限（7日間）を監視し、期限切れの場合は招待を無効化する。

### 4.3 文書管理アクセス要件

#### イベント駆動要件
- EARS-RBAC-050: When Userロールのユーザーが自分が作成した文書を編集しようとしたとき、the system shall 編集を許可する。
- EARS-RBAC-051: When Userロールのユーザーが他者が作成した文書を編集しようとしたとき、the system shall 編集を拒否し、権限不足エラーを表示する。
- EARS-RBAC-052: When Approverロールのユーザーが文書承認画面にアクセスしたとき、the system shall 承認待ちの文書一覧を表示し、承認・却下操作を許可する。
- EARS-RBAC-053: When Userロールのユーザーが文書承認を試みたとき、the system shall 承認を拒否し、権限不足エラーを表示する。
- EARS-RBAC-054: When Org Admin/Approverがエクスポートを実行したとき、the system shall `export_events`テーブルにエクスポート記録を保存する。

### 4.4 リスクアセスメントアクセス要件

#### イベント駆動要件
- EARS-RBAC-060: When Userロールのユーザーがリスク登録を試みたとき、the system shall リスク登録を許可する。
- EARS-RBAC-061: When Userロールのユーザーがリスク対応策の承認を試みたとき、the system shall 承認を拒否し、権限不足エラーを表示する。
- EARS-RBAC-062: When Approverロールのユーザーがリスク対応策を承認したとき、the system shall 承認ステータスを更新し、承認者・承認日時を記録する。
- EARS-RBAC-063: When Userロールのユーザーがリスクレポート生成を試みたとき、the system shall レポート生成を拒否し、権限不足エラーを表示する。

### 4.5 監査管理アクセス要件

#### イベント駆動要件
- EARS-RBAC-070: When Auditorロールのユーザーが監査計画を作成したとき、the system shall 監査計画の作成を許可し、計画情報を保存する。
- EARS-RBAC-071: When Userロールのユーザーが監査計画作成を試みたとき、the system shall 作成を拒否し、権限不足エラーを表示する。
- EARS-RBAC-072: When Auditorが自身が関与した活動を監査対象として選択したとき、the system shall 職務分離違反として警告を表示し、監査対象からの除外を推奨する。
- EARS-RBAC-073: When Approverが自身が作成した文書の承認を試みたとき、the system shall 職務分離違反として承認を拒否する。

### 4.6 システム管理アクセス要件

#### イベント駆動要件
- EARS-RBAC-080: When Super Adminが新規テナントを作成したとき、the system shall テナント情報を登録し、初期System Operatorアカウントを発行する。
- EARS-RBAC-081: When System Operatorが組織設定を変更したとき、the system shall 変更を適用し、変更内容を監査ログに記録する。
- EARS-RBAC-082: When Org Adminがシステム設定（テナント内）の変更を試みたとき、the system shall 変更を拒否し、権限不足エラーを表示する。
- EARS-RBAC-083: When 管理者ロール（Super Admin/System Operator/Org Admin）が監査ログを閲覧したとき、the system shall 閲覧権限に応じた範囲のログを表示する。

### 4.7 セキュリティ・監査要件

#### ユビキタス要件
- EARS-RBAC-090: The system shall 全ての権限変更操作を監査ログに記録する。
- EARS-RBAC-091: The system shall 監査ログを改ざん防止の仕組みで保護する。

#### イベント駆動要件
- EARS-RBAC-100: When 権限違反のアクセス試行が検出されたとき、the system shall 試行内容を監査ログに記録し、管理者にアラートを送信する。
- EARS-RBAC-101: When 四半期の権限レビュー期限が到来したとき、the system shall Org Adminにユーザー権限棚卸しの通知を送信する。
- EARS-RBAC-102: When ユーザーアカウントが90日間使用されていないとき、the system shall アカウントを自動的に無効化し、Org Adminに通知する。
- EARS-RBAC-103: When 異常なアクセスパターン（短時間での大量データアクセス等）が検出されたとき、the system shall 管理者にセキュリティアラートを送信する。

## 5. データアクセス制御

### 5.1 テナント分離
- 全てのデータはテナント（組織）単位で完全に分離
- Supabase Row Level Security (RLS)を使用したデータベースレベルの分離
- Super Admin のみ全テナント横断アクセスを許可し、それ以外（System Operator を含む）は自組織データのみに制限

### 5.2 部門間アクセス制御
- 組織内で部門を設定可能
- 文書やリスクに部門タグを付与
- 部門横断的なアクセスは権限により制御

### 5.3 個人情報保護
- ユーザーの個人情報へのアクセスは最小限に制限
- パスワードは暗号化して保存
- 監査ログには個人を特定可能な最小限の情報のみ記録

## 6. 実装に必要な開発タスク

### 6.1 認証・認可基盤
1. **ユーザー認証システムの実装**
   - Supabase Authを使用したJWT認証
   - MFA（多要素認証）対応
   - パスワードポリシーの実装

2. **ロール管理システムの実装**
   - ロールテーブルの作成
   - ユーザー・ロール紐付けテーブル
   - ロール継承機能

3. **権限チェックミドルウェアの実装**
   - APIレベルでの権限チェック
   - UIレベルでの表示制御
   - リソースレベルのアクセス制御

### 6.2 データベース設計
1. **RBACテーブル構造**
   ```sql
   -- ロール定義
   CREATE TABLE roles (
     id UUID PRIMARY KEY,
     name VARCHAR(50) UNIQUE NOT NULL,
     description TEXT,
     is_system_role BOOLEAN DEFAULT FALSE
   );

   -- 権限定義
   CREATE TABLE permissions (
     id UUID PRIMARY KEY,
     resource VARCHAR(100) NOT NULL,
     action VARCHAR(50) NOT NULL,
     description TEXT
   );

   -- ロール・権限マッピング
   CREATE TABLE role_permissions (
     role_id UUID REFERENCES roles(id),
     permission_id UUID REFERENCES permissions(id),
     PRIMARY KEY (role_id, permission_id)
   );

   -- ユーザー・ロール割当
   CREATE TABLE user_roles (
     user_id UUID REFERENCES auth.users(id),
     role_id UUID REFERENCES roles(id),
     organization_id UUID REFERENCES organizations(id),
     assigned_at TIMESTAMP DEFAULT NOW(),
     assigned_by UUID REFERENCES auth.users(id),
     PRIMARY KEY (user_id, role_id, organization_id)
   );
   ```

2. **Row Level Security (RLS)ポリシーの実装**
   - テナント分離ポリシー
   - ロールベースアクセスポリシー
   - リソース所有者ポリシー

### 6.3 API層の実装
1. **認可デコレーター/ミドルウェア**
   ```typescript
   // 例: Next.js API Route
   @RequireRole(['admin', 'approver'])
   @RequirePermission('document.approve')
   async function approveDocument(req, res) {
     // 文書承認処理
   }
   ```

2. **コンテキストベースの権限チェック**
   - リソースの所有者チェック
   - 部門アクセス権チェック
   - 承認フローの権限チェック

### 6.4 UI層の実装
1. **条件付きレンダリング**
   ```typescript
   // 権限に基づく表示制御
   {hasPermission('document.approve') && (
     <ApproveButton onClick={handleApprove} />
   )}
   ```

2. **ロール別ダッシュボード**
   - ロールに応じた機能の表示/非表示
   - ロール別のデフォルトビュー
   - アクセス権のない機能へのリダイレクト

### 6.5 監査・ログ機能
1. **アクセスログの実装**
   - 全てのデータアクセスを記録
   - 権限違反の試行を記録
   - ログの改ざん防止対策

2. **権限変更履歴**
   - ロール割当の変更履歴
   - 権限設定の変更履歴
   - 承認者の記録

## 7. セキュリティ考慮事項

### 7.1 最小権限の原則
- 各ロールには業務遂行に必要な最小限の権限のみ付与
- デフォルトは全て拒否、必要な権限のみ明示的に許可

### 7.2 職務分離
- 監査員は自身が関与した活動を監査不可
- 承認者は自身が作成した文書を承認不可
- システム運営者のアクションは全て監査ログに記録

### 7.3 権限昇格の防止
- 一時的な権限昇格機能は実装しない
- 緊急時のアクセスは別途承認プロセスを経由

### 7.4 定期的な権限レビュー
- 四半期ごとのユーザー権限棚卸し機能
- 未使用アカウントの自動無効化
- 異常なアクセスパターンの検知

## 8. 今後の拡張計画

### 8.1 動的権限管理
- カスタムロールの作成機能
- 権限の委譲機能
- 時限的な権限付与

### 8.2 高度なアクセス制御
- 属性ベースアクセス制御（ABAC）への拡張
- コンテキストアウェアなアクセス制御
- リスクベース認証

### 8.3 外部連携
- SAML/OAuth2による外部IdP連携
- Active Directory連携
- SCIM対応によるユーザープロビジョニング

## 9. 実装優先順位

1. **Phase 1（MVP）**: 基本的なRBAC実装
   - 5つの基本ロールの実装
   - 基本的な権限チェック機能
   - テナント分離

2. **Phase 2**: 高度な権限管理
   - 部門別アクセス制御
   - 詳細な監査ログ
   - 権限レビュー機能

3. **Phase 3**: エンタープライズ機能
   - カスタムロール
   - 外部IdP連携
   - 高度なセキュリティ機能

## 10. System Operator 招待ポリシー
System Operator ロールの増員は次の要件を満たす必要がある。

1. **UI 制約**: `/ja/settings/users` の招待モーダルは、現在ログインしているユーザーが System Operator の場合のみ「システム運営者」を選択肢として表示する。Org Admin 配下では表示されず、誤って昇格させることができない。
2. **サーバー制約**: `organization_invitations` テーブルの RLS ポリシー（20251119101500_system_operator_invites.sql）で `role = 'system_operator'` の挿入/更新は `get_user_role()` が `system_operator` または `super_admin` のときだけ許可される。
3. **監査**: 招待と受諾は `audit_logs` に `user.invited` / `user.accepted_invitation` のレコードとして `role: system_operator` を保持し、誰が昇格させたか追跡可能とする。
4. **Dev Login 補助**: System Operator を増員した後は Dev Login でも同じメールアドレスを指定して system_operator ロールでログインできる。これにより MSP など複数管理者が必要なケースでも Super Admin を介さずに運用できる。
