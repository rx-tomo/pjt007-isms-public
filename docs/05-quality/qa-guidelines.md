---
title: Quality Assurance Guidelines
category: quality
last_updated: 2026-06-18
status: active
---

# Quality Assurance Guidelines

この文書は現行構成のQA入口です。過去の Supabase / Service Role Key 前提のUC別手順は、現行の作業正本ではありません。

## Current Stack

- Next.js App Router
- Drizzle ORM + libSQL/Turso
- Local DB: `file:local.db`
- Auth: Better Auth
- Local storage: `.storage/`

## Baseline Checks

```bash
npm run typecheck
npm run lint
npm run lint:messages
npm run build
```

## Local DB Seed

```bash
npm run db:seed
```

Practical verification:

```bash
npm run seed:practical-verification -- --reset --scenario all
npm run qa:practical-seed
```

## Practical QA Suites

```bash
npm run qa:suite:initial
npm run qa:suite:surveillance
```

These are the current primary suites for:

- initial certification preparation
- annual ISMS operation
- audit / CAPA / management review
- submission package output
- practical seed integrity

## Copy Boundary QA

Customer-facing copy must not mix internal development wording.

```bash
npm run qa:public-copy
npm run qa:submission-copy
```

## Public Snapshot QA

Before syncing to the public source-available repository, run the public snapshot checks from the public sync skill/runbook:

```bash
npm ci
npm run lint
npm run typecheck
npm run lint:messages
npm run qa:public-copy
npm run build
```

Also run a secret scan for obvious token/key patterns before pushing public code.

## Notes

- Do not use Supabase CLI for current local QA.
- Do not require Service Role Key for current local QA.
- If a legacy doc still mentions Supabase, treat it as historical unless it has been explicitly rewritten after 2026-06-18.
