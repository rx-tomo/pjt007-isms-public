---
title: Development Environment Guide
category: operations
last_updated: 2026-07-17
status: active
---

# Development Environment Guide

このガイドは現行の開発環境正本です。古い Supabase / Service Role Key / Supabase Edge Function 前提の手順は現行開発では使いません。

## Current Stack

- App: Next.js App Router
- Language: TypeScript / React
- DB: Drizzle ORM + libSQL
- Local DB: SQLite file database, `file:local.db`
- Cloud DB: Turso
- Auth: Better Auth
- Storage: local filesystem, `.storage/`
- i18n: ja / en / zh

## First Setup

```bash
npm install
cp .env.example .env.local
node scripts/provision-local-database.mjs --root "$(pwd -P)" --name local.db
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3007
```

The default local database is:

```env
DATABASE_MODE=sqlite
TURSO_DATABASE_URL=file:local.db
```

## Reset Local DB

Use this only for local development.

実行前にアプリ、開発サーバー、DBクライアントを停止し、現在地が対象リポジトリで、`local.db`を破棄してよいことを確認してください。

```bash
rm -f local.db local.db-shm local.db-wal local.db-journal
node scripts/provision-local-database.mjs --root "$(pwd -P)" --name local.db
npm run db:seed
```

このコマンドは、開始時に存在しないlocal SQLite DB専用です。remote/Turso、既存DBの更新・migrationには使用できません。

## Notification Receipt Backfill

通知の既読・アーカイブ状態は `notifications` の共有カラムから受信者ごとの
`notification_receipts` へ移りました。**この移行より前から存在するDB**は、
スキーマ反映（`drizzle-kit push`）だけでは receipt が空のままになり、
既読・アーカイブがUI上リセットされて未読カウントが復活します。

既存DBには一度だけ backfill を実行してください。新規に provision したDBには不要です。

```bash
npm run db:backfill:notification-receipts -- --database-url "file:$(pwd -P)/local.db"
```

既定は dry-run で、`pending`（移送対象の件数）だけを報告して1行も書きません。
内容を確認してから `--apply` を付けて実行します。

```bash
npm run db:backfill:notification-receipts -- --database-url "file:$(pwd -P)/local.db" --apply
```

契約:

- 対象DBは常に `--database-url` で明示する。既定DBへのフォールバックは持たない
- 再実行しても receipt は増えず、既存の receipt の状態を上書きしない
- broadcast 通知の共有 status を受信者へ推測配布しない（direct のみ移送する）
- 所属していない受信者を指す direct 通知があれば、書き込まずに exit 65 で停止する
- Turso Cloud は `--auth-token`（または `TURSO_AUTH_TOKEN`）を併用する

## Practical Verification Seed

The practical-verification seed is intentionally rejected when it targets the
repository `local.db` or `.storage`. Use an isolated QA entrypoint for residual
risk acceptance verification:

```bash
npm run qa:initial-w02-risk-residual-rejection
npm run qa:surveillance-residual-risk-acceptance
```

Each command provisions a fresh database and storage directory below the OS
temporary directory, loads all practical-verification model tenants, starts a
new managed server on loopback, and deletes the isolated directory after the
run. The runner records the repository `local.db` and sidecar hashes before and
after the run and fails if they change. Do not replace these commands with a
bare `npm run seed:practical-verification` against the repository database.

## Quality Commands

```bash
npm run typecheck
npm run lint
npm run lint:messages
npm run build
```

Representative practical QA:

```bash
npm run qa:suite:initial
npm run qa:suite:surveillance
```

Public/copy boundary QA:

```bash
npm run qa:public-copy
npm run qa:submission-copy
```

## Public Snapshot Work

The public repository is not a fork of this private development repository. It receives a clean source-available evaluation snapshot through the public sync workflow.

Before publishing a public snapshot:

```bash
npm ci
npm run lint
npm run typecheck
npm run lint:messages
npm run qa:public-copy
npm run build
```

Also run a secret scan before pushing public code.

## Environment Notes

- Do not commit `.env.local`.
- Do not commit `local.db`, `local.db-shm`, or `local.db-wal`.
- Do not commit `.storage/`.
- Do not record real secrets in docs.
- For preview / production, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` must be configured in the hosting environment.
