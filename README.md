# Riscala AI for ISMS

AI駆動開発でつくる、ISMS構築・運用支援プラットフォーム。

Riscala AI for ISMS is a source-available ISMS operations platform built through AI-driven development. It supports ISO/IEC 27001 preparation and ongoing ISMS operations, including documents, information assets, risks, controls, audits, corrective actions, management reviews, and evidence exports.

It connects documents, information assets, risks, controls, control applicability decisions, internal audits, corrective actions, management reviews, tasks, notifications, and audit preparation outputs in one application flow.

## 日本語で読む

- [Riscala AI for ISMS 公開版の概要](docs/01-business/public-product-overview-ja.md)
- [公開向け PR/FAQ](docs/01-business/pr-faq-workshop/pr-faq-public.md)

## Why This Is Public

This repository is a Build in Public snapshot. It is not a commercial SaaS launch, production service, or certification guarantee.

The goal is to make the current state of the product visible so that ISMS practitioners, SaaS builders, potential collaborators, and people interested in AI-driven development can review the direction, run the app locally, and give feedback.

## 100% AI-Driven Development

Riscala AI for ISMS is also an experiment in AI-driven product development. The owner defines the product direction, requirements, priorities, and review decisions, while implementation, fixes, documentation, and verification are carried out through collaboration with AI agents.

The owner has not directly written application code line by line. This repository is intended to show both the product hypothesis and the development style: what AI agents can build, where human judgment remains essential, and how quality and business decisions can be separated.

The “AI” in the name refers primarily to the development approach: this product is built through AI-driven development. In-product AI assistance is treated as a separate future capability and requires additional privacy, logging, and human-review design.

## Current Snapshot

The current implementation assumes a SaaS-style model with service operators, tenant administrators, and tenant users. It also includes plan/subscription concepts and Stripe integration points, including mock-mode flows for local evaluation.

Areas you can inspect include:

- initial ISMS registration preparation flows
- ongoing annual ISMS operation flows
- document, information asset, risk, task, education, audit, corrective action, and management review modules
- control applicability decisions with versioning, change reasons, review, approval, and reissue flows
- audit preparation package output concepts
- export/import and organization backup direction for avoiding SaaS lock-in
- local SQLite/libSQL development setup and Turso-compatible database access

Still-open commercial/product areas include pricing, formal contracts, SLA/RTO/RPO, production support, production security review, real customer migration, contribution acceptance rules, and whether to package a simpler single-user variant.

## License

This project is source-available, not open source.

You may view, evaluate, test, and use the code for non-commercial assessment. Commercial use, redistribution, managed hosting, SaaS use, resale, or derivative product use requires prior written permission. See [LICENSE](LICENSE).

## Try Locally

Requirements:

- Node.js 20 or later
- npm

Setup:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3007`.

The default local setup uses SQLite/libSQL-compatible local storage and mock modes for Stripe, email, and AI integrations. Real external service keys are optional and must be supplied through your own `.env.local`.

## Useful Checks

```bash
npm run lint
npm run typecheck
npm run lint:messages
npm run qa:public-copy
npm run build
```

## Feedback and Collaboration

Feedback is welcome from people who understand ISMS practice, business SaaS design, AI-driven development, or possible collaboration models.

Please use issues for product feedback and questions. Security reports should not be opened as public issues; see [SECURITY.md](SECURITY.md). Code contributions may be reviewed case by case, but this repository is not operated as an open source project. See [CONTRIBUTING.md](CONTRIBUTING.md).

Commercial licensing, hosted use, redistribution, individual implementation support, or partnership inquiries require prior permission from the repository owner.

## Public Boundary

This repository is an allowlisted public snapshot. It does not include the private development history.

Included:

- application source code needed to inspect and run the product locally
- database schema and migration examples
- internationalized messages
- public-facing setup, quality, operations, and design documentation
- minimal CI for lint, typecheck, translation validation, public-copy checks, and build

Excluded:

- private Git history
- non-public working notes, operational records, and historical evidence
- development logs and issue export files
- AI/agent operating instructions
- local MCP configuration
- local databases, build artifacts, generated QA artifacts, secrets, and tokens
