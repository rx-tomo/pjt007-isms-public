---
title: Billing and Data Operations
category: operations
last_updated: 2026-06-18
status: active
---

# Billing and Data Operations

This project currently has a billing design and partial Stripe integration for practical verification. It is not a commercial billing launch state, and public README / PR wording should not imply that real customer charging is enabled.

## Current Billing State

| Area | Current state | Public wording boundary |
| --- | --- | --- |
| Pricing plans | `/pricing` displays plan choices from `pricing_plans` when seeded, otherwise from `DEFAULT_PRICING_PLANS`. Env-based Stripe Price ID mapping exists for trial / starter / standard / enterprise. | Describe as plan configuration and pricing-screen design, not as confirmed commercial price policy. |
| Checkout | `/api/stripe/create-checkout-session` can create a real Stripe Checkout Session when a valid secret key and plan Price ID are configured. In mock mode or non-production without a secret key, it returns a `cs_test_mock_*` session ID. | Say local/source-available verification does not require production Stripe keys. |
| Mock checkout | `/mock/checkout` calls `/api/stripe/mock/complete`, which is disabled in production, requires a dev session today, and writes mock subscription/payment/event rows. Org-scope enforcement is still required before public/preview exposure. | Say this verifies the in-app billing journey only; it does not process money. |
| Subscription UI | `/settings/subscription` shows current plan, period, usage, cancellation state, export/offboarding controls, and a test-mode banner when Stripe is mocked or not configured. | Say subscription management UI is present, with production readiness still gated. |
| Customer portal | `/api/stripe/create-portal-session` returns `/mock/portal` in mock mode. With real Stripe configuration it creates a Stripe Billing Portal session for the latest customer. Current mock portal mutation endpoints are verification-only and need production-disable / mock-mode / org-scope gates before any public or commercial environment. | Say portal integration path exists, but commercial portal configuration and endpoint hardening must be verified before launch. |
| Webhooks | `/api/stripe/webhook` verifies Stripe signatures when keys/secrets are present and records idempotent event processing. Without Stripe config it accepts payloads as a skeleton fallback for local verification only. | Do not present webhook handling as production-certified until fail-closed behavior and Stripe event replay are completed. |

## Local Billing Mode

Use mock mode for local practical verification:

```env
STRIPE_TEST_MODE=mock
```

For the mock checkout completion path, configure non-secret test Price IDs or seed rows that provide `stripe_price_id` values. Placeholder values such as `...`, `xxx`, `your_`, or `sample` are ignored by the Stripe config helper.

```env
STRIPE_PRICE_TRIAL=price_test_trial_local
STRIPE_PRICE_STARTER=price_test_starter_local
STRIPE_PRICE_STANDARD=price_test_standard_local
STRIPE_PRICE_ENTERPRISE=price_test_enterprise_local
```

Then run:

```bash
npm run db:seed
npm run dev
```

Open `/ja/pricing`, select a plan, complete the mock checkout, and confirm that `/ja/settings/subscription` shows the subscription and test-mode notice. This validates the application journey without a production Stripe secret key or real payment.

## Commercial Billing Readiness Gates

Before real customer charging, complete and record at least the following:

- Confirm formal product pricing, tax handling, refund/cancellation rules, and customer-facing terms.
- Configure real Stripe products/prices, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and publishable key in the target environment; keep real keys out of the repository.
- Map every active plan to a real Stripe Price ID and verify checkout for trial, starter, standard, and enterprise paths as applicable.
- Configure and verify Stripe Billing Portal behavior for plan changes, cancellation, payment method updates, invoice access, and return URLs.
- Protect mock portal mutation endpoints before preview/public exposure: production 403, mock-mode gate, authenticated caller, and organization-scope authorization.
- Make webhook misconfiguration fail closed in production, avoid raw webhook payload logging, and verify invalid signatures return 400.
- Replay Stripe test-mode webhook events for checkout completion, subscription create/update/delete, invoice success/failure, duplicate delivery, missing secret, and invalid signature denial.
- Verify authorization boundaries for org admin / system operator only, including cross-tenant access denial for subscription, usage, checkout, and portal APIs.
- Verify checkout `successUrl` / `cancelUrl` and portal `returnUrl` against an application-origin allowlist.
- Use saved Stripe customer IDs from checkout/webhook sync for commercial portal access, or verify any email fallback against Stripe customer metadata for the same organization.
- Confirm payment history, subscription status, cancellation-at-period-end, usage display, and audit/service-role events after webhook sync.
- Prepare rollback / disablement steps, including how to turn off real checkout while preserving existing tenant access.

## Public README / PR Wording

Recommended wording for public-facing docs:

> Billing and plan management are implemented as a practical-verification flow with Stripe integration points and mock checkout/portal support. The public/source-available setup does not require production Stripe keys and does not enable commercial charging by default. Real customer billing requires separate Stripe product/price configuration, webhook verification, portal QA, terms/SLA confirmation, and launch approval.

Avoid wording such as "Stripe billing is live", "customers can already pay", or "production subscriptions are enabled" unless the commercial readiness gates above have been completed.

## Data Export / Offboarding

The current product direction is:

- export core business data as CSV / organization backup ZIP
- retain ended-contract data for 30 days
- allow early deletion request
- initial commercial recovery responsibility is best effort

The real deletion job is intentionally not wired as an automatic destructive operation in local practical verification. Validate UI/API evidence without deleting production data.
