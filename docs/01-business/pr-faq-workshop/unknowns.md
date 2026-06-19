---
title: Unknowns
category: business
last_updated: 2026-06-19
status: no_active_unknowns
---

# Unknowns

この台帳は「現時点で判断または証跡が足りず、PR/FAQ、公開用リポ同期、実務検証、商用準備のどこかを止め得るもの」だけを残す。2026-06-19時点で、PR/FAQ docsスコープのActive Unknownはゼロである。

外部環境確認、公開snapshot実行、public repo反映、商用前hardeningなど、実作業として残るものはBacklogではなく、公開同期運用、deployment/release gate、または将来実装ゲートで扱う。

## Active Unknowns: None

なし。

## L3/L4 Blocker Map

PR/FAQ docsスコープ内のBlockerはなし。

公開snapshot実行、preview/production環境確認、public repoへのREADME/CONTRIBUTING/SECURITY反映、商用前hardeningは、それぞれ公開同期運用、deployment/release gate、または将来実装ゲートとして扱う。

## Resolved

| ID | Resolved Item | Evidence |
| --- | --- | --- |
| U-06 | W-01〜W-06全面業務ジャーニーの代表成立 | 2026-06-11〜12に `qa:suite:initial` 10/10、`qa:suite:surveillance` 15/15、`initial-journey-a.spec.ts`、`surveillance-journey.spec.ts` がpass。`docs/10-improvement-plan/checklist.md` ではWS1/WS2完了として管理。商用release採点の古い57点は履歴評価として扱う。 |
| U-07 | W-02 `initial` 初回登録準備deep CRUD | 文書、情報資産、リスク、管理策、適用管理策の判断、タスク、審査準備パッケージ、PDF/ZIP/UIまで代表QA済み。`docs/10-improvement-plan/checklist.md` WS1に反映済み。 |
| U-08 | `surveillance` 継続運用代表サイクル | 文書改訂、リスク再評価、教育記録、監査計画、監査実施開始、監査報告、CAPA、フォローアップ、マネジメントレビュー、残留リスク受容、年次証跡提出束まで代表QA済み。 |
| U-09 | browser direct DB access の主要導線リスク | 主要画面/API境界は 2026-06-04〜13 のQAとGAP-001〜027で修正済み。新規画面追加時は通常のQA対象とする。 |
| U-10 | CAP-22 契約終了時の保持/削除/復旧境界 | PO判断済み。主要業務データ一式のエクスポート、30日保持、その後削除、早期削除受付、初期商用のベストエフォート復旧方針。CO-01〜CO-06 実装済み。 |
| U-11 | CAP-30 審査準備パッケージの保証表現 | PO判断済み。「審査に向けた整理と提出準備を強く支援する。ただし審査通過・受理は保証しない」。画面、PDF、ZIP/manifest、FAQへ展開済み。 |
| U-12 | ローカルSQLiteの `user_department_scopes` テーブル整合 | `seed:practical-verification` がテーブル/indexを補完し、`qa:practical-seed` と関連QAで確認済み。 |
| U-13 | 監査計画/監査報告書承認の実務導線 | 監査計画新規作成、チーム登録、承認/却下/再申請、監査開始、監査報告書の承認/却下/再申請まで代表QA済み。 |
| U-14 | `approver` ロールと体制ロールの対応 | PO判断済み。現行版は単段承認を完成形とし、多段・役員承認は将来拡張。 |
| U-15 | PR/FAQ上の主要顧客像と購買者 | PO判断済み。初回登録準備企業と認証済み企業の両方を対象にし、初期営業・デモは経営者・管理責任者を主対象にする。 |
| U-16 | 競合・代替手段に対する成熟度基準 | PO判断済み。Excel/文書フォルダ/汎用タスク管理/コンサル支援との代替手段比較に留め、専用GRC/ISMS製品の詳細比較は今は深掘りしない。 |
| U-17 | 外向き文言と内部開発文言の境界 | `pr-faq-public.md` / `pr-faq-internal.md` を分離し、`qa:public-copy` と `qa:submission-copy` で境界QAを実施。新規公開面追加時は継続チェック。 |
| U-18 | `SoA` の外向き代替表現 | PO判断済み。「適用管理策の判断」に統一し、一般に適用宣言書として扱われる内容だと説明する方針。UI/FAQ/出力物に展開済み。 |
| U-19 | 契約終了時のエクスポート対象と形式 | PO判断済み。文書、リスク、情報資産、タスク、教育、監査、是正、マネジメントレビュー、取得可能な添付ファイルを対象にし、CSV/組織バックアップZIPで扱う。 |
| U-20 | AI入力の個人情報フィルタ、ログ、採否履歴、人手確認 | AI-01〜AI-07 実装済み。入力範囲、実行ログ、採否履歴API/UI、人手確認、監査ログ、機密情報制御、release gateを `docs/05-quality/ai-assist-release-gate.md` と実装に反映。 |
| U-01 | preview / production の `BETTER_AUTH_SECRET` と auth origin 設定 | PR/FAQ docsスコープではblockerから除外。secret値を記録しない外部環境確認はdeployment/release gateとして扱う。local buildのBetter Auth default secret warningは既知の環境警告。 |
| U-02 | 公開用リポに出す範囲と公開直前QA | 公開範囲・除外境界・source-available evaluation snapshot方針・同期手順は `public-repo-sync` / `pjt007-public-sync` とPR/FAQ docsに整理済み。実snapshotとCIは公開同期運用で実行する。 |
| U-03 | unit runnerから一時除外された2 testの扱い | PR/FAQ backlogのblockerから除外。除外理由・代替検証・復帰条件は品質改善ゲートで扱う。 |
| U-04 | `assessment_period` の業務表現 | 現行公開docsでは `YYYY-MM` 自動導出を維持する前提でclose。FY/四半期表現は要望が出た時の将来拡張とする。 |
| U-05 | 公開用snapshot作成後の本家repoとの継続運用 | private原本で開発し、節目で公開snapshotを再作成し、公開PRで取り込む運用として整理済み。実行記録は公開同期時に残す。 |
| U-21 | AI駆動開発の公開範囲と証拠の出し方 | `ai-driven-development.md` に公開/非公開境界、証跡の出し方、README/記事転用文を整理済み。 |
| U-22 | 外部コントリビューターや協業候補の受け入れ方 | `contribution-and-collaboration.md` にフィードバック、外部PR、商用相談、security contact、README/CONTRIBUTING/SECURITY転用文を整理済み。 |
| U-23 | SaaS型の深いユーザーモデルと単一利用者向け切り出しの優先順位 | 現行公開では深いSaaS型を主軸、単一利用者向け切り出しは将来の提供形態オプションとして扱う方針でclose。 |
| U-24 | Excel/Word import/exportの公開約束範囲 | `import-export-coverage-matrix.md` に実装済み形式、未対応形式、公開説明上の注意、追加QA候補を整理済み。 |
