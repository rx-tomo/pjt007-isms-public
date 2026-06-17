---
title: Vercel / Turso Environment Setup
category: operations
last_updated: 2026-06-18
status: active
---

# Vercel / Turso Environment Setup

この文書は現行構成用の環境設定メモです。過去の Supabase / Service Role Key 前提の手順は `docs/archive/legacy-supabase-qa/` に退避済みです。

## Current Stack

- App: Next.js App Router
- DB: Drizzle ORM + libSQL
- Local DB: `file:local.db`
- Cloud DB: Turso
- Auth: Better Auth

## Required Environment Variables

| Variable | Environment | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | preview / production | `libsql://...` for Turso Cloud. Local default is `file:local.db`. |
| `TURSO_AUTH_TOKEN` | preview / production | Required for Turso Cloud. Do not commit. |
| `BETTER_AUTH_SECRET` | preview / production | Required. Build warns when default secret is used. |
| `BETTER_AUTH_URL` | preview / production | Public app origin, for example `https://example.com`. |
| `NEXT_PUBLIC_APP_URL` | preview / production | Public app URL used by links and callbacks. |

## Local Baseline

```bash
cp .env.example .env.local
npm install
npm run db:seed
npm run dev
```

Local DB uses:

```env
DATABASE_MODE=sqlite
TURSO_DATABASE_URL=file:local.db
```

## Verification

```bash
npm run typecheck
npm run lint
npm run lint:messages
npm run build
```

If `npm run build` prints a Better Auth default secret warning, set `BETTER_AUTH_SECRET` in the target environment. Do not record the secret value in docs; record only the environment name, whether it is configured, and the verification date.
