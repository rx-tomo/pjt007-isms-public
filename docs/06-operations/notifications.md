---
title: Notifications Operations
category: operations
last_updated: 2026-06-18
status: active
---

# Notifications Operations

Current notification behavior is implemented inside the Next.js app and local libSQL database. Historical Supabase Edge Function instructions are archived and are not current.

## Local Verification

```bash
npm run seed:practical-verification -- --reset --scenario all
npm run qa:practical-seed
```

Relevant practical QA:

```bash
npm run qa:suite:initial
npm run qa:suite:surveillance
```

These suites cover representative app notifications such as:

- task reminders
- mentions
- CAPA follow-up assignment
- CAPA due / overdue reminders
- education reminders

## Email Delivery

Development and public-evaluation snapshots may run without real email delivery. When `RESEND_API_KEY` is not configured, email delivery should be treated as skipped or stubbed depending on the route.

For production-like testing, configure:

```env
RESEND_API_KEY=...
INVITE_EMAIL_FROM="ISMS Pilot <no-reply@example.com>"
```

Do not commit real keys.
