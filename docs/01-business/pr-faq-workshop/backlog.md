---
title: PR/FAQ Backlog
category: business
created: 2026-06-09
last_updated: 2026-06-19
status: backlog_zero
---

# PR/FAQ Backlog

このBacklogは、`pr-faq-public.md` の顧客価値と `pr-faq-internal.md` の内部判断を、実装、docs、UI、QAへ揃えるための台帳である。PR/FAQを正として、既存コードとの差分をここに積む。

## Status Summary（2026-06-19）

Backlogはゼロ。PR/FAQから発生したdocs内の課題はすべて整理済みである。

ここでいうBacklogゼロは、「今後の公開sync、CI確認、public repo README反映、商用前hardeningが不要」という意味ではない。PR/FAQ workshop内の未整理課題を残さず、次に実行すべきものを公開同期運用、外部環境確認、または将来実装ゲートへ移した、という意味である。

### Open: None

なし。

### Partial: None

なし。

### Done

PRFAQ-BL-01〜26はすべて完了またはPR/FAQ docsスコープ内ではclose済み。公開snapshotの実行、外部CI、production/preview環境確認、商用前hardeningはBacklogではなく、公開同期スキル、運用runbook、または将来実装ゲートで扱う。

## Backlog

| ID | Priority | Gap | Type | Blocked by Unknown | Needed Evidence | Maturity Contribution | Done Condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRFAQ-BL-01 | P1 | 顧客像と購買者を明文化する | owner_decision | none | オーナー判断、競合/代替手段メモ | PR/FAQの約束範囲を固定できる | done: DECIDED-2026-06-11-08で「初めて取得する企業」「すでに認証済みの企業」の両方を並列対象とし、入口分岐する方針を確定 |
| PRFAQ-BL-02 | P1 | 初回登録準備の最初に見せるデモシナリオを固定する | docs + QA | none | seed、画面順序、QA証跡、審査準備パッケージ | 初回登録準備の入口が分かりやすくなる | done: `initial` 内部ラベルを使ったQAを維持しつつ、Playwright ジャーニーA スイート（tests/e2e/initial-journey-a.spec.ts）を作成・全PASS（2026-06-12）。ダッシュボード統計・組織設定・文書一覧・リスク一覧・SoA・審査準備パッケージの主要フロー6テストが全グリーン |
| PRFAQ-BL-03 | P1 | 継続運用の1年サイクルデモシナリオを固定する | docs + QA | none | 監査、是正、レビュー、残留リスク、審査準備パッケージQA | 認証済み企業向け価値が説明しやすくなる | done: qa:suite:surveillance 15/15 PASS + Playwright ジャーニーB (surveillance-journey.spec.ts 10ステップ) PASS (2026-06-12) |
| PRFAQ-BL-04 | P1 | 承認者ルールを承認対象別に整理する | owner_decision + business_rule + implementation | none | approval-responsibility-matrix、画面ラベル、DB項目、QA、PO判断 | ロール混乱を減らし、監査説明力が上がる | done_for_practical_verification: DECIDED-2026-06-11-09で現行の単段承認を完成形とするPO判断済み。多段・役員承認は将来拡張 |
| PRFAQ-BL-05 | P1 | 審査準備パッケージ内gapの説明品質を上げる | UI + implementation + QA | U-06 | PDF/UI/manifestのgap表示、ユーザ操作確認 | 「何が足りないか」が実務で判断しやすくなる | done: gapごとに不足理由、次アクション、関連画面がUI/manifest/CSV/PDFに表示され、初回登録準備/継続運用の代表QAで確認済み |
| PRFAQ-BL-06 | P1 | 「審査準備パッケージ」を審査支援として魅力的かつ過剰保証しない表現へ改める | owner_decision + docs + UI | U-06 | 文言レビュー、PR/FAQ更新、UI/PDF文言 | 審査準備支援の価値を訴求しつつ過剰約束を避ける | done_for_runtime_surface: PR/FAQ、審査準備パッケージ画面、PDF、ZIP/manifest、API error、代表QAの表現を「審査準備パッケージ / Audit Preparation Package」へ統一。審査通過保証ではなく、強い作成支援として表現する方針で、2026-06-10に初回登録準備/継続運用の代表E2Eをpass |
| PRFAQ-BL-07 | P1 | ロール名、メニュー名、体制ロールを見直す | UX + docs + implementation | U-14 | role-responsibility snapshot、画面棚卸し、ユーザレビュー | 操作者が自分の立場を理解しやすくなる | done: messages/ja.json のロールラベルを全面確認。breadcrumbs.super_admin と superAdmin.users.roles.super_admin が英語のまま（"Super Admin"）だったため「スーパー管理者」に修正。system_operator も「システム運営者」に統一。org_admin/auditor/approver/user は既に日本語対応済みを確認（2026-06-12） |
| PRFAQ-BL-08 | P2 | 審査準備パッケージPDFの日本語フォント埋め込みと提出先向けデザインを改善する | UI + implementation + QA | none | PDFレンダリング確認、複数ページ確認 | 審査準備資料としての信頼感が上がる | done: HTML+Chromium/Puppeteer生成に更新し、旧Helvetica fallbackを廃止。ZIP内PDF+単独PDFで日本語抽出、フォント埋め込み、複数ページ、ページ番号、確認欄を確認。CI Mainline/QA Matrix/Vercel pass済み（PR #212 / 2026-06-17） |
| PRFAQ-BL-09 | P2 | 競合/代替手段との比較基準を明文化する | research + owner_decision | none | 比較表、手作業運用、汎用タスク管理、文書管理/GRC比較 | 完成条件を競合基準で判断できる | done_for_current_positioning: DECIDED-2026-06-11-11で比較表は作らず、「ワークフロー連結」の優位性訴求に限定。詳細比較は商用準備フェーズへ残置 |
| PRFAQ-BL-10 | P2 | AI支援の扱いをPR/FAQ上で後続化する | docs + QA | U-08 | AI入力/ログ/採否/個人情報方針 | 過剰なAI価値訴求を避ける | done: AI-01〜AI-07を実装。入力範囲表示、実行ログ、採否履歴API/UI接続、人手確認、監査ログ、外部送信/個人情報/添付本文制御、release gate文書を追加。AI無効/機能無効/token limit時はAPIで拒否し、外部送信OFFではMockProviderを強制（2026-06-17） |
| PRFAQ-BL-11 | P1 | 契約終了時のエクスポート方針を商用SaaS前提で設計する | owner_decision + implementation + QA | none | owner-decision-policy、PR/FAQ、利用規約方針、Excel/CSV/PDF export QA | 顧客が自社情報を持ち出せる安心感を作る | done: CO-01〜CO-06を実装。契約終了時エクスポート案内、30日保持/削除予定、早期削除受付、削除実行証跡記録API、外部ファイル例外manifest、ベストエフォート復旧/RTO-RPO未保証表示を追加。実削除ジョブ本体は破壊的処理のため未接続（2026-06-17） |
| PRFAQ-BL-12 | P2 | 顧客向けFAQを実画面の文言やヘルプへ展開する | UX + docs | PRFAQ-BL-01 | FAQ本文、UI文言、messages同期 | 利用者が迷いにくくなる | done: ホーム、審査準備パッケージ、適用管理策判断、監査、是正の主要説明・空状態・次アクション文言へFAQ内容を展開。ja/en/zh同期、lint:messages・qa:public-copy pass（2026-06-17） |
| PRFAQ-BL-13 | P0 | 外向きPR/FAQに内部開発プロセスや検証都合が混ざらない境界を作る | docs + UX + QA | U-17 | PR/FAQ、messages、主要画面、PDF、manifestの文言棚卸し | 顧客向け説明の品質と信頼性を守る | done: `pr-faq-public.md` と `pr-faq-internal.md` を分離し、`npm run qa:public-copy` でmessages/app/components/公開候補PRFAQに内部語・旧語が混ざらないことを検査できる。2026-06-19に公開PR/FAQ更新後もpass。新規公開面・新規出力物は通常QAとして扱い、Backlogには残さない |
| PRFAQ-BL-14 | P1 | `SoA` の外向き表現を平易な用語へ統一する | docs + UI + implementation + QA | none | messages、承認キュー、管理策画面、審査準備パッケージ、PDF、API errorの棚卸し | 一般利用者が専門略語なしで理解できる | done_for_pr_faq: DECIDED-2026-06-17-15で「適用管理策の判断」に統一し、一般に適用宣言書として扱われる内容だと分かる補足を加える方針を確定。内部DB/API識別子と過去ログでは `soa` / `SoA` を残す |
| PRFAQ-BL-15 | P1 | `initial` / `surveillance` の外向き表現を統一する | docs + UI + QA | U-17 | phase selector、組織設定、Home、messages、PDF/manifestの文言棚卸し | 利用者が自社状況に応じた入口を選びやすくなる | done: 日本語UIは「初回登録準備」「継続運用」、英語UIは「Initial certification preparation」「Annual ISMS operation」、中国語UIは「初次认证准备」「年度持续运行」へ統一済みを全messages/*.jsonで確認。phase selector / Home phase sync QAはpass。public-facing ページ（/ja,/en,/zh）に内部用語「initial」「surveillance」が漏れていないことを grep で確認済み（2026-06-12） |
| PRFAQ-BL-16 | P1 | PR/FAQの商用SaaS最終ゴールとspec-dslの実務検証中間ゴールを矛盾なく併記する | docs | U-17 | parent-objective、README、release-readiness、PR/FAQの差分レビュー | 開発目標と事業目標の混同を防ぐ | done: decisions.md に DECIDED-2026-06-12-14 として整合ドラフトを追記。parent-objective.md（confirmed）と pr-faq-public.md（public_candidate）の整合を確認：①最終ゴール一致、②中間ゴールは内部文書のみ（意図的二重構造）、③保証範囲一致、④用語統一方針整合、⑤顧客ペルソナ整合。両文書の追加修正は不要。POは全体検証時にレビュー（2026-06-12） |
| PRFAQ-BL-17 | P1 | seed/Dev LoginをPR/FAQの内部検証基盤として整理する | docs + QA + implementation | none | seed reset、Dev Login E2E、tenant switch E2E、stale data cleanup証跡 | PR/FAQで語る顧客価値を、複数企業パターンで検証しやすくする | done: `seed:practical-verification -- --reset --scenario all` が4テナント（初回登録準備、継続運用、enterprise、suspended）を作成し、旧Playwright/E2E組織50件・ユーザー70件をcleanup。Dev Loginはテナント選択 -> テナント内ユーザー選択へ更新し、対象E2E pass（2026-06-17） |
| PRFAQ-BL-18 | P0 | 公開用リポジトリへ出すsnapshot範囲を固定する | docs + operation + validation | U-02 | allowlist、denylist、公開README/LICENSE/SECURITY/CONTRIBUTING、secret scan、公開CI | Build in Publicの信頼性を守り、内部履歴や秘密情報を出さない | done_for_docs_scope: 公開範囲の考え方、除外境界、source-available evaluation snapshot前提、公開sync手順は `public-repo-sync` / `pjt007-public-sync` とPR/FAQ docsに整理済み。実際のsnapshot作成・CI確認は公開同期運用の実行ゲートとして扱う |
| PRFAQ-BL-19 | P0 | PR/FAQを商用開始ではなくsource-available evaluation snapshot公開の文脈へ更新する | docs | none | `pr-faq-public.md`, `pr-faq-internal.md`, README の整合確認 | 公開意図の誤解を防ぐ | done: 2026-06-18にPR/FAQ本文へBuild in Public / source-available snapshotの前提を反映 |
| PRFAQ-BL-20 | P0 | 古いSupabase前提のセットアップ/QA手順をactive docsから外す | docs hygiene | none | `rg supabase`、active docsの現行手順、archive移動 | 公開snapshotと現行開発の混乱を防ぐ | done: 2026-06-18に高リスクな古いQA/運用手順を `docs/archive/legacy-supabase-qa/` へ退避し、主要運用docsをTurso/libSQL版へ置換 |
| PRFAQ-BL-21 | P1 | 公開用リポジトリの継続同期運用を定着させる | operation | U-05 | 公開sync skill実行ログ、公開PR、初回CI結果 | Build in Publicを一度きりで終わらせず、節目更新できる | done_for_docs_scope: private原本で開発し、節目で公開snapshotを再作成し、公開clone側の `public-sync/YYYYMMDD` ブランチでPR化する運用はskillとhandoffに整理済み。次回以降は公開同期作業の実行記録として扱う |
| PRFAQ-BL-22 | P0 | AI駆動開発の公開方針を作る | docs + operation | U-21 | 公開可能な開発ログ方針、AI駆動開発の説明、秘密情報/内部メモを出さない基準 | Build in Publicのもう一つの主軸である開発スタイルの信頼性を作る | done: `ai-driven-development.md` で方針化済み。public README / 記事 / 開発ログへ転用できる文面と、公開する/しない境界を整理済み |
| PRFAQ-BL-23 | P1 | コントリビューター/協業/商用相談の入口を整える | docs + governance | U-22 | `CONTRIBUTING.md`、Issue/Discussion方針、commercial inquiry導線、受け入れ基準 | 公開後に関心を持った人が次の行動を取りやすくなる | done: `contribution-and-collaboration.md` で入口方針、外部PRの扱い、security contact、商用相談、README/CONTRIBUTING/SECURITYへの転用文を整理済み |
| PRFAQ-BL-24 | P1 | SaaS型と単一利用者型の提供形態を整理する | owner_decision + product_design | U-23 | PO判断、ユーザーモデル比較、公開roadmap、必要な削除/簡略化実装の一覧 | 深いテナント管理を残すべきか、簡単な個人/単社向け体験を作るべきか判断できる | done_for_current_public_positioning: 現行公開では深いSaaS型を主軸にし、単一利用者向け切り出しは将来の提供形態オプションとしてPR/FAQ本文に整理済み。実装削除や別パッケージ化は今のBacklogではなく将来商品設計として扱う |
| PRFAQ-BL-25 | P0 | Excel/Word import/exportの公開約束範囲を棚卸しする | docs + QA + implementation | U-24 | import/export coverage matrix、実ファイルQA、未対応形式、復元できる/できない対象 | SaaSロックイン回避の主張を実装と証拠で支える | done: `import-export-coverage-matrix.md` で文書、情報資産、リスク、タスク、教育、監査、是正、レビュー、添付、組織ZIP、契約終了バックアップの対応表を作成済み。追加QAは通常の品質改善として扱う |
| PRFAQ-BL-26 | P1 | 課金/プラン/Stripe連携の現在地を公開向けに整理する | docs + QA | none | mock/real Stripe境界、プラン設定、未本番運用の明記、公開READMEの制約 | 「課金を想定した設計」と「商用課金開始ではない」の誤解を防ぐ | done: `billing-and-data-operations.md` でStripe real/mock境界、商用課金開始ではないこと、ローカル検証、本番前QAゲート、公開README向け文言を整理済み。hardening実装は商用前セキュリティ実装ゲートで扱う |

## L3最小検証パッケージ

以下は過去の最小検証順序であり、2026-06-19時点ではBacklog上の未完了項目ではない。新規公開面・新規出力物を作る場合の通常QA順として参照する。

1. `PRFAQ-BL-13`: 外向き/内向き文言の境界を先に固定する。
2. `PRFAQ-BL-14`: `SoA` の外向き表現を平易な用語へ置き換える。
3. `PRFAQ-BL-15`: `initial` / `surveillance` の外向き表現を統一する。
4. `PRFAQ-BL-02`: 初回登録準備のデモ手順を固定する。
5. `PRFAQ-BL-03`: 継続運用の年次デモ手順を固定する。
6. `PRFAQ-BL-05`: 審査準備パッケージgapに不足理由と次アクションを表示する。

## Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-06-09 | PR/FAQ初稿は現状起点で作成する | 既存コード、spec-dsl、QA証跡が十分にあるため |
| 2026-06-09 | 商用公開ではなく実務検証版を主語にする | 親目標が「自分が利用者・テスターとして試せる状態」であるため |
| 2026-06-09 | 認証取得保証、審査受理保証、課金運用完成は約束しない | owner decisionが必要であり、現行実装の保証範囲を超えるため |
| 2026-06-09 | PR/FAQの外向き主語は商用SaaS最終ゴールへ修正する | 実務検証は内部開発上の中間ゴールであり、顧客向けPRの訴求ではないため |
| 2026-06-09 | `SoA`、`initial`、`surveillance` は外向きには平易な表現へ置き換える | 一般利用者に伝わる言葉で初回登録準備と継続運用を説明するため |
| 2026-06-09 | 審査通過は保証しないが、審査準備支援の価値は前向きに訴求する | 商品の魅力を損なわず、過剰保証も避けるため |
| 2026-06-09 | 審査準備パッケージ画面は、準備済みなら出力、不足ありなら関連画面への次アクションを表示する | ロール別に見たとき、利用者が次に何をすべきか判断できる状態へ近づけるため |
| 2026-06-18 | Build in Publicの目的にAI駆動開発の実証を含める | ISMS支援SaaSとしての仮説検証だけでなく、オーナーがコードを書かずAIエージェントと業務アプリを作る開発スタイル自体も公開価値に含めるため |
| 2026-06-18 | public PRでは現在地、未完成部分、協業余地を明示する | 完成品の商用リリースと誤解させず、フィードバック、コントリビューター、協業候補との対話につなげるため |
