# Document export procedures

このセクションでは、Org Admin / Approver が文書をエクスポートしたときの出力形式・メタデータ・監査ログの取り扱いをまとめます。

## 出力形式
| フォーマット | 拡張子 | MIME | 備考 |
| --- | --- | --- | --- |
| PDF | `.pdf` | `application/pdf` | 文書本文・メタデータ・承認/版履歴をHTMLテンプレートで組版し、PuppeteerでA4 PDFとして出力する。
| Word (Docx) | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | OpenXML ZIP。先頭は `PK` で始まり、本文、見出し、固定幅表、実リスト、ヘッダー/フッターを含む。
| Excel (XML) | `.xls` | `application/vnd.ms-excel` | Microsoft の SpreadsheetML 形式。本文とメタデータを行として確認できる。

エクスポートしたファイルには以下のメタデータと文書本文が含まれます。

```
Organization: {組織名}
Document Version: v{最新バージョン番号}
Exported At: {ISO 8601 形式の出力日時}
```

このメタデータによって、ダウンロードしたファイルから作成依頼元・バージョン・出力時刻をすぐに把握できます。文書に `file_path` があり、Markdownまたはテキストとして読める場合は、その実体本文をPDF/Docx/Excelへ反映します。本文を読めないファイル形式、または実体が存在しない場合は、文書のタイトル、説明、承認フロー、版履歴を使った参照用サマリーにフォールバックします。

PDF形式は外部フォントCDNに依存せず、ローカルの日本語フォントスタック (`Hiragino Sans` / `Yu Gothic` / `Noto Sans JP` など) で描画します。旧実装の `/HeiseiKakuGo-W5` CIDフォント指定は、Acrobat系ビューアでBBox警告が出るためユーザー向けPDFから外しています。

実行環境に利用可能なChromiumがない場合や、Chromiumの起動・権限・タイムアウトなどで準備できない場合、PDFエクスポートAPIは壊れたPDFや500を返さず、`PDF_EXPORT_UNAVAILABLE` を伴う503を返します。一時ディレクトリは成否にかかわらず削除します。文書画面はこのコードを各言語の案内へ変換し、Word形式の利用を促します。ローカルやChromiumを明示した環境ではPDF生成を継続し、デモ環境ではWordエクスポートを業務サンプルの標準代替とします。

PDF生成はユーザー単位で1分5回、サーバープロセス単位で同時1件に制限します。本文は最大1MBまで組版し、超過時は本文を読み込まずメタデータ中心の参照用サマリーへフォールバックします。全API共通のIPレート制限も併用します。

Docx 形式は ZIP コンテナなので先頭 2 バイトが `PK` になります。展開すると `word/document.xml` にタイトル、組織名、日本語本文、承認/版履歴が `<w:t>` テキストとして現れます。`word/styles.xml` には標準ビジネス文書向けの段落スタイル、`word/numbering.xml` には箇条書き/番号付きリスト定義、`word/header1.xml` / `word/footer1.xml` には文書名とページ番号が入ります。Excel (SpreadsheetML) は生の XML ファイルなので、先頭数行を開くだけで `Organization:` や本文行を確認できます。

開発用 practical verification seed では、代表文書のMarkdown実体を `.storage/documents/{organizationId}/documents/{documentId}/{documentId}.md` に作成し、`documents` と `document_versions` の `file_name` / `file_path` / `file_size` / `mime_type` を同じ実体へ揃えます。これにより、文書一覧の「ファイルをダウンロード」、版履歴のダウンロード、PDF/Word/Excelエクスポートが同じ文書内容を参照します。

## 監査ログ
`/api/documents/[id]/export` は service-role guard を通して成功・拒否を監査ログへ記録します。主な確認項目は次のとおりです。

- `user_id` / `organization_id` / `document_id`
- `format`: `pdf` / `word` / `excel`
- `status`: `success` / `denied`
- `context`: JSON (例: `{"version":1,"exportedAt":"2025-11-14T12:30:00Z"}`)
- `created_at`

SQL 例: `select * from audit_logs where resource_type = 'document' and resource_id = '...';`

## QA / 問題発見時の確認手順
事前に `PLAYWRIGHT_SKIP_WEB_SERVER=1 QA_LOCALE=en npm run qa:documents`（英語）と `QA_LOCALE=ja npm run qa:documents` もしくは `npm run qa:documents -- --locales ja,en`（日本語）を実行し、`test-results/qa-documents-<locale>-<timestamp>.log` を取得して UI の翻訳と HTTP ステータスが両ロケールで正常であることを確認しておく。
1. `/ja/documents` で文書を選び、PDF / Docx / Excel を順番に `format` クエリでリクエスト (`/api/documents/{id}/export?format=word` など)。
2. Docx を ZIP 展開して `word/document.xml`、Excel (`.xls`) をテキストで開き、`Organization:`/`Document Version:`/`Exported At:` と日本語本文の代表マーカーが含まれていることを確認。Docx なら `PK` で始まること、`word/numbering.xml`、`word/header1.xml`、`word/footer1.xml` があること、Excel なら `<Row>` にヘッダー行と本文行があることも合わせてチェックする。
3. PDFは、Chromiumを利用できる環境では `application/pdf`、`%PDF-` ヘッダー、十分なバイト数を確認する。可能であればローカルのPDFビューアまたは `pdftotext` / `pdfinfo` で日本語タイトルと本文が読めることを確認する。Acrobatで `HeiseiKakuGo-W5` / `Bbox` 警告が出ないことも確認する。Chromiumを利用できないデモ環境では503、`PDF_EXPORT_UNAVAILABLE`、Word利用案内を確認し、500や `.pdf` 名のJSONファイルにならないことを確認する。
4. libSQL/Turso DB の監査ログを確認し、成功・拒否が現行の service-role guard のログ先に記録されることを確認する。`scripts/qa-documents*.js` のログと `test-results/document-export-*.json` を照合して `user_id`/`document_id` が一致しているかも見る。
5. 複数組織間でアクセスを試み、権限がない組織からのリクエストが 403 になることを検証。QA の `test-results/document-export-*.json` には 403 の記録とファイル名も保存する。

## 証跡保存
- `test-results/document-export-*.json` には `npm run qa:documents` / `npm run qa:documents:approver` で取得した監査ログのクエリ結果、ダウンロードファイル名、403/denied ケースのステータスを JSON で保存します。
- 現行の代表QAは `docs/05-quality/qa-guidelines.md` と `docs/10-improvement-plan/owner-verification-guide.md` を優先します。古い Supabase 前提のUC別QA手順は現行構成では使いません。
