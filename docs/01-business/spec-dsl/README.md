---
title: Riscala AI for ISMS 業務仕様参照パッケージ
category: business
last_updated: 2026-06-08
status: draft
---

# Riscala AI for ISMS 業務仕様参照パッケージ

このディレクトリは、現行システムに実装済みの業務仕様を、AIや外部システムから参照・検証しやすい形式で再整理したものです。新しいプログラミング言語を作るのではなく、コード、DB定義、API、画面/QAドキュメントから確認できる業務フロー、判断ルール、データ構造、API仕様、例外処理、人手確認条件を標準仕様に寄せて記述します。

## 2026-06-06 実務検証版への親目標更新

当面の親目標は、商用公開ではなく、ユーザ自身が利用者・テスターとしてISMS運用に使えるかを見極める実務検証版である。

- `initial`: 未認証企業が初回審査登録に向けて、スコープ、体制、文書、資産、リスク、管理策、初期タスクを準備するストーリー。
- `surveillance`: 認証済み企業が1年間の継続運用、内部監査、マネジメントレビュー、是正、継続改善を回すストーリー。

最初の検証対象は `initial` の W-02「顧客テナントのISMS初期導入」とする。商用課金、契約終了時データ責任、認証取得保証、SaaS復旧責任は後続判断へ分離する。

2026-06-08時点では、`initial` のW-02代表deep CRUDは一巡した。フェーズ選択、組織基本情報、ISMSスコープ、体制ロール、ユーザーライフサイクル、文書作成/承認、情報資産CRUD、リスク評価更新、新規リスク/対応策作成、管理策リンク編集、SoA準備状況表示、管理策単位の適用/除外理由保存、SoA承認申請/CISO承認、却下後修正/再申請、SoA v1固定、SoA v2差分、SoA版単位の改訂理由保存、SoA版レビュー申請/CISO承認、SoA版レビュー却下後の修正版再発行/CISO承認、審査提出束マニフェスト/ZIP/PDF/UI、初期タスク進捗更新、担当者変更履歴、新規タスク作成、サブタスク作成/完了、タスクコメント投稿/編集/削除/メンション通知、タスクタグ、タスク添付、提出束内の初期タスク進捗/親子構造表示はruntime QAで確認済みである。

`surveillance` は、内部監査入口、監査計画の新規作成/監査チーム登録/承認/却下/却下後修正再申請/監査開始、不適合/是正更新、通常タスクではなく監査不適合/CAPAとして扱う境界表示、CAPAの原因分析/是正方針/再発防止/有効性確認、有効性確認フォローアップの次アクション表示/担当者選択付き直接作成/担当者通知/期限リマインダー/期限超過通知、是正完了承認の申請/却下/却下後再申請/CISO承認、フォローアップ完了/検証済み更新、マネジメントレビュー入力、Home/タスク連携、期限超過/リマインダー、証跡不足表示、経営判断/資源配分/期限付きリスク受容条件、残留リスク受容の理由/責任者/再レビュー日/完了証跡/承認申請/CISO承認/却下/却下後修正再申請、監査報告書の承認/却下/却下後修正再申請、継続運用側の提出束マニフェスト/ZIP/PDF/UI、PDF複数ページ化/日本語見出し、文書プロファイル/確認欄の代表QAが通っている。残る主なGapは、多段承認/承認者ルール細分化、日本語フォント埋め込み/提出先向けデザインである。

## 2026-06-05 現行コードベースとの差分精査メモ

| Area | Code / QA Evidence | Spec DSL Update |
| --- | --- | --- |
| W-02 initial | `qa:initial-w02-soa-readiness` でSoA承認/却下後再申請/SoA v1固定、SoA v2差分、版単位の改訂理由保存、SoA版レビュー承認、SoA版レビュー却下後の修正版再発行/CISO承認までpass。`qa:initial-w02-submission-bundle` で審査提出束マニフェスト/ZIP/PDF/UI、PDF複数ページ化/日本語見出し、文書プロファイル/確認欄までpass | W-02は `representative_ready` とし、次段Gapを日本語フォント埋め込み/提出先向けデザイン、承認者ルール細分化へ移した |
| W-03〜W-05 surveillance | `qa:surveillance-residual-risk-acceptance` / `qa:surveillance-audit-plan-approval` / `qa:surveillance-audit-report-approval` / `qa:surveillance-submission-bundle` までpass | 継続運用は残留リスク受容、再レビュー日、監査計画の新規作成/却下後再申請、監査報告書の却下後修正再申請、年次証跡提出束のready/gap表示まで確認し、多段承認/承認者ルール細分化と監査実施開始との深い連動を次Gapにした |
| client/server boundary | 文書承認、情報資産CRUD、リスク更新、管理策リンク、SoA判断/承認申請、残留リスク受容の作成/完了更新/承認申請、タスク更新/新規作成/サブタスク作成/コメント投稿/編集/削除/メンション通知/タグ作成/タグ付与/添付アップロード/履歴取得、監査/是正/フォローアップGET/PATCH、承認キュー一覧/処理、監査計画新規作成/更新/承認申請/承認/却下、監査報告書保存/承認申請/承認/却下、提出束API/ZIP/PDF、残留リスク受容の承認/却下はAPI境界化済み | 未確認Gapを「多段承認/承認者ルール細分化、監査実施開始との深い連動など未QA操作」へ具体化した |
| Gate evidence | 旧journey suiteの件数表記が文書間で揺れていた | `gates.md` は実務検証QAの代表passと、full journey suite未復旧を分けて記載する |
| Process P-005 | 報告書ページからの承認申請、CISO承認者解決、承認キューでの承認/却下、却下後修正再申請QAがpass | `process.md` の監査報告書承認は代表QA済みへ更新し、残Gapを多段承認、監査実施開始との連動、審査提出束の説明品質へ移す |

## 採用する記述形式

| 領域 | 採用形式 | 理由 |
| --- | --- | --- |
| 業務フロー | BPMN化しやすいMarkdown/YAML構造 | 現時点ではBPMN XMLより、実装と照合しやすい中粒度の手順・担当・システム処理が有用 |
| 判断ルール | DMN風YAML判断表 | 承認、権限、エラー判定、例外処理をAIが機械的に参照しやすい |
| データ定義 | JSON Schema 2020-12 | DrizzleスキーマとAPI payloadを検証しやすい |
| API仕様 | OpenAPI 3.1化しやすいYAML | Next.js API Routeの外部/内部契約を整理しやすい |
| 例外・監査 | YAML | 再処理条件、ログ、担当者確認条件を表形式で管理しやすい |
| 用語 | Markdown | 人間とAIの共通語彙として参照しやすい |

## ファイル構成

```text
docs/01-business/spec-dsl/
├── README.md
├── parent-objective.md
├── workflows.md
├── capabilities.md
├── entities.md
├── gates.md
├── evidence-map.md
├── approval-responsibility-matrix.md
├── needed-but-unprepared.md
├── process.md
├── decision_rules.yaml
├── data_schema.json
├── api_spec.yaml
├── exception_policy.yaml
└── glossary.md
```

## 2026-05-15 標準構成への補正

2026-05-15時点で、このspec-dslはCapability Readiness Assessmentの標準構成へ補正した。既存の `process.md`, `decision_rules.yaml`, `data_schema.json`, `api_spec.yaml`, `exception_policy.yaml`, `glossary.md` は詳細根拠として残し、親目標、Workflow、Capability、Gate、Evidence、未準備項目を読みやすい単位に分けた。Unknownは2026-06-18にPR/FAQ由来のBacklogと同時管理するため `../pr-faq-workshop/unknowns.md` へ移した。

新しい標準ファイルの役割:

- `parent-objective.md`: 親目標、成功境界、非目標、オーナー判断事項。
- `workflows.md`: W-01〜W-06の業務ジャーニー。
- `capabilities.md`: CAP-01〜CAP-32の必要能力、優先度、現状。
- `entities.md`: 主要業務エンティティと実装対応。
- `gates.md`: release-readiness required gateとCAP/Workflowの対応。
- `evidence-map.md`: コード、API、DB、tests、QA、docsの証跡対応。
- `approval-responsibility-matrix.md`: 文書、監査、是正、残留リスク、経営判断など承認対象ごとの責任者とGap。
- `../pr-faq-workshop/unknowns.md`: PR/FAQ、公開用リポ同期、商用準備に紐づく未確認事項、必要証跡、判断待ち。
- `needed-but-unprepared.md`: 親目標達成に必要だが未準備/部分準備の項目。

## 確認済みの主な根拠

- `lib/db/drizzle/schema/**`: 現行DBスキーマ、状態値、主要項目
- `lib/services/document.ts`: 文書作成、版管理、2段階承認、通知、監査ログ
- `lib/services/approval.ts`: 汎用承認、承認イベント、差戻し、エスカレーション
- `lib/services/audit.ts`: 監査計画/報告書承認、不適合、是正、フォローアップ
- `lib/services/risk.ts`: リスク、対応、資産、管理策、評価履歴
- `lib/services/incident.ts`: インシデント作成、承認、関連リソースリンク
- `app/api/**/route.ts`: APIエンドポイント、認証、バリデーション、エラー応答
- `docs/01-business/**`, `docs/CODEMAPS/**`, `docs/02-project/stories/**`: 業務要件、コードマップ、QAシナリオ
- `docs/02-project/release-readiness/**`: W-01〜W-06、CAP-01〜CAP-32、Fit & Gap、Gate、score
- `docs/handoff/2026-05-15_handoff.yaml`: Next 16移行後のsecurity gate解消、残課題、次アクション

## 確認済みと未確認の扱い

- `confirmed`: コード、DB定義、APIルート、既存ドキュメントで確認した仕様。
- `partially_confirmed`: 複数根拠はあるが、画面操作・サービス・DBのどこかで粒度差がある仕様。
- `unconfirmed`: 現時点の調査では仕様として断定できないもの。推測で補完しない。

## 未確認事項

未確認事項の正本は `../pr-faq-workshop/unknowns.md` に移した。今後のreadiness判断では、PR/FAQで生成・更新されるBacklogとUnknownsを同じ場所で読む。
