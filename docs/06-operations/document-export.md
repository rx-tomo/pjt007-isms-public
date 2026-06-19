# Document export procedures

このセクションでは、Org Admin / Approver が文書をエクスポートしたときの出力形式・メタデータ・監査ログの取り扱いをまとめます。

## 出力形式
| フォーマット | 拡張子 | MIME | 備考 |
| --- | --- | --- | --- |
| PDF | `.pdf` | `application/pdf` | フルテキストを PDF 形式で 1 ページずつ出力。
| Word (Docx) | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | OpenXML ZIP。先頭は `PK` で始まり、`word/document.xml` にメタデータ行を含む。
| Excel (XML) | `.xls` | `application/vnd.ms-excel` | Microsoft の SpreadsheetML 形式。各行が `Cell` になるため Excel でも開ける。

エクスポートしたファイルには先頭に以下のメタデータ行が含まれます。

```
Organization: {組織名}
Document Version: v{最新バージョン番号}
Exported At: {ISO 8601 形式の出力日時}
```

このヘッダーによって、ダウンロードしたファイルから作成依頼元・バージョン・出力時刻をすぐに把握できます。

Docx 形式は ZIP コンテナなので先頭 2 バイトが `PK` になります。展開すると `word/document.xml` に上記ヘッダーがそのまま `<w:t>` テキストとして現れます。Excel (SpreadsheetML) は生の XML ファイルなので、先頭数行を開くだけで `Organization:` などを確認できます。

## 監査ログと `export_events`
`/api/documents/[id]/export` は成功・拒否いずれの場合も `export_events` テーブルへ記録します。主なカラムは次のとおりです。

- `user_id` / `organization_id` / `document_id`
- `format`: `pdf` / `word` / `excel`
- `status`: `success` / `denied`
- `context`: JSON (例: `{"version":1,"exportedAt":"2025-11-14T12:30:00Z"}`)
- `created_at`

SQL 例: `select * from export_events where document_id = '...';`

## QA / 問題発見時の確認手順
事前に `PLAYWRIGHT_SKIP_WEB_SERVER=1 QA_LOCALE=en npm run qa:documents`（英語）と `QA_LOCALE=ja npm run qa:documents` もしくは `npm run qa:documents -- --locales ja,en`（日本語）を実行し、`test-results/qa-documents-<locale>-<timestamp>.log` を取得して UI の翻訳と HTTP ステータスが両ロケールで正常であることを確認しておく。
1. `/ja/documents` で文書を選び、PDF / Docx / Excel を順番に `format` クエリでリクエスト (`/api/documents/{id}/export?format=word` など)。
2. Docx を ZIP 展開して `word/document.xml`、Excel (`.xls`) をテキストで開き、先頭の `Organization:`/`Document Version:`/`Exported At:` ヘッダーがそのまま含まれていることを確認。Docx なら `PK` で始まること、Excel なら `<Row>` にヘッダー行があることも合わせてチェックする。
3. libSQL/Turso DB の `export_events` を確認し、`status='success'` で `context` に `version`/`exportedAt`/`organization` が入り、拒否ケースは `status='denied'` + `reason` が記録されることを確認。`scripts/qa-documents*.js` のログと `test-results/document-export-*.json` を照合して `user_id`/`document_id` が一致しているかも見る。
4. 複数組織間でアクセスを試み、権限がない組織からのリクエストが 403 になり、同時に `export_events` に `status='denied'` が追加されていることを検証。QA の `test-results/document-export-*.json` には 403 の記録とファイル名も保存する。

## 証跡保存
- `test-results/document-export-*.json` には `npm run qa:documents` / `npm run qa:documents:approver` で取得した `export_events` クエリ結果、ダウンロードファイル名、403/denied ケースのステータスを JSON で保存しています。
- 現行の代表QAは `docs/05-quality/qa-guidelines.md` と `docs/10-improvement-plan/owner-verification-guide.md` を優先します。古い Supabase 前提のUC別QA手順は現行構成では使いません。
