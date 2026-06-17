---
title: ISMS Pilot セキュリティ要件定義書
category: architecture
created: 2025-12-01
last_updated: 2025-12-01
author: Claude
ears_compliant: true
---

# ISMS Pilot セキュリティ要件定義書

## 1. 概要

本ドキュメントは、ISMS Pilotにおけるセキュリティ要件をEARS（Easy Approach to Requirements Syntax）形式で定義します。ISO/IEC 27001の要求事項に準拠し、自社でもISMS認証取得を前提とした設計を行います。

## 2. セキュリティ要件カテゴリ

| カテゴリ | ID範囲 | 概要 |
|---------|--------|------|
| 認証・認可 (AUTH) | EARS-AUTH-001〜 | ユーザー認証、セッション管理 |
| データ保護 (DATA) | EARS-DATA-001〜 | 暗号化、データ分離 |
| 通信セキュリティ (COMM) | EARS-COMM-001〜 | TLS、API保護 |
| 監査・ログ (AUDIT) | EARS-AUDIT-001〜 | 操作ログ、改ざん防止 |
| インシデント対応 (INC) | EARS-INC-001〜 | 検知、対応、復旧 |
| 可用性・復旧 (AVAIL) | EARS-AVAIL-001〜 | バックアップ、災害復旧 |

---

## 3. 認証・認可要件 (AUTH)

### 3.1 ユビキタス要件

- EARS-AUTH-001: The system shall ユーザー認証にSupabase Authを使用し、JWTベースのセッション管理を実装する。
- EARS-AUTH-002: The system shall パスワードをbcryptまたはargon2でハッシュ化して保存する。
- EARS-AUTH-003: The system shall パスワードポリシーとして最低8文字以上、英大文字・英小文字・数字・記号のうち3種類以上を要求する。
- EARS-AUTH-004: The system shall セッショントークンの有効期限を24時間とする。

### 3.2 イベント駆動要件

- EARS-AUTH-010: When ユーザーがログインを試みたとき、the system shall 資格情報を検証し、成功時にJWTトークンを発行する。
- EARS-AUTH-011: When ユーザーが3回連続でログインに失敗したとき、the system shall 当該アカウントを15分間一時ロックする。
- EARS-AUTH-012: When アカウントがロックされた状態でログインを試みたとき、the system shall ロック解除までの残り時間を表示し、認証を拒否する。
- EARS-AUTH-013: When ユーザーがパスワードリセットを要求したとき、the system shall 登録メールアドレスに1時間有効のリセットリンクを送信する。
- EARS-AUTH-014: When パスワードリセットリンクが使用されたとき、the system shall リンクを即座に無効化する。
- EARS-AUTH-015: When ユーザーがパスワードを変更したとき、the system shall 全ての既存セッションを無効化し、再認証を要求する。
- EARS-AUTH-016: When MFAが有効なアカウントでログインが成功したとき、the system shall 第2要素（TOTP）による追加認証を要求する。
- EARS-AUTH-017: When MFA認証が5回連続で失敗したとき、the system shall MFA認証を30分間ブロックする。
- EARS-AUTH-018: When 管理者がユーザーのMFAをリセットしたとき、the system shall 当該ユーザーの次回ログイン時にMFA再設定を要求する。
- EARS-AUTH-019: When ユーザーがログアウトしたとき、the system shall 現在のセッションを無効化し、クライアント側のトークンを削除する。

### 3.3 状態駆動要件

- EARS-AUTH-020: While セッションが30分間非アクティブである間、the system shall セッションをタイムアウトさせ、再認証を要求する。
- EARS-AUTH-021: While アカウントが無効化されている間、the system shall 当該アカウントからの全ての認証要求を拒否する。
- EARS-AUTH-022: While パスワードが90日以上変更されていない間、the system shall ログイン時にパスワード変更を推奨するメッセージを表示する。

### 3.4 オプション要件

- EARS-AUTH-030: Where SAML SSOが設定されている場合、the system shall 外部IdPを通じた認証を許可する。
- EARS-AUTH-031: Where OAuth SSOが設定されている場合、the system shall Google/Microsoft/Okta等の外部プロバイダーによる認証を許可する。
- EARS-AUTH-032: Where 組織でMFA必須ポリシーが有効な場合、the system shall MFA未設定のユーザーに対してMFA設定を強制する。

---

## 4. データ保護要件 (DATA)

### 4.1 ユビキタス要件

- EARS-DATA-001: The system shall 全ての保存データをAES-256で暗号化する。
- EARS-DATA-002: The system shall Supabase Row Level Security (RLS)を使用してテナント間のデータを完全に分離する。
- EARS-DATA-003: The system shall 個人情報（PII）を含むフィールドを識別し、追加の保護措置を適用する。
- EARS-DATA-004: The system shall データベースバックアップを暗号化して保存する。
- EARS-DATA-005: The system shall 契約期間中のデータを最大7年間保持する。

### 4.2 イベント駆動要件

- EARS-DATA-010: When ユーザーが他組織のデータにアクセスしようとしたとき、the system shall RLSポリシーによりアクセスを拒否し、試行を監査ログに記録する。
- EARS-DATA-011: When データエクスポートが要求されたとき、the system shall エクスポート内容・要求者・日時を監査ログに記録する。
- EARS-DATA-012: When 契約が終了したとき、the system shall 90日間のデータ保持期間を開始する。
- EARS-DATA-013: When データ保持期間が終了したとき、the system shall 当該組織の全データを完全に削除（論理削除ではなく物理削除）する。
- EARS-DATA-014: When ユーザーがGDPR/個人情報保護法に基づくデータ削除を要求したとき、the system shall 30日以内に当該ユーザーの個人データを削除する。
- EARS-DATA-015: When データベースのバックアップが実行されたとき、the system shall バックアップの成功/失敗を監査ログに記録する。
- EARS-DATA-016: When 機密データ（パスワード、APIキー等）がログに出力されそうになったとき、the system shall 当該データをマスキングする。

### 4.3 状態駆動要件

- EARS-DATA-020: While データが転送中である間、the system shall TLS 1.2以上で暗号化する。
- EARS-DATA-021: While バックアップデータが保存されている間、the system shall 暗号化状態を維持する。

---

## 5. 通信セキュリティ要件 (COMM)

### 5.1 ユビキタス要件

- EARS-COMM-001: The system shall 全ての外部通信にTLS 1.2以上を使用する。
- EARS-COMM-002: The system shall HTTP Strict Transport Security (HSTS)を有効にする。
- EARS-COMM-003: The system shall Content Security Policy (CSP)ヘッダーを設定し、XSS攻撃を軽減する。
- EARS-COMM-004: The system shall X-Frame-Optionsヘッダーを設定し、クリックジャッキングを防止する。
- EARS-COMM-005: The system shall APIリクエストにレート制限を適用する（デフォルト: 100リクエスト/分/ユーザー）。

### 5.2 イベント駆動要件

- EARS-COMM-010: When TLS 1.1以下での接続が試みられたとき、the system shall 接続を拒否する。
- EARS-COMM-011: When APIレート制限を超過したとき、the system shall 429 Too Many Requestsを返し、リトライ可能時刻をヘッダーに含める。
- EARS-COMM-012: When 不正なAPIリクエスト（SQLインジェクション、XSSペイロード等）が検出されたとき、the system shall リクエストを拒否し、セキュリティログに記録する。
- EARS-COMM-013: When CORS違反のリクエストが検出されたとき、the system shall リクエストを拒否する。
- EARS-COMM-014: When Webhookを送信するとき、the system shall HMACシグネチャを付与して改ざんを検証可能にする。

### 5.3 状態駆動要件

- EARS-COMM-020: While 同一IPから短時間に大量のリクエストが発生している間、the system shall 追加のレート制限を適用する。

---

## 6. 監査・ログ要件 (AUDIT)

### 6.1 ユビキタス要件

- EARS-AUDIT-001: The system shall 全てのユーザー操作を監査ログとして記録する。
- EARS-AUDIT-002: The system shall 監査ログを最低3年間保持する（ISMSポリシー準拠）。
- EARS-AUDIT-003: The system shall 監査ログにタイムスタンプ・ユーザーID・操作種別・対象リソース・IPアドレスを含める。
- EARS-AUDIT-004: The system shall 監査ログを追記専用（append-only）で保存し、改ざんを防止する。

### 6.2 イベント駆動要件

- EARS-AUDIT-010: When ログインが成功したとき、the system shall ユーザーID・IPアドレス・ユーザーエージェント・ログイン日時を監査ログに記録する。
- EARS-AUDIT-011: When ログインが失敗したとき、the system shall 試行されたユーザーID・IPアドレス・失敗理由・日時を監査ログに記録する。
- EARS-AUDIT-012: When 権限変更（ロール割り当て、権限付与等）が行われたとき、the system shall 変更者・対象ユーザー・変更前後の権限・日時を監査ログに記録する。
- EARS-AUDIT-013: When データの作成・更新・削除が行われたとき、the system shall 操作者・対象データ・操作種別・日時を監査ログに記録する。
- EARS-AUDIT-014: When セキュリティ設定が変更されたとき、the system shall 変更者・変更内容・変更前後の設定・日時を監査ログに記録し、管理者に通知する。
- EARS-AUDIT-015: When 監査ログのエクスポートが要求されたとき、the system shall 指定期間のログをCSV/JSON形式でエクスポートし、エクスポート操作自体も監査ログに記録する。
- EARS-AUDIT-016: When 不正アクセスの試行が検出されたとき、the system shall セキュリティログに詳細を記録し、リアルタイムでアラートを発行する。

### 6.3 状態駆動要件

- EARS-AUDIT-020: While 監査ログストレージが容量の80%に達している間、the system shall 管理者にストレージ警告を送信する。

---

## 7. インシデント対応要件 (INC)

### 7.1 ユビキタス要件

- EARS-INC-001: The system shall セキュリティインシデントを検知・記録・追跡する機能を提供する。
- EARS-INC-002: The system shall インシデント対応の3段階エスカレーション（開発チーム→経営判断→外部専門家）をサポートする。

### 7.2 イベント駆動要件

- EARS-INC-010: When 異常なログインパターン（通常と異なる地域、深夜帯の大量アクセス等）が検出されたとき、the system shall セキュリティアラートを発行する。
- EARS-INC-011: When 短時間での大量データアクセス（通常の10倍以上）が検出されたとき、the system shall 当該セッションを一時停止し、管理者に通知する。
- EARS-INC-012: When 権限昇格の試行が検出されたとき、the system shall 試行を拒否し、高優先度のセキュリティアラートを発行する。
- EARS-INC-013: When セキュリティインシデントが報告されたとき、the system shall インシデントID・報告日時・重大度・初期対応者を記録する。
- EARS-INC-014: When インシデント対応が完了したとき、the system shall 根本原因・対応内容・再発防止策・完了日時を記録する。
- EARS-INC-015: When 重大なセキュリティインシデント（データ漏洩、不正アクセス成功等）が発生したとき、the system shall 関係者に即座に通知し、インシデント対応フローを開始する。

### 7.3 状態駆動要件

- EARS-INC-020: While インシデント対応中である間、the system shall インシデントステータスをリアルタイムで更新し、関係者に可視化する。

---

## 8. 可用性・復旧要件 (AVAIL)

### 8.1 ユビキタス要件

- EARS-AVAIL-001: The system shall 99.9%以上の可用性を維持する（年間ダウンタイム8.76時間以下）。
- EARS-AVAIL-002: The system shall 毎日自動バックアップを実行する。
- EARS-AVAIL-003: The system shall バックアップを地理的に分散した場所に保存する。
- EARS-AVAIL-004: The system shall 復旧目標時間（RTO）を4時間以内、復旧目標点（RPO）を1時間以内とする。

### 8.2 イベント駆動要件

- EARS-AVAIL-010: When システム障害が検出されたとき、the system shall 自動的にフェイルオーバーを実行する。
- EARS-AVAIL-011: When バックアップが失敗したとき、the system shall 運用チームにアラートを送信し、再試行を実行する。
- EARS-AVAIL-012: When 復旧手順が開始されたとき、the system shall 復旧状況をリアルタイムでログに記録する。
- EARS-AVAIL-013: When 計画メンテナンスが予定されたとき、the system shall 24時間前にユーザーに通知する。
- EARS-AVAIL-014: When サービスが復旧したとき、the system shall データ整合性チェックを実行し、結果をログに記録する。

### 8.3 状態駆動要件

- EARS-AVAIL-020: While メンテナンスモードである間、the system shall ユーザーにメンテナンス中メッセージを表示し、読み取り専用アクセスのみを許可する。

---

## 9. コンプライアンス要件

### 9.1 ユビキタス要件

- EARS-COMP-001: The system shall 個人情報保護法の要求事項に準拠する。
- EARS-COMP-002: The system shall ISO/IEC 27001の管理策に準拠した設計を維持する。
- EARS-COMP-003: The system shall OWASP Top 10の脆弱性対策を実装する。

### 9.2 イベント駆動要件

- EARS-COMP-010: When セキュリティパッチが公開されたとき、the system shall 重大度に応じた期限内（Critical: 24時間、High: 7日、Medium: 30日）にパッチを適用する。
- EARS-COMP-011: When 脆弱性スキャンで問題が検出されたとき、the system shall 検出内容を記録し、対応チケットを自動作成する。
- EARS-COMP-012: When 監査（内部/外部）が予定されたとき、the system shall 必要なログ・設定情報を出力可能な状態で提供する。

---

## 10. 要件ID一覧

| カテゴリ | ID範囲 | 件数 |
|---------|--------|------|
| 認証・認可 (AUTH) | EARS-AUTH-001 〜 032 | 22件 |
| データ保護 (DATA) | EARS-DATA-001 〜 021 | 12件 |
| 通信セキュリティ (COMM) | EARS-COMM-001 〜 020 | 11件 |
| 監査・ログ (AUDIT) | EARS-AUDIT-001 〜 020 | 11件 |
| インシデント対応 (INC) | EARS-INC-001 〜 020 | 10件 |
| 可用性・復旧 (AVAIL) | EARS-AVAIL-001 〜 020 | 10件 |
| コンプライアンス (COMP) | EARS-COMP-001 〜 012 | 6件 |
| **合計** | | **82件** |

---

## 11. 関連ドキュメント

- [ビジネス要件定義書](../01-business/requirements.md) - EARS形式の機能要件
- [RBAC設計書](./rbac-design.md) - アクセス制御の詳細設計
- [UIガイドライン](../07-design-system/ui-guidelines.md) - UI関連の要件

---

## 更新履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|-----------|---------|--------|
| 2025-12-01 | 1.0 | 初版作成（EARS形式で82件の要件を定義） | Claude |
