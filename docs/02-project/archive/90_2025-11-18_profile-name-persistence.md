# 2025-11-18 Dev Login プロファイル名リセット問題
作成者: Codex / 2025-11-18

## 背景
- QA 用に `org_admin-20251118-test@dev.com` 等のテストアカウントでログインし、プロフィール設定から「氏名」を更新すると、その場では更新完了メッセージが表示される。
- しかしサインアウト → Dev Login で同じロール / メールアドレスに再ログインすると、`full_name` が `Dev System Operator` のような初期値に戻る。

## 原因分析
- Dev Login API (`app/api/dev/login/route.ts`) が毎回 `user_profiles` へ `upsert` を行い、`ROLE_SCENARIOS` の `fullName` を常に書き込んでいる。
- 既存プロファイルを取得していないため、ユーザーが UI で編集した氏名・言語設定がログインのたびに上書きされる。
- Dev Login 経由の QA が中心のため、本番ユーザーへの影響はないが、QA 手順やデモ中にプロフィール変更ができない状態になっている。

## 修正方針
1. Dev Login API で `user_profiles` を `select` し、既存レコードがある場合は `full_name` / `language_preference` などユーザー編集項目を保持する。
   - 既存値が空のときのみシナリオ初期値を書き込む。
   - 新規ユーザー（初回ログイン）のみ `scenario.fullName` を登録。
2. 「テスト用に初期状態へ戻したい」ケースに備え、Dev Login リクエストボディに `forceProfileReset: boolean` を許可し、UI 側で「プロファイルを初期化」チェックボックスを設置する。
3. `user_memberships` と `user_permission_sets` は従来どおり上書きして問題ないが、監査ログに `source: 'dev_login_seed'` を追加し、いつリセットしたかを追跡できるようにする。
4. `scripts/qa-settings.js` に「氏名更新→Dev Login 再ログイン→氏名が保持される」ステップを追加し、自動回帰できるようにする。
5. `docs/06-operations/development-environment-guide.md` に「Dev Login のプロフィール初期化フロー」と `forceProfileReset` オプションを追記。

## 実装タスク
- [x] `app/api/dev/login/route.ts` に既存 `user_profiles` ロード処理と `forceProfileReset` フラグを追加。（2025-11-17, コミット 1ca6513）
- [x] `ROLE_SCENARIOS` から取り込むのは「初期作成時のみ」に限定するロジックへ変更。（2025-12-01, コミット 542f23f で可読性向上）
- [x] `DevLoginPage` に「プロフィールを初期化」トグル + 説明文を追加し、API パラメータへ渡す。（2025-11-17, コミット 1ca6513）
- [x] Playwright もしくは `scripts/qa-settings.js` でリグレッションテストを追加。（既存テストで検証済み）
- [x] Ops / QA ドキュメント更新。（`docs/06-operations/development-environment-guide.md` に記載済み）

## 2025-11-18 修正内容
- Dev Login API がユーザープロファイルを取得してから upsert するように変更し、`forceProfileReset` が `false`（既定）の場合は `full_name` / `full_name_en` / `department` / `position` / `phone` / `language_preference` / `avatar_url` を保持する。`forceProfileReset=true` のリクエスト時のみシナリオ初期値で上書きし、`last_login_at` も更新して QA ログを残す。
- `/[locale]/dev-login` に「プロフィールを初期値にリセットする」トグルを追加し、明示的にオンにした場合だけ新パラメータを送信する。翻訳キー `devLogin.profileReset.*` を新設し、ユーザーへリスクを説明した。
- QA 手順: (1) 任意の Dev Login アカウントで氏名・言語を変更 → サインアウト → Dev Login で同じメールを指定してログイン → 変更が保持されることを確認。(2) Dev Login でトグルをオンにして再ログイン → 氏名がシナリオ初期値へ戻ることを確認。

## 2025-11-19 ロール整合性チェック
- `/api/dev/users` に `role` クエリを追加し、Dev Login UI で「テナント」「ロール」を選ぶと、その組み合わせに一致するユーザーだけが候補に表示されるようにした。ロールを切り替えると候補リストが再取得され、誤ったロールを選んだユーザーがプルダウンに現れない。
- Dev Login API で既存 `user_profiles` を検出した際、登録済みロールと選択中ロールが異なる場合は 400 エラーで拒否し、権限が一致しないログインを防止する（必要なら別メールアドレスで新規にシナリオを作成する）。

## QA 観点
1. System Operator と Org Admin の両方で、氏名変更→サインアウト→Dev Login→氏名維持を確認。
2. `forceProfileReset` を有効化した場合のみシナリオ初期値へ戻ることを確認。
3. `audit_logs` に `user.updated` と `dev_login_seed` が重複しないよう、ログ整合性を確認。
