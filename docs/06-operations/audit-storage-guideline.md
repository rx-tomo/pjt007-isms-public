---
title: Audit and Local Storage Guideline
category: operations
last_updated: 2026-07-17
status: active
---

# Audit and Local Storage Guideline

Current local storage uses the filesystem under `.storage/`. Current DB access uses Drizzle + libSQL/Turso. Do not use Supabase storage commands for current verification.

## Local Paths

- DB: `local.db`, `local.db-shm`, `local.db-wal`
- Storage: `.storage/`
- Test results: `test-results/`

These are local artifacts and must not be committed.

## Verification

```bash
npm run db:seed
npm run qa:suite:initial
npm run qa:suite:surveillance
```

For attachment behavior, use the practical QA suites or targeted Playwright specs that exercise upload/download/delete paths.

## Cleanup

When local artifacts are stale:

実行前にアプリ、開発サーバー、DBクライアントを停止し、現在地が対象リポジトリで、`local.db`を破棄してよいことを確認してください。

```bash
rm -f local.db local.db-shm local.db-wal local.db-journal
node scripts/provision-local-database.mjs --root "$(pwd -P)" --name local.db
npm run db:seed
```

このコマンドは、開始時に存在しないlocal SQLite DB専用です。remote/Turso、既存DBの更新・migrationには使用できません。Use destructive cleanup only in local development.
