---
title: Session Expiry Testing
category: operations
last_updated: 2026-06-18
status: active
---

# Session Expiry Testing

Current auth is Better Auth. Historical Supabase cookie / middleware examples are archived and are not current.

## Local Baseline

```bash
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3007/ja/dev-login
```

Use Dev Login for local role/tenant checks.

## Automated Checks

```bash
npm run test:e2e:smoke
```

For broader regression:

```bash
npm run qa:suite:initial
npm run qa:suite:surveillance
```

## What To Confirm

- unauthenticated protected pages redirect to login
- invalid sessions do not expose tenant data
- role changes are reflected after re-login
- Super Admin and tenant-scoped users remain separated
- auth origin is correct in preview / production

Do not record session cookies or auth secrets in docs or logs.
