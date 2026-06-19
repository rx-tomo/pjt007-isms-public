---
title: Role Actor Usability Review - Audit Preparation Package
category: business
created: 2026-06-09
last_updated: 2026-06-10
status: reviewed_and_partially_remediated
---

# Role Actor Usability Review - Audit Preparation Package

## Summary

PR/FAQの外向き表現見直しを受け、審査準備パッケージ画面とPDF/ZIP成果物を、顧客向けに読める表現へ寄せた。あわせて、利用者が画面を見たときに「次に何をすればよいか」が分かるよう、次アクション表示を追加した。

## Role Inventory

| Role | 表示名 | 主画面 | 想定されるActor | 懸念 |
| ---- | ------ | ------ | ---------------- | ---- |
| org_admin | 組織管理者 | 審査準備パッケージ、文書、資産、リスク、管理策、タスク | 顧客側ISMS推進責任者 | 不足項目の修復導線が弱いと、どこから直すか分からない |
| system_operator | システム運営者 | 審査準備パッケージ、組織設定、運用支援画面 | サービス運営/導入支援担当 | 内部開発語が出ると顧客説明品質が落ちる |
| auditor | 監査員 | 審査準備パッケージ、監査、是正、フォローアップ | 内部監査担当 | 継続運用側の証跡不足が次アクションにつながらない |

## Actor Mapping

| Actor | 所属 | 対応Role | 目的 | 本サービス内でログインするか | 備考 |
| ----- | ---- | -------- | ---- | ---------------------------- | ---- |
| ISMS推進責任者 | 顧客側 | org_admin | 初回登録準備または継続運用の証跡を整え、審査準備状況を確認する | はい | 最初の実務検証の中心Actor |
| 内部監査担当 | 顧客側 | auditor | 継続運用の監査、是正、フォローアップの証跡を確認する | はい | 審査準備パッケージでは証跡確認のActor |
| 導入支援担当 | 運営側 | system_operator | 顧客テナントの準備状況を確認し、詰まりを案内する | はい | 顧客向け文言と内部開発語の境界を守る |

## Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面 |
| ----- | ----- | -------- | -------- | ---- | -------- |
| UC-PRFAQ-01 | ISMS推進責任者 | 審査準備状況を確認し、不足があれば関連画面へ移動する | 不足項目、理由、次に開く画面が分かる | 準備済みの場合はPDF/ZIP出力に進む | `/examination/submission-bundle` |
| UC-PRFAQ-02 | 内部監査担当 | 継続運用の年次証跡を確認し、審査準備パッケージとして出力する | 監査、是正、フォローアップ、マネジメントレビュー、残留リスク受容が確認できる | 不足があれば関連画面に戻る | `/examination/submission-bundle` |
| UC-PRFAQ-03 | 導入支援担当 | 顧客に見せる資料から内部開発語を除き、審査準備支援として説明する | UI/PDF/ZIP/PR/FAQで外向き表現が揃う | 内部API/test名には識別子として残る | messages、PDF、PR/FAQ |

## Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 初回登録準備のパッケージ画面で次に何をするか確認する | ISMS推進責任者 | 改善済み | 準備済み時の出力CTAを次アクションとして明示 | `tests/e2e/initial-w02-submission-bundle.spec.ts` | P1 |
| 初回登録準備の不足状態で関連画面へ移動する | ISMS推進責任者 | 改善済み | 適用管理策判断版が未発行の場合、管理策画面へ誘導できる | `tests/e2e/initial-w02-submission-bundle.spec.ts` | P1 |
| 継続運用のパッケージ画面で次に何をするか確認する | 内部監査担当 | 改善済み | 準備済み時の出力CTAを次アクションとして明示 | `tests/e2e/surveillance-submission-bundle.spec.ts` | P1 |
| 継続運用の不足状態で関連画面へ移動する | 内部監査担当 | 改善済み | 内部監査報告書が未承認の場合、監査報告書画面へ誘導できる。監査報告書一覧はAPI取得へ切り替え、client/server境界エラーを解消済み | `tests/e2e/surveillance-submission-bundle.spec.ts`, `app/[locale]/audit/reports/page.tsx`, `app/api/audit/route.ts` | P1 |
| ロール切替後の背景通知ポーリングを確認する | 導入支援担当 | 改善済み | 認証中ユーザーと通知取得対象がずれた場合の401/403を背景取得では空通知扱いにし、画面操作のノイズを減らした | `lib/services/notification.ts`, `tests/e2e/surveillance-submission-bundle.spec.ts` | P2 |
| 顧客向け成果物に内部開発語が混ざらないか確認する | 導入支援担当 | 改善済み | PDFタイトル、ZIP内ファイル名、ダウンロード名、画面メッセージ、API error、QA証跡名を審査準備パッケージへ統一 | `app/api/examination/submission-bundle/route.ts`, `app/[locale]/examination/submission-bundle/page.tsx`, `messages/ja.json`, `messages/en.json`, `tests/e2e/initial-w02-submission-bundle.spec.ts`, `tests/e2e/surveillance-submission-bundle.spec.ts` | P1 |
| 初回登録準備の管理策判断を承認・却下・再申請・版レビューまで確認する | ISMS推進責任者 / 承認者 | 改善済み | テスト証跡・サービスコメント上のSoA表記を「適用管理策判断」へ寄せ、承認キューの表示とE2Eを再確認した | `tests/e2e/initial-w02-soa-readiness.spec.ts`, `lib/services/isoControl.ts` | P1 |
| 初回登録準備/継続運用のフェーズ表現を確認する | ISMS推進責任者 / 導入支援担当 | 改善済み | 英語UIに残っていた Initial cycle / Surveillance cycle を、利用者向けの Initial certification preparation / Annual ISMS operation へ置き換えた。日本語UIは初回登録準備/継続運用のまま確認済み | `messages/en.json`, `tests/e2e/phase-selector.spec.ts`, `tests/e2e/home-phase-sync.spec.ts` | P1 |

## Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 準備状況は分かるが、次に何をすべきかが弱い | UX gap | P1 | remediated_for_representative_initial_and_surveillance_gaps |
| `審査準備パッケージ` / `Audit Preparation Package` を主要表現として統一しきれていない | UI copy gap | P1 | remediated_for_runtime_surface |
| `SoA` や `surveillance` の内部ラベルが顧客向けに出る可能性がある | UI copy gap | P1 | remediated_for_soa_runtime_surface / phase_label_remaining_review |
| 関連画面へ遷移してもclient/server境界エラーで一覧が読めない | UX gap / implementation gap | P1 | remediated_for_audit_reports_page |
| ロール切替後の通知ポーリングForbiddenが操作確認ログに残る | UX noise / implementation gap | P2 | remediated_for_background_notification_fetch |
| 多段承認、承認者責任、提出先向けPDFデザインは未整理 | Business decision needed / UX gap | P1/P2 | backlog |

## Backlog Additions

今回の修正は、`PRFAQ-BL-05`、`PRFAQ-BL-06`、`PRFAQ-BL-13`、`PRFAQ-BL-14`、`PRFAQ-BL-15` の一部を前進させた。完了扱いにはせず、残りは以下の条件で継続確認する。

| Priority | Backlog | 対象Gap | Blocked by | 成熟度への寄与 | 完了条件 |
| -------- | ------- | ------- | ---------- | -------------- | -------- |
| P1 | 顧客向け文言の棚卸しを主要画面全体へ広げる | UI copy gap | none | 内部語の混入を減らす | Home、管理策、承認、監査、PDF/API errorまで外向き/内向き境界が記録される |
| P1 | gapがある状態の次アクションを他の不足項目にも広げる | UX gap | none | 詰まったときの自走性が上がる | 残留リスク受容、マネジメントレビュー、フォローアップなど複数gapで関連画面ボタンが意図した画面へ遷移する |
| P2 | PDFの提出先向けデザインを改善する | UX gap | U-06 | 審査準備資料としての信頼感が上がる | 日本語フォント、改ページ、署名欄、見出しの見栄えが確認済みになる |

## Re-test Plan

- 対象Actor: ISMS推進責任者、内部監査担当、導入支援担当
- 対象Use Case: 審査準備状況確認、証跡出力、不足項目の修復導線
- 再テストするScenario: 初回登録準備と継続運用の審査準備パッケージ画面を開き、準備済み時はPDF/ZIP出力、不足あり時は関連画面遷移を確認する。2026-06-09時点で、初回登録準備の適用管理策判断版未発行gapから管理策画面へ移動する代表QA、継続運用の内部監査報告書未承認gapから監査報告書画面へ移動する代表QAはpass済み。
- 追加再テスト: 2026-06-10に `tests/e2e/initial-w02-soa-readiness.spec.ts` を再実行し、適用管理策判断の準備状況、管理策単位の判断保存、承認申請、却下後修正/再申請、判断版発行、差分表示、版レビュー承認までpassした。
- 追加再テスト: 2026-06-10に `tests/e2e/phase-selector.spec.ts` と `tests/e2e/home-phase-sync.spec.ts` を再実行し、初回登録準備/継続運用の選択、履歴、Home KPI/オンボーディング切替がpassした。
- 追加再テスト: 2026-06-10に `tests/e2e/initial-w02-submission-bundle.spec.ts` と `tests/e2e/surveillance-submission-bundle.spec.ts` をまとめて再実行し、初回登録準備/継続運用の審査準備パッケージ画面、PDF/ZIP成果物、manifest、gapから関連画面への導線がpassした。
- 合格条件: 顧客向け一次UI/PDF/ZIPに内部開発語が出ず、利用者が次に取る操作を1画面で判断できる
- 実行コマンド/確認方法: `npm run lint:messages`, `npm run typecheck`, `npx playwright test tests/e2e/initial-w02-submission-bundle.spec.ts --project=chromium --reporter=line`, `npx playwright test tests/e2e/surveillance-submission-bundle.spec.ts --project=chromium --reporter=line`

## Education & Training Addendum

### Summary

2026-06-09に、教育・訓練管理を `org_admin` / ISMS推進責任者の視点で確認した。画面とAPIは存在していたが、詳細画面が「計画内容と受講記録の表」中心で、組織管理者が教育証跡として足りるか、次に何を確認すべきかを判断しにくかった。代表修復として、教育計画詳細へ受講状況サマリー、次アクション、対象者カバレッジを追加し、ブラウザから教育サービスが直接DBリポジトリを呼ぶ境界エラーもAPI経由へ修正した。同日、初回登録準備/継続運用の審査準備パッケージへ `education_training_evidence` を追加し、教育計画数、受講記録数、合格済み記録数、教材数を審査準備パッケージの証跡候補として確認できるようにした。さらに実務検証seedへ、初回審査登録準備の全社員教育と、継続運用の年次セキュリティ教育を教材・計画・受講記録つきで追加し、テスターが教育データを一から登録せずにモデルケースを確認できる状態にした。教育詳細画面から教材を新規作成して計画へ紐づける代表導線も追加し、`qa:education` で確認済み。対象者カバレッジは、`target_audience` の全社員/部門/ロール相当の文字列から候補者を絞る軽量判定へ改善した。さらに管理者ホームへ教育・訓練フォローアップを追加し、期限超過、未完了記録、合格記録不足の教育計画をホームから発見して教育詳細へ進めることを `qa:education` で確認した。同日、教育詳細画面で対象ユーザーをチェックボックス選択して保存し、保存後の対象者数、記録済み、未記録が対象者カバレッジへ反映されることも確認した。同日、`user` / メンバーのホームへ `/api/education/my-training` を接続し、全社員または本人対象の教育計画が自分の教育として表示され、教育計画詳細へ進めることを `home-user-dashboard` QAで確認した。同日、メンバーが教育詳細で自分の受講状況を確認し、本人の受講完了を `/api/education/[id]/my-record` 経由で作成/更新できることも `home-user-dashboard` QAで確認した。2026-06-10に、対象者割当を全社員、ロール、部門、個別ユーザーの構造化指定へ拡張し、`role:user` の教育計画がメンバーのホームへ表示されることを代表QAで確認する方針へ更新した。同日、教材ライブラリの再利用、教材編集、教材削除を教育詳細から実行できるAPI/UIを追加し、年次教育や入社時教育で教材を作り直さず使い回せる方向へ進めた。さらに既存教材パネルを開く時点で教材ライブラリを再取得するようにし、別経路で追加された教材もその場で選べることを `qa:education` で確認した。同日、教育期限リマインダーAPIを代表QAへ追加し、期限前と期限超過の両方で対象者へのアプリ内通知、監査ログ、通知一覧表示、二重送信防止を `qa:education` で確認する対象にした。追加で、Homeの教育・訓練フォローアップから教育一覧を `followUp=needs_attention` で開き、要フォロー教育計画だけを一覧で確認できるようにした。また、Asia/Tokyoの日付境界で期限超過教育が期限前リマインダー扱いになる可能性を修正した。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面 |
| ----- | ----- | -------- | -------- | ---- | -------- |
| UC-EDU-01 | ISMS推進責任者 | 年次または初回登録準備の教育計画を作成する | 教育計画が保存され一覧に表示される | 対象者や教材は後続で詳細化 | `/education/new`, `/education` |
| UC-EDU-02 | ISMS推進責任者 | 教育計画の受講状況を確認し、未完了者を把握する | 合計、合格、要確認、修了率、次アクションが分かる | 受講記録が0件の場合は記録追加へ誘導 | `/education/[id]` |
| UC-EDU-03 | ISMS推進責任者 | 受講結果を教育証跡として残す | 受講者、日時、スコア、結果、フィードバックが保存される | 受講者が同一組織外の場合はAPIで拒否 | `/education/[id]`, `/api/education/[id]/records` |
| UC-EDU-04 | ISMS推進責任者 | 教育計画の対象者に対して記録漏れがないか確認する | 暫定対象者数、記録済み数、未記録数、未記録候補が分かる | 部門/ロール別の正式割当は後続で詳細化 | `/education/[id]` |
| UC-EDU-05 | ISMS推進責任者 | ホームで教育・訓練の要フォローを発見する | 期限超過、未完了記録、合格記録不足の計画数と対象計画が分かる | 実通知配信は後続で詳細化 | `/home`, `/api/education/follow-up` |
| UC-EDU-06 | ISMS推進責任者 | 教育計画の対象者を全社員、ロール、部門、個別ユーザーで割り当てる | 指定単位に応じて対象者カバレッジの母数が切り替わり、メンバーの対象教育判定にも反映される | 複数条件の組み合わせや除外条件は後続で詳細化 | `/education/[id]`, `/api/education/[id]`, `/api/education/my-training` |
| UC-EDU-07 | メンバー | 自分が対象の教育計画をホームで確認する | 全社員または本人対象の教育計画がホームの教育・研修に表示され、教育計画詳細へ進める | 詳細な理解度テストや設問回答は後続で詳細化 | `/home`, `/api/education/my-training` |
| UC-EDU-08 | メンバー | 自分が対象の教育を受講完了として記録する | 教育詳細で自分の受講状況が分かり、本人の受講記録だけを作成/更新できる | 管理者向けの任意ユーザー記録追加は表示しない | `/education/[id]`, `/api/education/[id]/my-record` |
| UC-EDU-09 | ISMS推進責任者 | 既存教材を再利用し、必要に応じて編集/削除する | 教材ライブラリから教育計画へ教材を追加でき、教材名/種類/URL/説明を更新し、不要教材を削除できる | 表示順変更や教材ライブラリ専用画面は後続で詳細化 | `/education/[id]`, `/api/education/materials`, `/api/education/[id]/materials` |
| UC-EDU-10 | メンバー | 教育期限が近い、または期限を過ぎたときに通知を受け取り教育詳細へ進む | 対象者に教育期限前/期限超過リマインダー通知が作成され、通知一覧から教育詳細へ移動できる | メール配信、エスカレーション、繰り返し再送は後続で詳細化 | `/api/education/reminders`, `/notifications`, `/education/[id]` |
| UC-EDU-11 | 導入支援担当 | テストや導入支援で特定の教育計画だけリマインダーを実行する | `organizationId` / `educationPlanId` で処理対象を絞り、意図した1計画だけ通知・監査ログを作れる | 全体一括実行の運用スケジュールは後続で詳細化 | `/api/education/reminders` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 教育一覧を開き、新規教育計画へ進む | ISMS推進責任者 | 改善済み | `common.search` / `common.updatedAt` の欠落で一覧がエラーを出す可能性があった | `tests/e2e/education.spec.ts`, `messages/ja.json`, `messages/en.json` | P1 |
| 新規教育計画を作成する | ISMS推進責任者 | 改善済み | クライアントからDB実装へ入る境界エラーをAPI経由へ修正 | `lib/services/education.ts`, `tests/e2e/education.spec.ts` | P1 |
| 教育詳細で受講状況を判断する | ISMS推進責任者 | 改善済み | 受講記録数、合格、要確認、修了率、次アクションが不足 | `app/[locale]/education/[id]/page.tsx`, `tests/e2e/education.spec.ts` | P1 |
| 教育詳細で対象者カバレッジを判断する | ISMS推進責任者 | 改善済み | 対象者と受講記録の照合がなく、記録漏れ候補が分からなかった | `app/[locale]/education/[id]/page.tsx`, `messages/ja.json`, `messages/en.json`, `tests/e2e/education.spec.ts` | P1 |
| 受講記録を追加し、教育証跡として確認する | ISMS推進責任者 | 改善済み | 受講記録作成時の監査ログにorganizationIdが不足していた | `lib/services/education.ts`, `tests/e2e/education.spec.ts` | P1 |
| 教育証跡を審査準備パッケージで確認する | ISMS推進責任者 / 内部監査担当 | 改善済み | 教育計画・受講記録が審査準備パッケージのready/gap判断に未接続だった | `app/api/examination/submission-bundle/route.ts`, `tests/e2e/initial-w02-submission-bundle.spec.ts`, `tests/e2e/surveillance-submission-bundle.spec.ts` | P1 |
| 実務検証seedから教育モデルケースを確認する | ISMS推進責任者 | 改善済み | テスターが教育計画、教材、受講記録を毎回手入力する必要があった | `scripts/seed-practical-verification.mjs`, `tests/e2e/education.spec.ts` | P1 |
| 教育詳細から教材を追加して計画へ紐づける | ISMS推進責任者 | 改善済み | 教材の作成・紐づけ導線が表示のみで、画面から追加できなかった | `app/[locale]/education/[id]/page.tsx`, `app/api/education/[id]/materials/route.ts`, `tests/e2e/education.spec.ts` | P1 |
| 既存教材を教育計画へ再利用し、教材を編集/削除する | ISMS推進責任者 | 改善済み | 年次教育で同じ教材を使い回す導線がなく、教材の修正や削除も画面からできなかった。既存教材パネルを開く時点でライブラリを再取得し、直前に追加された教材も選択できるようにした | `app/[locale]/education/[id]/page.tsx`, `app/api/education/materials/[materialId]/route.ts`, `app/api/education/[id]/materials/route.ts`, `tests/e2e/education.spec.ts`, `npm run qa:education -- --project=chromium --reporter=line` | P1 |
| 教育対象者カバレッジを対象者指定から絞る | ISMS推進責任者 | 改善済み | 対象者指定があっても常に組織内有効ユーザー全体を暫定対象にしていた | `app/[locale]/education/[id]/page.tsx`, `tests/e2e/education.spec.ts` | P1 |
| ホームで教育・訓練の要フォローに気づく | ISMS推進責任者 | 改善済み | 教育画面を開かないと期限超過や未完了記録に気づきにくかった | `app/[locale]/home/page.tsx`, `app/api/education/follow-up/route.ts`, `tests/e2e/education.spec.ts` | P1 |
| Homeから要フォロー教育だけの一覧へ進む | ISMS推進責任者 | 改善済み | Homeで要フォローに気づいても、教育一覧では全件表示になり対象を探し直す必要があった | `app/[locale]/home/page.tsx`, `app/[locale]/education/page.tsx`, `app/api/education/follow-up/route.ts`, `tests/e2e/education.spec.ts` | P1 |
| 教育対象者を全社員、ロール、部門、個別ユーザー単位で割り当てる | ISMS推進責任者 | 改善済み | 個別ユーザー選択はできたが、実務で使う全社員/部門/ロール指定が構造化されていなかった | `app/[locale]/education/[id]/page.tsx`, `app/api/education/my-training/route.ts`, `tests/e2e/home-user-dashboard.spec.ts` | P1 |
| メンバーが自分の対象教育をホームで確認する | メンバー | 改善済み | ユーザーダッシュボードの教育カードが静的サンプルで、実教育計画と未接続だった | `app/[locale]/home/page.tsx`, `app/api/education/my-training/route.ts`, `tests/e2e/home-user-dashboard.spec.ts` | P1 |
| メンバーが自分の教育を受講完了として記録する | メンバー | 改善済み | 教育詳細が管理者向けの受講記録表中心で、本人が自分の完了を記録できなかった | `app/[locale]/education/[id]/page.tsx`, `app/api/education/[id]/my-record/route.ts`, `tests/e2e/home-user-dashboard.spec.ts` | P1 |
| メンバーが教育期限前/期限超過リマインダーを通知一覧で確認する | メンバー | 改善済み | 教育計画の期限前/期限超過通知、監査ログ、二重送信防止が代表QAに未接続だった | `app/api/education/reminders/route.ts`, `tests/e2e/education.spec.ts` | P1 |
| 特定の教育計画だけリマインダーを実行する | 導入支援担当 | 改善済み | QAやテスト操作で全計画を処理すると、意図しないseed通知が作られる可能性があった | `app/api/education/reminders/route.ts`, `tests/e2e/education.spec.ts` | P1 |

### Remaining Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 教材の作成・教育計画への紐づけ導線が薄い | UX gap / Data flow gap | P1 | remediated_for_create_and_attach |
| 既存教材の再利用、編集、削除が未整理 | UX gap / Data flow gap | P1 | remediated_for_reuse_edit_delete |
| 教材の表示順変更、専用教材ライブラリ画面、添付ファイル実体管理は未整理 | UX gap / Data flow gap | P2 | backlog |
| 対象者をユーザー単位で画面選択し、カバレッジへ反映する導線が不足 | Use case gap / UX gap | P1 | remediated_for_user_selection |
| 部門、ロール、全社員単位の構造化割当と一括更新は未整理 | Data/model gap / UX gap | P1 | remediated_for_basic_structured_targets |
| 複数条件、除外条件、対象者プレビューの高度化は未整理 | Data/model gap / UX gap | P2 | backlog |
| ホームで未受講/期限超過の教育計画を発見する導線が不足 | UX gap / Notification gap | P1 | remediated_for_home_follow_up |
| Homeから教育一覧へ移動した後に要フォロー対象が全件一覧に埋もれる | UX gap | P1 | remediated_for_follow_up_list_filter |
| メンバーのホーム教育カードが実データと未接続 | Actor gap / UX gap | P1 | remediated_for_member_home |
| メンバー自身による受講完了登録が未接続 | Actor gap / Permission gap | P1 | remediated_for_self_completion |
| アプリ内の教育期限前/期限超過リマインドは教育計画と接続済み。対象テナント/教育計画を指定した限定実行も可能。メール、エスカレーション、再送ルールは未整理 | Notification gap | P1 | remediated_for_app_notification_reminder |
| 教育証跡が審査準備パッケージへ未接続 | Journey gap | P1 | remediated_for_submission_bundle_readiness |
| 内部監査員力量、専門教育、任命記録はCAP-13との接続が未整理 | Business decision needed / Use case gap | P2 | backlog |

### Re-test Plan

- 対象Actor: ISMS推進責任者
- 対象Use Case: 教育計画作成、対象ユーザー選択、教材追加、受講記録追加、受講状況サマリー確認、対象者カバレッジ確認、ホームでの要フォロー確認、メンバーの対象教育確認、教育期限リマインダー確認、審査準備パッケージでの教育証跡確認
- 再テストするScenario: 実務検証seedをresetし、組織管理者でログインして教育一覧、seed教育計画、詳細表示、対象者の全社員/ロール/部門/ユーザー指定、教材追加、既存教材再利用、教材編集、教材削除、対象者カバレッジ、受講記録、サマリー/次アクション、ホームの教育・訓練フォローアップを確認する。Homeの教育フォローアップCTAから `followUp=needs_attention` 付きの教育一覧へ進み、要フォロー対象だけが表示されることも確認する。さらにメンバーでログインし、自分が対象の教育計画がホームの教育・研修に表示されることを確認する。期限リマインダーAPIで対象テナント/教育計画を指定し、期限前/期限超過の対象者通知、監査ログ、通知一覧表示、二重送信防止を確認する。さらに初回登録準備/継続運用の審査準備パッケージで `education_training_evidence` がready/gap判断、CSV/PDF/UIに含まれることを確認する
- 合格条件: 教育計画の作成、対象ユーザー選択、教材追加、受講記録追加がブラウザから成功し、詳細画面で教育証跡の状態、教材、対象者カバレッジ、次アクションが判断できる。管理者ホームでは要フォロー教育計画が表示され、教育詳細へ遷移できる。メンバーホームでは自分が対象の教育計画が表示される。期限前/期限超過教育では対象者にアプリ内通知が届き、通知一覧から教育詳細へ進める。審査準備パッケージでは教育計画、受講記録、合格済み記録数、教材数が証跡として表示される
- 実行コマンド/確認方法: `npm run lint:messages`, `npm run typecheck`, `npm run qa:education -- --project=chromium --reporter=line`, `npx playwright test tests/e2e/home-user-dashboard.spec.ts --project=chromium --reporter=line`, `npm run qa:initial-w02-submission-bundle -- --project=chromium --reporter=line`, `npm run qa:surveillance-submission-bundle -- --project=chromium --reporter=line`

## Approver Home Addendum

### Summary

2026-06-09に、`approver` / 承認者のホーム画面を、承認待ち・通知・関連リスクへ進む入口として確認した。直近QAでは、ホーム活動フィードから承認者が通知を開き、関連リスク詳細へ遷移できることは確認できた。一方で、承認者ダッシュボードのメトリクス取得がブラウザから文書リポジトリを直接開こうとしていたため、`fs.existsSync is not a function` のclient/server境界エラーが出ていた。今回、承認者メトリクスを `/api/documents?action=approverMetrics` 経由へ変更し、ホーム活動フィードQAでAPI 200と画面遷移を確認した。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面 |
| ----- | ----- | -------- | -------- | ---- | -------- |
| UC-APPROVER-HOME-01 | 承認者 | ホームで自分の承認待ち状況を確認する | 承認待ち、期限注意、エスカレーション、履歴件数がブラウザエラーなく表示される | 承認対象が0件なら空状態として表示 | `/home` |
| UC-APPROVER-HOME-02 | 承認者 | ホームの通知または活動フィードから関連リスクへ移動する | 通知カードから対象リスク詳細へ遷移できる | リンク先が削除済みならエラー表示 | `/home`, `/risks/[id]` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 承認者でホームを開き、承認者メトリクスを取得する | 承認者 | 改善済み | `DocumentService.getApproverDashboardMetrics` がブラウザでDBリポジトリを開いていた | `lib/services/document.ts`, `app/api/documents/route.ts`, `/api/documents?action=approverMetrics` 200 | P1 |
| 承認者でホーム活動フィードから関連リスクへ進む | 承認者 | 改善済み | `mock:activities` が未定義で、QAが再利用できなかった | `scripts/mock-activities.mjs`, `scripts/qa-home-activity-feed.js`, `tests/e2e/home-activity-feed.spec.ts` | P1 |
| 承認者ホームで組織統計や監査権限の背景取得を見る | 承認者 | 改善済み | 承認者に不要な組織統計取得と監査権限問い合わせを抑制し、403ログを解消 | `app/[locale]/home/page.tsx`, `lib/hooks/useAuditAccess.ts`, `qa:home:activity` server log | P2 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 承認者メトリクス取得がclient/server境界を越えていた | Implementation gap | P1 | remediated |
| ホーム活動フィードQAのseedとsummary契約が壊れていた | Test gap | P1 | remediated_for_chromium |
| 承認者に不要な組織統計取得が403ログを出す | Permission gap / UX noise | P2 | remediated |
| 承認者に不要な監査権限チェックが403ログを出す | Permission gap / UX noise | P2 | remediated |

### Re-test Plan

- 対象Actor: 承認者
- 対象Use Case: ホームで承認状況を確認し、通知から関連リスクへ移動する
- 再テストするScenario: dev-loginで承認者に切り替え、ホーム活動フィードの通知カードからリスク詳細へ移動する
- 合格条件: `getApproverDashboardMetrics` のブラウザDB境界エラーが出ず、`/api/documents?action=approverMetrics` が200を返し、承認者に不要な組織統計/監査権限403ログが出ず、通知カードから関連リスク詳細へ遷移できる
- 実行コマンド/確認方法: `npm run typecheck`, `npm run lint:messages`, `npm run qa:home:activity -- --project=chromium`

## Auditor QA Addendum

### Summary

2026-06-10に、`auditor` / 内部監査担当の代表QAを再確認した。CLI監査導線では Dev Login 後のCookieを後続APIへ引き継いでいなかったため、監査期間APIだけ401になる問題があった。また、ページ巡回は一時的なtimeout/socket resetを二重記録して失敗扱いにしていた。代表修復として、CLI QAでDev Login cookieを保持し、監査ページ取得と全ページ巡回に1回リトライを追加した。さらに `qa:uc07-auditor` のPlaywright reporter指定を現行Playwrightに合わせ、監査ウォークスルー/期間フィルタQAをskipではなくChromiumで実行するようにした。

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 監査員が監査ダッシュボードを開き、次のアクションと進捗を確認する | 内部監査担当 | 改善済み | QA wrapperがPlaywrightをskipしており、実ブラウザで監査画面を確認できていなかった | `scripts/qa-uc07-auditor.js`, `tests/e2e/audit-walkthrough.spec.ts` | P1 |
| 監査員が監査期間で絞り込み、URLと期間バッジを確認する | 内部監査担当 | 改善済み | URLエンコード差分と短い待機時間で、実際には動いている期間フィルタQAが落ちることがあった | `tests/e2e/audit-progress.spec.ts` | P1 |
| CLI監査導線で監査期間APIを確認する | 内部監査担当 | 改善済み | Dev Login cookieを保持しておらず `/api/audit/periods` が401になっていた | `scripts/test-audit.js`, `npm run qa:audit-report` | P1 |
| 監査QAの共通ページ巡回を繰り返し実行する | 内部監査担当 / 導入支援担当 | 改善済み | 一時的なtimeout/socket resetでページ巡回が不安定に失敗していた | `scripts/test-all-pages.js`, `scripts/test-audit.js` | P2 |

### Re-test Plan

- 対象Actor: 内部監査担当
- 対象Use Case: 監査ダッシュボード確認、監査期間絞り込み、監査導線のヘルスチェック
- 再テストするScenario: `npm run qa:audit-report` でCLI監査導線、監査期間API、主要ページ巡回を確認し、`npx playwright test tests/e2e/audit-walkthrough.spec.ts tests/e2e/audit-progress.spec.ts --project=chromium --reporter=line,json --workers=1` で監査員ブラウザ導線を確認する
- 合格条件: 監査導線13/13、主要ページ42/42、監査ウォークスルーと期間フィルタのChromium代表QAがpassする

## Admin Home Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者と `system_operator` / 導入支援担当のHome管理者ダッシュボードを確認した。教育・訓練フォローアップは実データへ接続済みだった一方、管理者KPIの承認待ち、有効ユーザー、オープンリスク、期限超過タスクが固定サンプル値のままで、実務検証者が「今のテナントで何を見るべきか」を誤認する可能性があった。代表修復として、既存の組織統計からKPIを表示するようにし、フェーズ同期QAで管理者KPI表示を確認対象へ追加した。続けて、各KPIを該当一覧へのリンクにし、期限超過タスクは `/tasks?due=overdue` で未完了かつ期限超過のタスクに絞り込めるようにした。さらに「今日確認すること」を追加し、期限超過タスク、承認待ち、教育フォロー、オープンリスクを横断して確認できるようにした。同日、「週次・月次で回すこと」を追加し、レビュー待ちタスク、対応中リスク、実施中監査、予定中マネジメントレビューへ状態別の定期運用入口と件数表示を出した。マネジメントレビュー一覧にも `status` URLフィルタと状態別件数カードを追加し、Homeから予定中レビューを開いた後も、全体/予定/進行中/完了などの件数を見て絞り込み、全体へ戻れるようにした。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面 |
| ----- | ----- | -------- | -------- | ---- | -------- |
| UC-HOME-ADMIN-01 | ISMS推進責任者 | Homeで今日確認すべき組織状態を把握する | 承認待ち、有効ユーザー、オープンリスク、期限超過タスクが実データ由来で表示され、優先アクションから該当一覧へ進める | 詳細な優先度集計は後続で拡張 | `/home` |
| UC-HOME-ADMIN-03 | ISMS推進責任者 | Homeから週次/月次/年次の定期確認へ進む | レビュー待ちタスク、対応中リスク、実施中監査、予定中マネジメントレビューの件数と入口が同じHome上で分かる | 期限判定や担当者別の詳細優先度は後続 | `/home` |
| UC-HOME-ADMIN-02 | 導入支援担当 | 顧客テナントの詰まりをHomeで俯瞰する | 教育フォローアップと管理者KPIを同じ画面で確認できる | 顧客向け説明用の詳細レポートは後続 | `/home` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 管理者Homeで組織KPIを確認する | ISMS推進責任者 / 導入支援担当 | 改善済み | KPIが固定サンプル値で、実seed/実データとずれる可能性があった | `app/[locale]/home/page.tsx`, `tests/e2e/home-phase-sync.spec.ts` | P1 |
| 管理者HomeのKPIから該当一覧へ移動する | ISMS推進責任者 / 導入支援担当 | 改善済み | KPIを見ても次に開く画面が分かりにくかった。期限超過タスクの絞り込みも不足していた | `app/[locale]/home/page.tsx`, `app/[locale]/tasks/page.tsx`, `tests/e2e/home-phase-sync.spec.ts` | P1 |
| 管理者Homeで今日確認することを見る | ISMS推進責任者 / 導入支援担当 | 改善済み | 教育、承認、リスク、タスクが別々に存在し、優先確認順が分かりにくかった | `app/[locale]/home/page.tsx`, `tests/e2e/home-phase-sync.spec.ts` | P1 |
| 管理者Homeから定期運用へ進む | ISMS推進責任者 / 導入支援担当 | 改善済み | 今日の確認だけでは、週次/月次/年次で回す業務への入口が見えにくかった。代表状態としてレビュー待ちタスク、対応中リスク、実施中監査、予定中マネジメントレビューへ絞って遷移し、予定中レビュー件数も表示するようにした。レビュー一覧でも状態別件数を見て絞り込める | `app/[locale]/home/page.tsx`, `app/[locale]/management-reviews/page.tsx`, `tests/e2e/home-phase-sync.spec.ts`, `tests/e2e/management-reviews.spec.ts` | P1 |
| 実務検証seedの2社をヘッダーから切り替えてHomeを確認する | 導入支援担当 | 改善済み | Dev Loginをやり直さないと、初回登録準備モデルと継続運用モデルを見比べにくかった | `components/layout/DashboardLayout.tsx`, `app/api/auth/organization/route.ts`, `tests/e2e/system-operator-tenant-switch.spec.ts` | P1 |

### Remaining Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 管理者KPIが固定サンプル値だった | UX gap / Data flow gap | P1 | remediated_for_home_admin_kpi |
| KPIカードから該当一覧へ直接絞り込む導線が弱い | UX gap | P1 | remediated_for_representative_kpi_links |
| 今日確認することとして、教育、承認、リスク、タスクを横断表示する導線が不足 | Use case gap / UX gap | P1 | remediated_for_daily_priority_actions |
| 今週/月次の優先事項、内部監査、マネジメントレビューまで含む運用ビューが不足 | Use case gap / UX gap | P1 | remediated_for_representative_cadence_links |
| 導入支援担当が複数モデルテナントをアプリ内で切り替える導線が不足 | UX gap / Seed usability gap | P1 | remediated_for_system_operator_tenant_switch |
| 定期運用カードは状態別代表リンクへ改善済みだが、期限判定や担当者別の詳細優先度は未整理 | Use case gap / Data flow gap | P1 | backlog |
| マネジメントレビュー一覧が状態別に開けず、Homeから年次レビュー準備へ入っても全件一覧になっていた | UX gap | P1 | remediated_for_status_filter |

### Re-test Plan

- 対象Actor: ISMS推進責任者、導入支援担当
- 対象Use Case: Homeで組織状態と当日の確認事項を把握する
- 再テストするScenario: system_operatorまたはorg_adminでログインし、Home管理者ダッシュボードの承認待ち、有効ユーザー、オープンリスク、期限超過タスク、教育フォローアップ、今日確認すること、週次・月次で回すことが表示されることを確認する。各KPIから該当一覧へ進み、期限超過タスクは `due=overdue` の絞り込みが表示されることを確認する。定期運用カードからレビュー待ちタスク、対応中リスク、実施中監査、予定中マネジメントレビューへ進めることを確認する。さらに実務検証seedの共有 system_operator では、ヘッダーの「確認中のテナント」から初回登録準備モデルと継続運用モデルを切り替え、Homeがフェーズに応じて更新されることを確認する
- 合格条件: 管理者KPIが固定サンプルではなく実データ由来の数値として表示され、教育フォローアップと今日確認することで当日の確認対象を把握できる。さらに週次/月次/年次の定期確認先がHome上で分かり、次に見るべき一覧へ迷わず移動できる
- 実行コマンド/確認方法: `npm run lint:messages`, `npm run typecheck`, `npx playwright test tests/e2e/home-phase-sync.spec.ts tests/e2e/system-operator-tenant-switch.spec.ts --project=chromium --reporter=line`

## Risk Matrix Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者の視点でリスクアセスメント一覧のリスクマトリックスを確認した。セル内の大きな数字は影響度と発生可能性を掛けたリスクスコアで、括弧内の数字はその条件に該当する登録済みリスク件数である。ただし、0件セルがクリック不可になっていたため、利用者には「未実装」「壊れている」「なぜ押せないのか分からない」と見える可能性があった。代表修復として、0件セルもクリック可能にし、URL条件、選択状態、0件バナー、空の一覧結果として確認できるようにした。さらに、マトリクスで絞り込んだ状態のExcel/PDFエクスポートにも同じ条件を引き継ぎ、画面で見たリスク分布と持ち出す資料がずれないようにした。同日、ヘルプを開かなくても数字の意味が分かるよう、マトリクス見出し直下へ「上段はリスクスコア、括弧内は該当リスク件数」であることを短く表示した。追加で、検索・ステータス・カテゴリ・部門・期間フィルタを使った後の一覧母集団に合わせてマトリクス件数を再計算するようにし、「分析中だけを見ているのに全体分布が残る」ような判断ずれを避けられるようにした。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面 |
| ----- | ----- | -------- | -------- | ---- | -------- |
| UC-RISK-MATRIX-01 | ISMS推進責任者 | リスク分布から該当リスクを絞り込む | 件数あり/なしに関わらずセルを条件として選べ、該当一覧または0件結果を確認できる | スコア基準や色分けの見直しは後続判断 | `/risks` |
| UC-RISK-MATRIX-02 | ISMS推進責任者 | 絞り込んだリスク一覧を資料として出力する | マトリクス条件がExcel/PDFエクスポートにも引き継がれる | 出力デザインや提出向け体裁は後続 | `/risks`, `/api/risks/export` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| リスクマトリックスのセルをクリックして分布を確認する | ISMS推進責任者 | 改善済み | 0件セルがdisabledで、禁止カーソルにより未実装に見える可能性があった | `app/[locale]/risks/page.tsx`, `tests/e2e/risks-matrix.spec.ts` | P1 |
| リスクマトリックスの数字の意味を理解する | ISMS推進責任者 | 改善済み | 数字がリスクスコアなのか件数なのか、ヘルプを開かないと分かりにくかった | `app/[locale]/risks/page.tsx`, `messages/ja.json`, `tests/e2e/risks-matrix.spec.ts` | P1 |
| ステータス等で絞ったリスク群の分布を確認する | ISMS推進責任者 | 改善済み | 一覧フィルタ後もマトリクスが全体件数のままだと、現在見ている母集団の分布と誤解する可能性があった | `app/[locale]/risks/page.tsx`, `tests/e2e/risks-matrix.spec.ts` | P1 |
| マトリクスで絞り込んだリスク一覧を出力する | ISMS推進責任者 | 改善済み | 画面の絞り込み条件とExcel/PDF出力条件がずれる可能性があった | `app/[locale]/risks/page.tsx`, `app/api/risks/export/route.ts`, `lib/utils/exporters/riskPdf.ts`, `tests/e2e/risks-matrix.spec.ts` | P1 |

### Re-test Plan

- 対象Actor: ISMS推進責任者
- 対象Use Case: リスクマトリックスから該当リスクを絞り込む
- 再テストするScenario: org_adminで `/ja/risks` を開き、件数ありセルと0件セルをクリックする。URLに `matrixImpact` / `matrixLikelihood` が入り、選択状態と絞り込みバナーが表示され、0件セルでは0件結果として確認できることを確認する。さらに検索・ステータス等の一覧フィルタ後にマトリクス件数が同じ母集団で再計算されること、絞り込み後にExcelエクスポートを実行し、エクスポートAPIにも同じマトリクス条件が渡ることを確認する
- 合格条件: マトリクスのセルが「押せる条件」として一貫し、0件セルでも利用者が該当リスクなしを確認できる。画面で見ているマトリクス条件が、持ち出し資料の条件にも引き継がれる
- 実行コマンド/確認方法: `npm run lint:messages`, `npm run typecheck`, `npx playwright test tests/e2e/risks-matrix.spec.ts --project=chromium --reporter=line`

## Audit Preparation Package Gap Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者と `system_operator` / 導入支援担当の視点で、審査準備パッケージの不足表示を確認した。既に「最初に直すべき不足」から関連画面へ進む導線はあったが、各不足カードは不足文言だけで、実務検証者が「なぜ不足なのか」「次に何をするのか」「どの画面で直すのか」を項目ごとに判断しにくかった。代表修復として、審査準備パッケージAPIの各gapへ不足理由、次アクション、関連画面routeを追加し、画面の各不足カード、manifest JSON、items/gaps CSV、PDFのGap reviewへ同じ情報を出すようにした。初回登録準備では適用管理策判断版未発行、継続運用では内部監査報告書未承認を代表gapとして確認した。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面 |
| ----- | ----- | -------- | -------- | ---- | -------- |
| UC-BUNDLE-GAP-01 | ISMS推進責任者 | 審査準備パッケージの不足から次に直す画面へ進む | 不足理由、次アクション、関連画面が項目ごとに分かり、クリックで該当画面へ移動できる | PDF/CSVではリンクではなくrouteとして確認する | `/examination/submission-bundle` |
| UC-BUNDLE-GAP-02 | 導入支援担当 | 顧客テナントの不足を資料として説明する | manifest/CSV/PDFにも不足理由と次アクションが含まれ、画面外でも説明できる | 提出先向けPDFデザインは後続 | `/api/examination/submission-bundle` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 初回登録準備の審査準備パッケージで適用管理策判断版gapを見る | ISMS推進責任者 / 導入支援担当 | 改善済み | 不足文言だけでは次に何をすべきか分かりにくかった | `app/[locale]/examination/submission-bundle/page.tsx`, `app/api/examination/submission-bundle/route.ts`, `tests/e2e/initial-w02-submission-bundle.spec.ts` | P1 |
| 継続運用の審査準備パッケージで監査報告書gapを見る | ISMS推進責任者 / 導入支援担当 | 改善済み | 承認前/未作成などのgapを業務画面へつなぐ情報が不足していた | `app/[locale]/examination/submission-bundle/page.tsx`, `app/api/examination/submission-bundle/route.ts`, `tests/e2e/surveillance-submission-bundle.spec.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 審査準備パッケージgapが不足文言だけで、項目ごとの次アクションと関連画面が弱い | UX gap / Data contract gap | P1 | remediated_for_gap_actions |
| manifest/CSV/PDFに不足後のアクション情報がなく、画面外で説明しにくい | Export gap / Docs gap | P1 | remediated_for_manifest_csv_pdf_gap_actions |

### Re-test Plan

- 対象Actor: ISMS推進責任者、導入支援担当
- 対象Use Case: 審査準備パッケージの不足を確認し、次に直す画面へ進む
- 再テストするScenario: 初回登録準備で適用管理策判断版の未発行gap、継続運用で監査報告書未承認gapを表示し、各不足カードに不足理由、次アクション、関連画面が表示されること、代表CTAから関連画面へ移動できることを確認する。ZIP/PDF/APIにも同じgap action情報が含まれることを確認する
- 合格条件: 利用者が不足一覧を見た時に、次にどの画面で何を直せばよいか判断できる
- 実行コマンド/確認方法: `npm run lint:messages`, `npm run typecheck`, `npx playwright test tests/e2e/initial-w02-submission-bundle.spec.ts --project=chromium --reporter=line --workers=1`, `npx playwright test tests/e2e/surveillance-submission-bundle.spec.ts --project=chromium --reporter=line --workers=1`

## Task Export Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者の視点でタスク一覧の持ち出し導線を確認した。ユーザーマニュアルや過去の進捗では「タスクCSVエクスポート可能」と整理されていたが、`/api/tasks/export` はテンプレート以外が501を返す状態で、画面外の証跡化や契約終了時のデータ持ち出し検証に使いにくかった。代表修復として、認証済みユーザーの所属組織に限定してタスク実データをCSV出力できるようにし、ステータス、優先度、担当者、カテゴリ、部門、検索、期限超過フィルタを反映できるようにした。さらにタスク一覧画面の「タスクをCSVで出力」ボタンを同APIへ接続し、画面で見ているフィルタ条件と持ち出しCSVがずれないようにした。これにより、初回登録準備と継続運用のタスク進捗を、画面だけでなくCSVとして確認・共有できる。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面/API |
| ----- | ----- | -------- | -------- | ---- | ------------ |
| UC-TASK-EXPORT-01 | ISMS推進責任者 | タスク一覧をCSVで持ち出して進捗確認する | 認証済みユーザーの所属組織タスクだけがCSV出力される | Excel体裁や契約終了時の一括エクスポート設計は後続 | `/api/tasks/export` |
| UC-TASK-EXPORT-02 | 導入支援担当 | フィルタ済みタスクを顧客説明用に確認する | status/search/dueなどの条件がCSVに反映される | Excel体裁や一括エクスポートの対象範囲は後続 | `/tasks`, `/api/tasks/export` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| タスク実データをCSVで取得する | ISMS推進責任者 | 改善済み | APIがテンプレート以外501で、画面外の確認資料として使えなかった | `app/api/tasks/export/route.ts`, `lib/utils/exporters/taskExport.ts`, `tests/unit/task-export.test.ts` | P1 |
| タスク一覧画面からフィルタ済みCSVを出力する | ISMS推進責任者 / 導入支援担当 | 改善済み | 画面ボタンがクライアント内生成で、API出力や契約終了時ポータビリティ検証と分かれていた | `app/[locale]/tasks/page.tsx`, `tests/e2e/tasks.spec.ts` | P1 |
| 完了条件や説明文をCSVで確認する | ISMS推進責任者 | 改善済み | タスクの完了条件相当の情報を再利用可能な形で組み立てる共通処理が弱かった | `lib/utils/exporters/taskExport.ts`, `tests/unit/task-export.test.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| `/api/tasks/export` が実データを返さず、タスクの証跡持ち出しに使えない | Export gap / Use case gap | P1 | remediated_for_task_csv_api |
| タスクCSVの列組み立てが画面内ロジックに閉じ、APIとテストで再利用しにくい | Data contract gap / Test gap | P1 | remediated_for_task_csv_helper |
| 画面上のCSVダウンロードがAPI出力と分かれ、フィルタ条件の一致を検証しにくい | UX gap / Implementation gap | P1 | remediated_for_task_csv_ui |

### Re-test Plan

- 対象Actor: ISMS推進責任者、導入支援担当
- 対象Use Case: タスク一覧をCSVで持ち出して進捗確認する
- 再テストするScenario: org_adminでDev Loginし、`/api/tasks/export?status=todo` を取得する。HTTP 200、`Content-Type: text/csv; charset=utf-8`、`Content-Disposition: attachment; filename="tasks-export.csv"`、CSVヘッダー `id,title,status,priority,assignee,owner,completion_criteria,due_date` が返ることを確認する。さらに `/ja/tasks?status=todo&q=教育` の画面ボタンからCSVを出力し、APIへ `organizationId`、`status=todo`、`search=教育` が渡ることを確認する
- 合格条件: 認証済みユーザーの所属組織内タスクをCSVで取得でき、検索・状態・期限超過などの代表フィルタが画面とAPI出力で一致する
- 実行コマンド/確認方法: `npm run typecheck`, `npm run lint:messages`, `npm run test:unit:build`, `npm run test:unit:alias`, `node --test dist-tests/tests/unit/task-export.test.js`, `npx playwright test tests/e2e/tasks.spec.ts --grep 'CSVエクスポート' --project=chromium --reporter=line --workers=1`, Dev Login後の `curl /api/tasks/export?status=todo`

## Information Asset CSV Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者の視点で、情報資産台帳のCSVエクスポート/インポート往復を確認した。初回登録準備では情報資産の登録がリスクアセスメントの前提になり、継続運用でも台帳更新を外部表計算で確認・補正したい場面がある。既に画面とAPIは存在していたが、実務検証で繰り返し使えるQA入口と証跡保存が弱かった。代表修復として `npm run qa:assets:csv` を追加し、情報資産CSVをエクスポート、descriptionを変更、upsertインポート、再エクスポートで反映確認、元のdescriptionへ復元するround-tripを実行できるようにした。対象組織に資産がない場合はQA用資産を作成して検証を継続し、結果を `test-results/assets-csv-roundtrip-*.json` に保存する。追加で、インポート履歴が参照する資産を削除できない外部キー制約の詰まりを修正し、資産削除時はインポート履歴の `asset_id` を解除して履歴を残しつつ資産を削除できるようにした。これにより、QA用資産も検証後に後始末できる。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面/API |
| ----- | ----- | -------- | -------- | ---- | ------------ |
| UC-ASSET-CSV-01 | ISMS推進責任者 | 情報資産台帳をCSVで持ち出して確認する | CSVに資産名、分類、重要度、状態、責任者メール、場所、説明が出力される | Excel専用体裁や一括契約終了エクスポートは後続 | `/settings/assets`, `/api/information-assets/export` |
| UC-ASSET-CSV-02 | ISMS推進責任者 | CSVで補正した情報資産を再取り込みする | upsertインポート後、再エクスポートで変更が反映される | 大量データ移行やdry-run/rollback設計は後続 | `/settings/assets`, `/api/information-assets/import` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 情報資産CSVをエクスポートし、編集後に再インポートする | ISMS推進責任者 | 改善済み | 画面/APIはあったが、往復確認を繰り返し実行するQA入口と証跡保存が弱かった | `scripts/qa-assets-import.js`, `package.json`, `test-results/assets-csv-roundtrip-20260610T055946.json` | P1 |
| 情報資産が0件の環境でもCSV往復QAを続ける | 導入支援担当 | 改善済み | 空データだとround-tripがskipになり、実務検証の証跡にならなかった | `scripts/qa-assets-import.js` | P1 |
| インポート履歴がある情報資産を削除する | ISMS推進責任者 | 改善済み | インポート履歴行の外部キー参照により、QA用資産や不要資産の削除が500になる場合があった | `lib/db/repositories/sqlite/InformationAssetRepository.ts`, `lib/db/drizzle/schema/risks.ts`, `drizzle/`, `test-results/assets-csv-roundtrip-20260610T055946.json` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 情報資産CSV import/exportの代表QA入口がなく、未確認状態が残りやすい | Test gap / Export gap | P1 | remediated_for_assets_csv_roundtrip |
| 情報資産0件環境でQAがskipし、検証証跡が弱くなる | Seed gap / Test gap | P1 | remediated_for_temporary_asset_setup |
| インポートジョブ行が資産を参照するため、QAで作成した資産の物理削除は外部キー制約に当たる場合がある | Data lifecycle gap | P1 | remediated_for_import_row_asset_reference_cleanup |

### Re-test Plan

- 対象Actor: ISMS推進責任者、導入支援担当
- 対象Use Case: 情報資産台帳をCSVで持ち出し、補正して再取り込みする
- 再テストするScenario: `npm run qa:assets:csv` を実行し、Dev Login、プロフィール取得、情報資産CSVエクスポート、description変更、upsertインポート、再エクスポート反映確認、description復元、QA用資産の削除まで通ることを確認する
- 合格条件: `status: passed` の `test-results/assets-csv-roundtrip-*.json` が保存され、`importErrorCount` が0である。資産0件環境ではQA用資産が作成され、検証後に削除される
- 実行コマンド/確認方法: ローカルサーバー起動後に `npm run qa:assets:csv`

## Education Export Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者の視点で教育・訓練管理のCSVエクスポートを確認した。教育計画の一覧、受講状況サマリー、Homeの要フォロー導線、期限リマインダーは存在していたが、CSVエクスポートは全計画の基本情報だけを返し、画面で見ているステータス、検索語、要フォロー条件や、受講記録数・合格数・未完了/不合格件数を引き継げなかった。代表修復として、`/api/education/export` に `status`、`search`、`followUp=needs_attention` を反映し、CSVに受講記録数、合格数、要フォロー件数、修了率、期限超過、要フォロー状態を追加した。教育一覧画面のエクスポートボタンも同じ条件を引き継ぐようにした。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面/API |
| ----- | ----- | -------- | -------- | ---- | ------------ |
| UC-EDU-EXPORT-01 | ISMS推進責任者 | 教育・訓練の受講証跡をCSVで持ち出す | 画面の検索/状態/要フォロー条件と、受講記録サマリーがCSVに含まれる | 個人別詳細レポートや提出先向けPDFは後続 | `/education`, `/api/education/export` |
| UC-EDU-EXPORT-02 | 導入支援担当 | 要フォロー教育だけを顧客説明用に確認する | 期限超過または未完了/不合格がある教育計画だけをCSV化できる | 一括エクスポートZIPへの統合は後続 | `/education?followUp=needs_attention` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 教育計画CSVに画面フィルタを引き継ぐ | ISMS推進責任者 | 改善済み | CSVが全件出力になり、画面で見ている要フォロー対象とずれる可能性があった | `app/[locale]/education/page.tsx`, `app/api/education/export/route.ts`, `tests/e2e/education.spec.ts` | P1 |
| 教育計画CSVに受講サマリーを含める | ISMS推進責任者 / 導入支援担当 | 改善済み | 計画基本情報だけでは教育証跡として完了状況を判断しにくかった | `app/api/education/export/route.ts`, `tests/e2e/education.spec.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| 教育CSVがステータス/検索/要フォロー条件を反映せず、画面と持ち出しデータがずれる | Export gap / UX gap | P1 | remediated_for_education_filtered_csv |
| 教育CSVに受講記録数、合格数、要フォロー状態がなく、教育証跡として弱い | Export gap / Evidence gap | P1 | remediated_for_education_training_summary_csv |

### Re-test Plan

- 対象Actor: ISMS推進責任者、導入支援担当
- 対象Use Case: 教育・訓練の受講証跡をCSVで持ち出す
- 再テストするScenario: org_adminでDev Loginし、要フォローの教育計画と対象外の教育計画を用意する。`/api/education/export?status=in_progress&search=...&followUp=needs_attention` を取得し、対象教育だけが含まれ、受講記録数、合格数、要フォロー状態がCSVに入ることを確認する。さらに `/ja/education?status=in_progress&search=...&followUp=needs_attention` のエクスポートボタンから同じ条件が引き継がれることを確認する
- 合格条件: 画面上で見ている教育計画とCSVの対象が一致し、教育証跡として完了/未完了の概要を読める
- 実行コマンド/確認方法: `npx playwright test tests/e2e/education.spec.ts --grep '教育計画CSVエクスポート' --project=chromium --reporter=line --workers=1`

## Backup Export Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者の視点で、組織バックアップZIPの対象範囲を確認した。契約終了時や実務検証後の持ち出しを考えると、文書、リスク、タスクだけでなく、初回登録準備と継続運用の基礎になる情報資産台帳、教育・訓練証跡、内部監査、是正、マネジメントレビューの証跡も同じバックアップに含めたい。一方で `/api/export/backup` は documents / risks / tasks の3CSVだけを含む状態だった。代表修復として、`information_assets.csv`、`education_plans.csv`、`education_records.csv`、`audit_plans.csv`、`audit_reports.csv`、`nonconformities.csv`、`corrective_actions.csv`、`follow_up_records.csv`、`management_reviews.csv`、`management_review_actions.csv` をZIPへ追加し、さらに `document_versions.csv`、`document_approvals.csv`、`task_attachments.csv`、`audit_evidence.csv` で文書版、文書承認、タスク添付、監査証跡ファイルのメタデータも見返せるようにした。取得できるストレージ実体は `files/` 配下へ同梱し、同梱結果や未取得理由は `backup_files_manifest.csv` に残す。ZIP直下の `README.md` に、まず見るべき `metadata.json`、`backup_files_manifest.csv`、`files/` の読み方を入れた。`metadata.json` のcountsにも件数を含めた。追加で、バックアップ取得は `org_admin` / `system_operator` に限定し、一般メンバーが同一組織IDで取得しようとした場合は403になることを確認した。

### Use Cases

| UC ID | Actor | Use Case | 成功条件 | 例外 | 対象画面/API |
| ----- | ----- | -------- | -------- | ---- | ------------ |
| UC-BACKUP-EXPORT-01 | ISMS推進責任者 | 組織の主要業務データをZIPで持ち出す | 文書、文書版、文書承認、リスク、タスク、タスク添付、情報資産、教育計画、受講記録、監査、監査証跡、是正、マネジメントレビューがCSV/ファイルとして含まれる | 契約終了時の正式な対象範囲、保持/削除手順、復元方式は後続判断 | `/api/export/backup` |
| UC-BACKUP-EXPORT-02 | 導入支援担当 | 実務検証用テナントの状態を後で見返せる形で保存する | metadataに各CSV件数が入り、バックアップ範囲を確認できる | 復元インポートや完全なZIP再投入は別機能 | `/settings/organization`, `/settings/subscription` |

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| 組織バックアップZIPを取得する | ISMS推進責任者 | 改善済み | 情報資産と教育証跡が含まれず、ISMS運用データの持ち出し範囲として弱かった | `app/api/export/backup/route.ts`, `tests/e2e/backup-export.spec.ts` | P1 |
| 継続運用の監査・是正・レビュー証跡をバックアップで見返す | ISMS推進責任者 / 導入支援担当 | 改善済み | 内部監査、是正、フォローアップ、マネジメントレビューがZIPに含まれず、1年運用の証跡持ち出しとして弱かった | `app/api/export/backup/route.ts`, `tests/e2e/backup-export.spec.ts` | P1 |
| 文書版・承認・添付・監査証跡ファイルの存在をバックアップで見返す | ISMS推進責任者 / 導入支援担当 | 改善済み | ファイル実体は別管理で、バックアップZIPから関連メタデータや取れる実体を確認できなかった | `app/api/export/backup/route.ts`, `tests/e2e/backup-export.spec.ts` | P1 |
| 契約管理画面から解約・契約終了向けバックアップを取得する | ISMS推進責任者 | 改善済み | サブスクリプション画面の説明が旧範囲のままで、ブラウザ側DB呼び出しにより画面表示が落ちる場合があった | `app/[locale]/settings/subscription/page.tsx`, `app/api/stripe/usage/route.ts`, `components/settings/subscription/DataExportSection.tsx`, `tests/e2e/backup-export.spec.ts` | P1 |
| 一般メンバーが組織バックアップZIPを取得しようとする | メンバー | 改善済み | 同一組織ユーザーであれば持ち出し可能に見え、データポータビリティと権限境界が混ざっていた | `app/api/export/backup/route.ts`, `tests/e2e/backup-export.spec.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| バックアップZIPがdocuments/risks/tasksに限定され、情報資産と教育証跡をまとめて持ち出せない | Export gap / Data portability gap | P1 | remediated_for_assets_and_education_backup |
| 継続運用の監査・是正・マネジメントレビュー証跡が一括バックアップに含まれていない | Export gap / Evidence gap | P1 | remediated_for_surveillance_evidence_backup |
| 文書版、文書承認、タスク添付、監査証跡ファイルのメタデータと取得可能なファイル実体が一括バックアップに含まれていない | Export gap / Evidence gap | P1 | remediated_for_file_manifest_and_body_backup |
| metadataに追加CSVの件数がなく、バックアップ範囲を確認しづらい | Export gap / Evidence gap | P1 | remediated_for_backup_metadata_counts |
| 一般メンバーでも同一組織バックアップを取得できる権限境界になっていた | Permission gap / Data portability gap | P1 | remediated_for_backup_admin_only |

### Re-test Plan

- 対象Actor: ISMS推進責任者、導入支援担当
- 対象Use Case: 組織の主要業務データをZIPで持ち出す
- 再テストするScenario: org_adminでDev Loginし、組織設定画面とサブスクリプション画面の両方からバックアップZIPを取得する。API直取得では、ZIP本文に `README.md`、`documents.csv`、`document_versions.csv`、`document_approvals.csv`、`risks.csv`、`tasks.csv`、`task_attachments.csv`、`information_assets.csv`、`education_plans.csv`、`education_records.csv`、`audit_plans.csv`、`audit_reports.csv`、`audit_evidence.csv`、`nonconformities.csv`、`corrective_actions.csv`、`follow_up_records.csv`、`management_reviews.csv`、`management_review_actions.csv`、`backup_files_manifest.csv`、`metadata.json` が含まれ、metadataに追加CSVとファイル同梱件数のcountsが含まれることを確認する。テスト用タスク添付ファイルは `files/task_attachment/...` 配下に本文つきで同梱されることを確認する。続けてuserロールで同じAPIを呼び、403になることを確認する
- 合格条件: 初回登録準備/継続運用の代表データを、画面外で確認できるバックアップZIPとして取得できる
- 実行コマンド/確認方法: `npx playwright test tests/e2e/backup-export.spec.ts --project=chromium --reporter=line --workers=1`

## Org Admin Home Navigation Addendum

### Summary

2026-06-10に、`org_admin` / ISMS推進責任者の視点で、Homeから管理・契約・文書整備へ進めるかを確認した。HomeのKPIや管理者カードは実データへ接続され始めているが、組織管理者にとっては、メンバー管理、契約/バックアップ、基準文書整備へ迷わず入れることが実務検証の前提になる。代表修復として `tests/e2e/home-org-admin-dashboard.spec.ts` を追加し、Homeのクイックリンクから `/settings/users`、`/settings/subscription`、`/documents` へ遷移し、各画面の固有見出しが表示されることを確認した。

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| Homeからメンバーとロール管理へ進む | ISMS推進責任者 | 改善済み | リンク設定は存在したが、実画面へ到達できるかのロール別回帰テストがなかった | `tests/e2e/home-org-admin-dashboard.spec.ts` | P1 |
| Homeからサブスクリプション管理へ進む | ISMS推進責任者 | 改善済み | 契約/バックアップ導線がHomeから実画面へつながるか未固定だった | `tests/e2e/home-org-admin-dashboard.spec.ts` | P1 |
| Homeから基準文書の整備へ進む | ISMS推進責任者 | 改善済み | 初回登録準備の文書整備入口がHomeから実画面へつながるか未固定だった | `tests/e2e/home-org-admin-dashboard.spec.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| org_admin Homeのクイックリンクが、実際の管理・契約・文書画面へ到達できるかを保証するE2Eがなかった | Test gap / UX navigation gap | P1 | remediated_for_org_admin_home_navigation |

### Re-test Plan

- 対象Actor: ISMS推進責任者
- 対象Use Case: Homeから管理・契約・文書整備の主要業務へ入る
- 再テストするScenario: org_adminでDev Loginし、Homeの `メンバーとロール管理`、`サブスクリプション管理`、`基準文書の整備` を順にクリックし、それぞれユーザー管理、サブスクリプション管理、文書管理の画面見出しが表示されることを確認する
- 合格条件: 組織管理者がHomeを起点に、初回登録準備と継続運用の管理系入口へ迷わず遷移できる
- 実行コマンド/確認方法: `npx playwright test tests/e2e/home-org-admin-dashboard.spec.ts --project=chromium --reporter=line --workers=1`

## Member Home Training Navigation Addendum

### Summary

2026-06-10に、`user` / メンバーの視点で、Homeから自分の教育・訓練へ進めるかを確認した。メンバーHomeには担当タスク、参照文書、教育、改善タスクの専用カードがあるが、上部のクイックリンクはタスクと文書に偏っていた。ISMSの継続運用では、メンバー本人が対象教育を見つけて受講完了を記録できることが日常利用の重要な入口になる。代表修復として、メンバーのクイックリンクに `教育・訓練を受講` を追加し、さらに `今日やること` セクションで未完了教育、担当タスク、必読文書を並べ、既存の `home-user-dashboard` E2Eで教育一覧への遷移、対象教育詳細、本人の受講完了記録まで確認した。

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| Homeから教育・訓練一覧へ進む | メンバー | 改善済み | 専用カードには教育入口があったが、上部クイックリンクには教育入口がなく、日常行動として見つけにくかった | `lib/home/roleHomeConfig.ts`, `tests/e2e/home-user-dashboard.spec.ts` | P1 |
| Homeで今日やることを確認する | メンバー | 改善済み | タスク、文書、教育のカードはあるが、日常の優先アクションとして一段上にまとまっていなかった | `app/[locale]/home/page.tsx`, `tests/e2e/home-user-dashboard.spec.ts` | P1 |
| 対象教育を開いて本人の受講完了を記録する | メンバー | 既存確認を強化 | 教育計画の対象者に入った後、自分の受講状況から完了記録まで通ることをHome起点で確認する必要があった | `tests/e2e/home-user-dashboard.spec.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| メンバーHomeのクイックリンクに教育・訓練入口がなく、ISMS日常教育の入口として弱い | UX navigation gap / Role gap | P1 | remediated_for_member_training_quicklink |
| メンバーHomeでタスク、文書、教育の優先順がまとまらず、日常の最初の一手が読み取りにくい | UX navigation gap / Use case gap | P1 | remediated_for_member_today_priority_actions |

### Re-test Plan

- 対象Actor: メンバー
- 対象Use Case: Homeから対象教育を見つけ、受講完了を記録する
- 再テストするScenario: org_adminでメンバー向け教育計画を作成し、対象ロールをメンバーに設定する。userでHomeへログインし、クイックリンク `教育・訓練を受講` から教育一覧へ進めること、`今日やること` に教育、担当タスク、必読文書が並ぶこと、Homeの教育カードから対象教育詳細へ進み、本人の受講完了を記録できることを確認する
- 合格条件: メンバーがHomeを起点に、自分のタスク、必要文書、教育・訓練へ迷わず進め、教育完了の証跡を残せる
- 実行コマンド/確認方法: `npx playwright test tests/e2e/home-user-dashboard.spec.ts --project=chromium --reporter=line --workers=1`

## Super Admin Tenant Phase Addendum

### Summary

2026-06-10に、`super_admin` / スーパー管理者の視点で、テナント一覧から初回登録準備テナントと継続運用テナントを見分けられるかを確認した。実務検証では、未認証企業の初回登録準備と、認証済み企業の1年運用を並べて切り替えるため、SaaS運営側のテナント一覧にISMSフェーズが見えることが重要になる。代表修復として、Super Adminのテナント一覧APIと画面に `ISMSフェーズ` 列を追加し、`初回登録準備`、`継続運用`、`未設定` を表示できるようにした。既存DBに `gap_analysis` のような旧フェーズ値が残っていても、画面は未設定扱いに丸めて落ちないようにした。あわせて、初期System Operator作成時にsignup APIが現在のスーパー管理者セッションを上書きする問題を避けるため、Better Auth互換のユーザー/アカウントレコードを直接作成する方式へ変更した。

### Usability Test Results

| Scenario | Actor | Result | Blocker/Gap | Evidence | Priority |
| -------- | ----- | ------ | ----------- | -------- | -------- |
| テナント一覧でISMSフェーズを確認する | スーパー管理者 | 改善済み | テナントが初回登録準備か継続運用かを一覧で見分けられず、実務検証用テナントの切り替え判断が弱かった | `app/[locale]/super-admin/organizations/page.tsx`, `app/api/super-admin/organizations/route.ts`, `tests/e2e/super-admin.spec.ts` | P1 |
| 古いフェーズ値を持つテナント一覧を表示する | スーパー管理者 | 改善済み | `initial` / `surveillance` 以外の旧値があると翻訳解決で画面が壊れる可能性があった | `app/[locale]/super-admin/organizations/page.tsx`, `app/api/super-admin/organizations/route.ts` | P1 |
| テナント作成後もスーパー管理者としてロック/監査ログ確認を続ける | スーパー管理者 | 改善済み | 初期オペレーター作成にsignup APIを使うと、作成後のスーパー管理者セッションがForbiddenになる場合があった | `lib/services/superAdmin.ts`, `tests/e2e/super-admin.spec.ts` | P1 |

### Fit & Gap

| Gap | Classification | Priority | Status |
| --- | -------------- | -------- | ------ |
| Super Adminテナント一覧で初回登録準備/継続運用を見分けられない | UX navigation gap / Tenant operation gap | P1 | remediated_for_tenant_phase_column |
| 旧フェーズ値が一覧表示の翻訳解決を壊す | Data compatibility gap / UX robustness gap | P1 | remediated_for_unknown_phase_fallback |
| テナント作成時に初期オペレーターsignupが現在セッションを壊す | Session integrity gap / Tenant operation gap | P1 | remediated_for_operator_creation_without_session_mutation |

### Re-test Plan

- 対象Actor: スーパー管理者
- 対象Use Case: 実務検証用テナントを作成し、初回登録準備/継続運用の状態を一覧で見分け、必要に応じてロックと監査ログを確認する
- 再テストするScenario: super_adminでDev Loginし、テナント一覧に `ISMSフェーズ` 列があることを確認する。新規テナントを作成し、フェーズが `未設定` と表示されること、作成後もスーパー管理者のままロック/ロック解除と監査ログ確認ができることを確認する
- 合格条件: スーパー管理者がテナント一覧から実務検証用の初回登録準備/継続運用の切り替え判断ができ、テナント作成後も運営操作を継続できる
- 実行コマンド/確認方法: `npx playwright test tests/e2e/super-admin.spec.ts --project=chromium --reporter=line --workers=1`
