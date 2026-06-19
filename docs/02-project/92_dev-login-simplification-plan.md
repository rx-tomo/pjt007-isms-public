# Dev Login 簡素化: 設計見直しと実装計画

作成日: 2026-02-05

## 目的
開発段階の Dev Login を「役割選択→必要最小限の選択」で完了できるようにし、
現在の複雑な入力（権限マトリクスや詳細設定）を排除する。

## 現状
- `app/[locale]/dev-login/page.tsx` に役割選択、テナント選択、ユーザー選択、権限マトリクス、MFA情報などが集約されており複雑。
- `app/api/dev/login` は role/email/organizationId/permissions を受け取り、
  シナリオ定義（`lib/dev-login/scenarios.ts`）を元にユーザー/組織/権限を準備。

## 新しい期待挙動
1. **Super Admin**
   - ロール選択後、クリックのみで即ログイン。
   - テナント選択は不要。

2. **テナント管理者（org_admin）**
   - ロール選択後、テナント選択 UI を表示。
   - テナントを選んだ後にログイン。
   - 1ユーザーが複数テナントを扱える前提を反映。

3. **ユーザレベル（user / approver / auditor / system_operator）**
   - ロール選択後、テナント選択 UI を表示。
   - その後、該当テナントのユーザー（メール）を選択する UI を表示。
   - これにより「どのユーザーとして、どのテナントに入るか」を疑似的に選択できる。

## 取り除く/簡素化する要素
- 権限マトリクス UI（permission matrix）
- 既定権限を上書きする詳細トグル
- 役割ごとの詳細説明パネルの過剰な情報
- プロファイルリセットのトグル（必要なら管理者側で実施）
- MFA/SSOの情報パネル（運用情報は別ドキュメントへ）

## 変更対象と実装方針
### UI
- `app/[locale]/dev-login/page.tsx`
  - 役割選択 → 条件付きのテナント/ユーザー選択に切替
  - super_admin は即ログインボタン表示
  - org_admin はテナント選択のみ
  - user/approver/auditor/system_operator はテナント選択 + ユーザー選択

### API
- `app/api/dev/login/route.ts`
  - `permissions` を必須入力から除外
  - `organizationId` が必要なロールのみ必須化
  - `email` はユーザー選択に依存

### シナリオ定義
- `lib/dev-login/scenarios.ts`
  - 権限テンプレートは内部固定
  - org_admin/user/auditor/approver のテナントは選択に依存

## 追加・変更タスク
1. UI レイアウトの簡素化
2. ロールごとの分岐フロー実装
3. API 側の入力要件調整
4. 想定フローの QA 追加

## 影響範囲
- Dev Login のみ（本番の Auth には影響しない）
- QA スクリプトで dev-login に依存している場合は確認が必要

