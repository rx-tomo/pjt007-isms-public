# 2025-11-20 認証・ロール設計レビュー
作成者: Antigravity / 2025-11-20

## 概要
本ドキュメントは、B2B SaaSとしてのマルチテナント要件および将来的なGoogle OAuth連携の観点から、現在の認証・ロール設計と実装をレビューした結果をまとめたものです。

## 1. ロール設計とマルチテナント構造

### 現状の設計
- **データ構造**:
    - `organizations`: テナント情報。
    - `user_memberships`: ユーザーと組織の多対多の関係（所属）。
    - `user_profiles`: ユーザーの基本情報と**現在アクティブな** `organization_id` および `role` を保持。
    - `user_permission_sets`: 詳細な権限設定。
- **アクセス制御**:
    - `lib/server/supabase/secureClient.ts` の `requireServiceRole` 関数が、`user_profiles` の `organization_id` と `role` に基づいてアクセスを制御しています。

### 課題とリスク
1.  **「アクティブテナント」依存のリスク**:
    - アクセス制御が `user_profiles.organization_id` に依存しています。これは「ユーザーは一度に1つの組織にのみログインしている」というモデルです。
    - **リスク**: ユーザーがテナントを切り替える際、`user_profiles` を更新する必要があります。この「切り替え処理」において、`user_memberships` の厳密なチェックが漏れると、権限のない組織へアクセスできてしまう可能性があります。
2.  **テナント切り替えAPIの不在**:
    - 現在、開発用ログイン (`dev/login`) ではプロファイルを直接書き換えてテナントを切り替えていますが、本番用の「テナント切り替えAPI」が見当たりません。

### 推奨事項
- **テナント切り替えAPIの実装**: `user_memberships` を検証した上で `user_profiles.organization_id` を更新する専用APIを実装する。
- **セッション内でのテナント管理**: 可能であれば、DBへの書き込み（`user_profiles`更新）ではなく、セッション（Cookie/JWT）側でアクティブテナントを管理する方が、DB負荷と競合の観点で望ましい場合があります（ただし現状のSupabase Authとの兼ね合いでDB管理が現実的かもしれません）。

## 2. Google OAuth 連携への準備状況

### 現状の実装 (Dev Login)
- `app/api/dev/login/route.ts` は、バックドア的に `supabase.auth.admin` を使用してユーザーを作成・更新し、パスワード認証を行っています。
- これはOAuthフローとは完全に異なるロジックです。

### ギャップ分析 (OAuth Readiness)
1.  **コールバック処理の欠如**:
    - Google OAuth ログイン後のリダイレクトを受け取る `app/auth/callback/route.ts` (または類似) が存在しません。
    - **必要性**: OAuth認証後、以下の処理を行うサーバーサイドロジックが必要です。
        - `auth.users` の存在確認。
        - `user_profiles` の作成（初回）または更新（アバター、氏名の同期）。
        - 招待 (`organization_invitations`) との紐付け処理。
2.  **プロファイル同期**:
    - Googleアカウントの氏名やアバター画像を `user_profiles` に同期するロジックが未実装です。
3.  **サインアップフローの分離**:
    - 現在の `app/api/auth/signup/route.ts` は `userId` を受け取る形式で、フロントエンド側でのAuthユーザー作成を前提としています。OAuthの場合、ユーザー作成はプロバイダ連携時に行われるため、フローの統合が必要です。

## 3. バグ・懸念事項

1.  **ミドルウェアの `dev-login` 判定**:
    - `middleware.ts` に `/dev-login` パスに対する特別な処理があります。本番環境でこのパスが誤って露出しないよう、環境変数 (`NODE_ENV`) によるガードが必須です（現状のコードにはガードが見当たりません）。
    - **修正案**: `middleware.ts` 内で `process.env.NODE_ENV === 'production'` の場合は `/dev-login` へのアクセスをブロックする。

2.  **`users` テーブルの存在**:
    - `database.types.ts` に `users` テーブルがありますが、コード上は `user_profiles` が主に使用されています。
    - **確認**: `users` テーブルが不要であれば削除し、混乱を避けるべきです。

## 結論と次のステップ

現在の実装は「開発用」としては機能していますが、B2B SaaSの本番運用（特にGoogle OAuthとマルチテナント）に向けては、**認証コールバックの実装**と**テナント切り替えの厳格化**が急務です。

### 優先タスク
1.  **OAuth Callbackの実装**: `auth/callback` ルートを作成し、プロファイル同期と招待受諾ロジックを実装する。
2.  **テナント切り替えAPIの実装**: 安全にテナントを行き来する機能を作成する。
3.  **ミドルウェアの強化**: 本番環境でのデバッグルート封鎖。
