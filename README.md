# Riscala AI for ISMS

AI駆動開発でつくる、ISMS構築・運用支援プラットフォーム。

Riscala AI for ISMS is an ISMS operations platform built through AI-driven development. It supports ISO/IEC 27001 preparation and ongoing ISMS operations, including documents, information assets, risks, controls, audits, corrective actions, management reviews, and evidence exports.

名称に含まれる “AI” は、主に開発手法としてのAI駆動開発を指します。プロダクト内のAI支援機能は、プライバシー、ログ、人的レビュー方針を整理したうえで扱う将来機能です。

## 現在の標準構成

- Frontend / App: Next.js App Router
- DB: Drizzle ORM + libSQL
- ローカルDB: SQLite file database (`file:local.db`)
- クラウドDB: Turso (`libsql://...`)
- Auth: Better Auth
- Storage: ローカルファイルシステム (`.storage/`)

以前の Supabase/Postgres 前提は廃止済みです。履歴はGitに残るため、現行の開発・検証では Supabase CLI、Supabase migrations、Service Role Key を前提にしません。

## ローカル開発

```bash
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

アプリは `http://localhost:3007` で起動します。

`.env.example` の既定値では、DB はリポジトリ直下の `local.db` を使います。

```env
DATABASE_MODE=sqlite
TURSO_DATABASE_URL=file:local.db
```

Turso Cloud を使う場合は次を設定します。

```env
DATABASE_MODE=turso
TURSO_DATABASE_URL=libsql://xxx.turso.io
TURSO_AUTH_TOKEN=...
```

## よく使うコマンド

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run lint:messages
npm run db:seed
npm run seed:practical-verification -- --reset
```

`npm run db:seed` は `scripts/seed-sqlite.mjs` を実行し、ローカルでは `local.db`、Turso設定時はTursoにデモデータを投入します。

## ローカルDBの実体

ローカル検証中に使われるDBは SQLite ファイルです。

- `local.db`
- `local.db-shm`
- `local.db-wal`

`lib/db/drizzle/client.ts` が `TURSO_DATABASE_URL` を見て接続先を決めます。未設定なら `SQLITE_DB_PATH` または `local.db` にフォールバックします。

## プロジェクト構造

```text
app/                 Next.js App Router
components/          UIコンポーネント
lib/                 サービス、DB、認証、共通ユーティリティ
lib/db/drizzle/      Drizzle schema と libSQL client
drizzle/             Drizzle migrations
messages/            翻訳辞書
scripts/             seed / QA / 運用補助スクリプト
docs/                仕様、QA、運用ドキュメント
tests/               unit / e2e tests
```

## ドキュメント

- `docs/01-business/public-product-overview-ja.md`: 日本語の公開向けプロダクト概要と機能一覧
- `docs/01-business/pr-faq-workshop/pr-faq-public.md`: Build in Public 向けの公開PR/FAQ
- `docs/01-business/spec-dsl/`: 現行業務仕様の参照パッケージ
- `docs/02-project/12_uc-checklist.md`: ユースケース進捗
- `docs/02-project/release-readiness/practical-verification-plan.md`: 実務検証計画
- `docs/05-quality/qa-guidelines.md`: QAガイドライン
- `docs/06-operations/development-environment-guide.md`: 開発環境ガイド
- `docs/handoff/`: セッション引き継ぎ

古いドキュメントや過去のhandoffには Supabase 時代の記述が残る場合があります。現行実装の正本は、`lib/db/drizzle/`、`drizzle/`、`.env.example`、この README を優先してください。

## ライセンス

このプロジェクトはプロプライエタリソフトウェアです。
