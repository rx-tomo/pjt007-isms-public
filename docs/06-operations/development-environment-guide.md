---
title: Development Environment Guide
category: operations
last_updated: 2026-06-18
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

```bash
rm -f local.db local.db-shm local.db-wal
npx drizzle-kit push
npm run db:seed
```

## Practical Verification Seed

For the current product verification work, prefer the practical seed:

```bash
npm run seed:practical-verification -- --reset --scenario all
npm run qa:practical-seed
```

This creates model tenants for initial certification preparation and annual ISMS operation.

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
