---
title: Super Admin Runbook
category: operations
last_updated: 2026-06-18
status: active
---

# Super Admin Runbook

このRunbookは現行の Drizzle/libSQL + Better Auth 実装用です。Supabase Edge Function を起動する旧手順は現行運用では使いません。

## Local Setup

```bash
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3007/ja/dev-login
```

Select a Super Admin user and confirm:

- `/ja/super-admin/organizations` opens.
- Tenant list can be viewed.
- Lock / restore / delete actions show the expected UI state.
- Audit logs can be viewed from `/ja/super-admin/logs`.

## Practical Verification Seed

For current practical verification, prefer:

```bash
npm run seed:practical-verification -- --reset --scenario all
npm run qa:practical-seed
```

Then use Dev Login to select the relevant tenant/user.

## QA Commands

```bash
npm run qa:suite:initial
npm run qa:suite:surveillance
npm run typecheck
npm run lint
```

## Notes

- Super Admin is platform-level and may not belong to a tenant.
- System Operator can be used to compare practical verification tenants.
- Do not use Supabase CLI or Supabase Service Role Key for current local verification.
