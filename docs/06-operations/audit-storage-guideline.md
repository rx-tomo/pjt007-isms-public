---
title: Audit and Local Storage Guideline
category: operations
last_updated: 2026-06-18
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

```bash
rm -f local.db local.db-shm local.db-wal
npx drizzle-kit push
npm run db:seed
```

Use destructive cleanup only in local development. Do not run equivalent deletion against Turso Cloud without an explicit backup and owner approval.
