---
title: Storage Capacity Checklist
category: operations
last_updated: 2026-06-18
status: active
---

# Storage Capacity Checklist

Current local storage is filesystem-based. Turso/libSQL stores metadata; `.storage/` stores local file bodies in development.

## Local Check

```bash
du -sh .storage 2>/dev/null || true
ls -lah .storage 2>/dev/null || true
```

Also check generated artifacts:

```bash
du -sh test-results .next 2>/dev/null || true
```

## Repo Hygiene

Do not commit:

- `.storage/`
- `local.db`
- `local.db-shm`
- `local.db-wal`
- `test-results/`
- generated evidence snapshots

## Cloud Checklist

Before production or preview data retention claims:

- confirm Turso database size and backup policy
- confirm file storage provider and retention policy
- confirm export ZIP size limits
- confirm deletion evidence location
