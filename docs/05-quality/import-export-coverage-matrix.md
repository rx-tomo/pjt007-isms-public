# Import / Export Coverage Matrix

Last updated: 2026-06-18

## Purpose

PR/FAQ の「SaaS に情報を閉じ込めない」「既存 Excel / Word 運用から段階移行できる」という説明について、現行実装・QA 証跡・未対応範囲を 1 枚で確認するための棚卸しです。

本 matrix は公開説明の強さを調整するための QA 資料です。契約終了時の法務文言、SLA、実削除ジョブ接続、個別顧客データ移行手順は別途 owner decision / operations docs で扱います。

## Executive Summary

- 現行実装で強く言える範囲は、主要データの CSV / Excel 互換 XML / PDF / JSON / ZIP による持ち出しと、一部 CSV / ZIP による取り込みです。
- Word 形式で確認済みなのは文書単体の `.docx` export です。Word 文書の汎用 import は未実装です。
- Excel 形式は、文書の SpreadsheetML `.xls` とリスクの Excel export が中心です。汎用 `.xlsx` import は未実装で、CSV import を Excel / Google Sheets で編集して戻す運用が現実的です。
- 組織基本データ ZIP は scope / 部門 / 役割 / ユーザー / 管理策 / 情報資産を import / export できます。
- 契約終了バックアップ ZIP は主要 CSV と取得できたファイル実体、`backup_files_manifest.csv` を含みます。ただし完全復元 ZIP ではありません。
- 審査準備パッケージ ZIP / PDF は提出準備支援の成果物であり、契約終了時の完全バックアップとは別物です。

## Coverage Matrix

| 領域 | Export 形式 / API | Import 形式 / API | 実装状態 | QA 証跡 | 未対応 / 注意 | 公開説明上の注意 |
| --- | --- | --- | --- | --- | --- | --- |
| 文書 | PDF / Word `.docx` / Excel 互換 `.xls`: `GET /api/documents/[id]/export?format=pdf\|word\|excel` | 汎用 Word / Excel import は未確認。通常 CRUD / upload-download QA は別系統 | 単体文書 export は実装済み。組織名、版、出力時刻、承認、版履歴を含む | `npm run qa:documents`, `npm run qa:documents:approver`, `test-results/document-export-*.json` | Word import、フォルダごとの一括 export、添付込み文書バックアップは未対応 | 「Word / Excel で扱える形式として文書を持ち出せる」は可。「既存 Word 文書をそのまま完全移行」は不可 |
| 情報資産 | CSV: `GET /api/information-assets/export`。組織 ZIP 内 `information_assets.csv` | CSV: `POST /api/information-assets/import`。組織 ZIP import 内 `information_assets.csv` | CSV round-trip / insert / upsert は実装済み。replace は docs 上の想定に対して実装確認不足 | `npm run qa:assets:csv`, `scripts/qa-assets-import.js`, `test-results/assets-csv-roundtrip-*.json` | 1,000 行制限。owner_email 解決に依存。Excel `.xlsx` 直接 import は未対応 | 「Excel で編集した CSV を戻せる」は可。「任意の資産台帳 Excel を無変換で取り込める」は不可 |
| リスク | Excel / PDF: `GET /api/risks/export?format=excel\|pdf`。CSV template あり | CSV: `POST /api/risks/import` | Excel/PDF export と CSV import は実装済み。フィルタ / matrix 条件連動あり | `npm run qa:risks:export`, `scripts/qa-risks-export.js`, `tests/unit/risk-excel-export.test.ts` | リスク治療、管理策リンク、詳細な評価履歴の完全 round-trip は未確認 | 「一覧や評価結果を Excel/PDF で持ち出せる」は可。「リスク台帳全体を完全復元できる」は保留 |
| タスク | CSV: `GET /api/tasks/export`。CSV template あり | CSV: `POST /api/tasks/import` | CSV export / import は実装済み。status / priority / assignee / tag などを扱う | `tests/unit/task-export.test.ts`, `npx playwright test tests/e2e/tasks.spec.ts --grep 'CSVエクスポート'`, `npm run qa:tasks` | コメント、履歴、添付の CSV round-trip は未確認 | 「タスク一覧・進捗を CSV で持ち出せる」は可。「タスクの全履歴と添付を完全復元」は不可 |
| 教育 | CSV: `GET /api/education/export` | 専用 import API は未確認 | 教育計画の export は実装済み。followUp filter あり | `npm run qa:surveillance-education-update`, 審査準備パッケージ QA | 教育計画 / 受講記録 / 教材の import、教材添付の一括持ち出しは未対応 | 「教育状況を CSV で確認できる」は可。「既存研修台帳を一括移行」は未対応 |
| 監査 | 監査報告 PDF: `GET /api/audit/reports/[reportId]/export`。監査単位 CSV import: `POST /api/audit-units/import` | 監査単位 CSV import のみ確認 | 監査報告 PDF export と監査単位 import は実装済み | `tests/unit/audit-report-pdf.test.ts`, `npm run qa:surveillance-audit-report-approval`, `npm run qa:surveillance-audit-plan-approval` | 監査計画、チェックリスト、証跡、指摘、不適合の完全 import/export は審査準備 package 依存で、汎用復元 API は未確認 | 「監査報告書を PDF で出せる」は可。「監査全データを丸ごと移行」は保留 |
| 是正 / 不適合 | 審査準備パッケージ ZIP/PDF/CSV に gap / corrective action summary を含める | 専用 import API は未確認 | 業務フローと審査準備 package への反映は実装済み | `npm run qa:surveillance-corrective-action-update`, `npm run qa:surveillance-submission-bundle` | 是正処置単体 CSV export / import は未確認 | 「審査準備資料に是正状況を含められる」は可。「是正台帳の完全移行」は未対応 |
| マネジメントレビュー | JSON: `GET /api/management-reviews/export?id=...`。審査準備パッケージにも summary 反映 | 専用 import API は未確認 | 単体 review JSON export は実装済み | `npm run qa:surveillance-management-review-input`, `npm run qa:surveillance-management-decision`, `npm run qa:surveillance-submission-bundle` | CSV/Excel/Word export、レビュー import、actions の完全 round-trip は未確認 | 「レビュー記録を JSON で取り出せる」は可。「Excel/Word 形式で移行可能」は現時点では不可 |
| 添付ファイル | LocalFS の upload / download / delete API と task attachment QA。契約終了 backup ZIP では取得可否を manifest に出す | 一括 import は未確認 | 個別添付の保存・取得・削除は検証済み | `docs/10-improvement-plan/checklist.md` の GAP-024 解消、`docs/10-improvement-plan/worklog/2026-06-12-ws3-stub-verification.md` | 外部ストレージ添付の完全取得保証、添付実体の一括 import は未対応 | 「取得可能な添付ファイル」は条件付き。外部システム管理ファイルや取得不能ファイルは例外表示が必要 |
| 組織基本データ | ZIP: `GET /api/export/organization-data`。CSV 群と `metadata.json` | ZIP: `POST /api/import/organization-data` | scope / departments / roles / assignments / users / controls / information_assets の ZIP export/import は実装済み | `scripts/compare-tenant-export.js`, `npm run qa:tenant-provision:diff` | 主要業務データ全部の完全 backup ではない。ユーザー import は invitation 作成を含み、users.csv の department / title は現状 round-trip 外 | 「組織初期設定・情報資産などのバックアップ ZIP」は可。「全業務データの完全復元 ZIP」は不可 |
| 契約終了バックアップ | ZIP: `GET /api/export/backup`。主要 CSV、`metadata.json`、`backup_files_manifest.csv`、取得済み `files/` | Import 対象ではない | 文書、文書版、承認、リスク、タスク、情報資産、教育、監査、是正、フォローアップ、マネジメントレビューの CSV と取得可能ファイル同梱は実装済み | `tests/e2e/backup-export.spec.ts`, `docs/10-improvement-plan/commercial-offboarding-sla-design.md` | 完全復元 API ではない。未取得/外部管理ファイルは manifest の status / reason / responsibility_boundary で説明 | 「主要業務データを持ち出せる」は可。「全データを自動復元できる」は不可 |
| 審査準備パッケージ | ZIP / PDF / JSON: `GET /api/examination/submission-bundle?format=zip\|pdf\|json` | Import 対象ではない | manifest JSON、summary CSV、items CSV、gaps CSV、summary PDF を ZIP 化 | `npm run qa:surveillance-submission-bundle`, `tests/e2e/*submission-bundle*` | 契約終了バックアップではない。審査通過・受理保証ではない | 「審査準備支援として出力できる」は可。「公式提出物として必ず受理」は不可 |

## Source Inventory

| 種別 | Path / Command | 役割 |
| --- | --- | --- |
| API | `app/api/documents/[id]/export/route.ts` | 文書 PDF / Docx / Excel 互換 export |
| API | `app/api/information-assets/export/route.ts`, `app/api/information-assets/import/route.ts` | 情報資産 CSV export / import |
| API | `app/api/risks/export/route.ts`, `app/api/risks/import/route.ts` | リスク Excel/PDF export、CSV import |
| API | `app/api/tasks/export/route.ts`, `app/api/tasks/import/route.ts` | タスク CSV export / import |
| API | `app/api/education/export/route.ts` | 教育計画 CSV export |
| API | `app/api/audit/reports/[reportId]/export/route.ts`, `app/api/audit-units/import/route.ts` | 監査報告 PDF export、監査単位 CSV import |
| API | `app/api/management-reviews/export/route.ts` | マネジメントレビュー JSON export |
| API | `app/api/export/backup/route.ts` | 契約終了バックアップ ZIP |
| API | `app/api/export/organization-data/route.ts`, `app/api/import/organization-data/route.ts` | 組織データ ZIP export / import |
| API | `app/api/examination/submission-bundle/route.ts` | 審査準備 ZIP / PDF / JSON |
| Docs | `docs/06-operations/document-export.md`, `docs/06-operations/assets.md`, `docs/06-operations/information-asset-import.md`, `docs/06-operations/billing-and-data-operations.md` | 運用手順と公開説明の根拠 |
| QA | `npm run qa:documents`, `npm run qa:assets:csv`, `npm run qa:risks:export`, `npm run qa:tasks`, `npm run qa:surveillance-submission-bundle` | 代表確認コマンド |
| QA | `scripts/compare-tenant-export.js` | 組織 ZIP / fixture 差分確認 |

## Public Copy Guidance

- 「主要データを CSV / Excel で扱える形式 / Word で扱える形式 / ZIP として取り出せることを目指す」は、現状の実装差を補足したうえで使用する。
- 「すべての Excel / Word 独自フォーマットを無変換で取り込める」「全データを完全復元できる」「契約終了時に添付を必ず全取得できる」は現時点で避ける。
- 公開 FAQ では、強い約束をする場合でも「現在の対象」「例外」「今後広げる変換ルール」を同じ段落に入れる。
- 契約終了時の説明は、`docs/06-operations/billing-and-data-operations.md` と `docs/10-improvement-plan/commercial-offboarding-sla-design.md` の「30日保持」「早期削除受付」「実削除ジョブ未接続」を踏まえる。

## Recommended QA Additions

| 優先度 | 追加したい検証 | 理由 |
| --- | --- | --- |
| P0 | 文書 Docx / `.xls` の実ファイル検査を `qa:documents` の成果物に固定保存する | Word / Excel export の公開説明を実ファイルで支える |
| P0 | 組織 ZIP の内容一覧と不足対象を snapshot 化する QA | ZIP が「完全バックアップ」ではない境界を証跡化する |
| P1 | リスク CSV import と Excel/PDF export の round-trip 近似 QA | Excel から移行できる説明の精度を上げる |
| P1 | タスク CSV import/export の round-trip QA | タスク移行と契約終了 export の説明を支える |
| P1 | 教育 / 是正 / マネジメントレビューの export 形式を統一する設計 issue | 現状は CSV / JSON / package summary が混在している |
| P2 | 情報資産 replace mode と organization-data users.csv round-trip の実装差分 QA | docs 上の運用説明と実際の import 対象を揃える |
| P2 | 添付ファイルを含む backup manifest QA | 「取得可能な添付ファイル」の境界説明を強化する |

## Current U-24 / PRFAQ-BL-25 Status

U-24 / PRFAQ-BL-25 は、この matrix により「公開約束範囲の棚卸し」は着手済みです。ただし、実ファイル QA の追加、組織 ZIP の不足対象 snapshot、教育 / 是正 / マネジメントレビュー / 添付の統一 import/export 設計は残っています。
