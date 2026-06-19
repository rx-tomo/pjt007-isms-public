---
title: W-01 to W-06 Journey Verification Report
category: project
created: 2026-05-15
last_updated: 2026-05-15
author: Codex
status: implementation_gap_runtime_instability
---

# W-01 to W-06 Journey Verification Report

## Scope

Parent Objective:

- ISMS Pilotを公開可能95%完成度へ近づける。

Target CAP/Gate:

- W-01〜W-06 representative journey verification
- `core_journeys_work`
- supporting evidence for `no_critical_authz_gap`

Non-Goals:

- 新規UI/API/DB実装
- P2/P3 polish
- unit runner一時除外test復帰
- 事業判断、secret値取得/記録

## Commands

```bash
npm run lint:messages
```

Result:

- Passed after adding the missing `settings.organization.phase.options.implementation` labels to `messages/ja.json` and `messages/en.json`.
- Translation key count: ja 3474 / en 3474.

```bash
curl -sS -i -X POST http://127.0.0.1:3007/api/dev/login \
  -H 'content-type: application/json' \
  --data '{"role":"system_operator"}'
curl -sS -I http://127.0.0.1:3007/ja
```

Result:

- `/api/dev/login`: HTTP 200 for `system_operator`.
- `/ja`: HTTP 200.

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3007 \
  npx playwright test tests/e2e/journeys/system-operator-journeys.spec.ts \
  --project=chromium --grep "SO-01" --reporter=line
```

Result:

- Failed, but progressed beyond role setup and `/ja/settings/organization` initial rendering.
- Current blocker: `window-toast` was not visible after organization settings save.

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3007 \
  npx playwright test tests/e2e/journeys/org-admin-journeys.spec.ts \
  --project=chromium --grep "OA-01" --reporter=line
```

Result:

- Failed, but progressed beyond role setup, `/ja/settings/users` initial rendering, and invite operation in an isolated run.
- Current blocker: invite success message was not visible.

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3007 \
npx playwright test tests/e2e/journeys --project=chromium --reporter=line
```

Result:

- 52 failed / 3 passed / 2 skipped / 57 total
- Exit code: 1
- Representative evidence:
  - `test-results/journeys-document-revision-fb4e2-文書改訂ジャーニー-DRJ-01-文書の新規作成と公開-chromium/trace.zip`
  - `test-results/journeys-system-operator-j-1f235-ーニーテスト-SO-04-ユーザー招待から登録完了まで-chromium/trace.zip`
  - `test-results/journeys-super-admin-journ-5c44c-urneys-SA-10-複数テナントのロック状態管理-chromium/trace.zip`

## Finding

2026-05-15の再検証で、元の `Unexpected non-whitespace character after JSON at position 746` はsuite-wide blockerではなくなった。
`/api/dev/login` と `/ja` はHTTP 200になり、W-01/W-02代表はrole setupと初期route renderingを越えた。

ただし、full suiteはまだ業務成立していない。最新runは52 failed / 3 passed / 2 skippedで、途中からdev serverが終了し、後半には `ERR_CONNECTION_REFUSED` も混入した。

Verified recovery:

- `BETTER_AUTH_URL=http://127.0.0.1:3007 NEXT_PUBLIC_APP_URL=http://127.0.0.1:3007 E2E_MODE=1 npm run dev -- --hostname 127.0.0.1 --port 3007`: started.
- `GET /ja`: 200.
- `POST /api/dev/login` with representative roles: 200.
- `GET /api/auth/get-session` with dev-login cookie: 200.
- `HEAD /ja/settings/organization`: 200.
- `HEAD /ja/super-admin/organizations`: 200.
- `SO-01` progressed past dev login and `/ja/settings/organization` rendering; failed later on missing `window-toast`.
- `OA-01` progressed past dev login and `/ja/settings/users` rendering in isolated run; failed later on missing invite success message.
- Full Chromium journey suite rerun: 52 failed / 3 passed / 2 skipped. No longer 57/57 shared dev-login JSON failure.

Observed remaining gap categories:

- Super Admin journey tests expect `/functions/v1/tenant-admin`, while current implementation uses `/api/super-admin/organizations`; several tests also fail on expected heading text `テナントと監査のオペレーション`.
- Risk journeys fail because `risk-category-select` has no non-empty options.
- Task journeys fail because assignee options are not loaded.
- User lifecycle and invite flows fail because invitation tokens or `organizationId` cannot be retrieved.
- System Operator organization/assets flows reach pages but fail on missing toast, missing sections, or asset save/load errors.
- Browser logs still show client/server boundary errors such as `fs.existsSync is not a function` from browser-side imports of server DB code.
- The missing `settings.organization.phase.options.implementation.label` key was fixed; older server logs may still contain stale occurrences from before hot reload.
- Full suite runtime stability is insufficient; the dev server exited before all tests completed.

Classification:

- `implementation_gap_runtime_instability`
- Gate impact: `core_journeys_work` is `fail`.
- Authz gate impact: `no_critical_authz_gap` remains `unknown` because BCJ permission/session boundary cases failed and need targeted review.
- Business impact: ログイン前提は復旧したが、主要業務ジャーニーは3/57のみpassで、公開95%の業務成立証跡として不足している。

## Workflow Status

| Workflow | Status After Run | Reason |
| --- | --- | --- |
| W-01 SaaS運営者の顧客設定 | implementation_gap + runtime_instability | super_adminページは描画するが、テスト期待のheading/API契約と現実装が不一致。suite後半ではserver停止も混入。 |
| W-02 顧客テナントのISMS初期導入 | implementation_gap | system_operator/org settingsは描画するが、toast、client/server境界、組織設定保存の証跡が不足。 |
| W-03 日常・月次のISMS運用 | implementation_gap | 文書、承認、通知、タスク、ユーザー招待でデータ/表示/トークン取得の失敗が残る。 |
| W-04 内部監査と是正 | implementation_gap | 監査計画/報告/是正の入口までは到達するが、期待導線や必要データが揃わない。 |
| W-05 経営レビュー・継続的改善 | evidence_gap | 一部資産はあるが、今回のjourney suiteでは経営レビュー/改善の一気通貫証跡は不足。 |
| W-06 契約終了・データ保持・サポート調査 | owner_decision_needed + evidence_gap | 技術的検証以前にCAP-22/30/32の責任境界判断が必要。 |

## Next Remediation Goal

```text
/goal Parent Objective: ISMS Pilotを公開可能95%完成度へ近づける。

Target CAP/Gate:
- W-01〜W-06 representative journey verification
- CAP-24 quality baseline
- no_critical_authz_gap
- core_journeys_work

Source of Truth:
- docs/01-business/spec-dsl/evidence-map.md
- docs/01-business/pr-faq-workshop/unknowns.md
- docs/02-project/release-readiness/journey-verification-report.md
- tests/e2e/journeys/
- Playwright trace/error-context under test-results/

Current Gap:
- Shared runtime JSON.parse failure is no longer the primary blocker.
- `npx playwright test tests/e2e/journeys --project=chromium --reporter=line` now reaches business flows and reports 52 failed / 3 passed / 2 skipped.
- W-01/W-02 representative tests pass role setup and initial route rendering, then fail on individual business/test-contract gaps.
- The full suite still has runtime instability: dev server exits mid-run, causing `ERR_CONNECTION_REFUSED` on later tests.

Scope:
- Fix the highest-impact client/server boundary that blocks many W-01〜W-06 tests: browser pages importing services that reach SQLite/`fs`.
- Prioritize surfaces used by W-01/W-02/W-03: settings/users, settings/organization, documents/new, documents list, home/dashboard, risks/new.
- Re-run the affected representative journeys and then the full suite if stable.
- Update spec-dsl and release-readiness docs with verified results.

Orchestration Plan:
- Main agent: map client-side service imports to affected routes, implement API-backed or server-safe access for the narrow journey surfaces, and preserve the parent objective.
- QA pass: run targeted `/api/dev/login`/initial route checks, representative journey tests, then full `tests/e2e/journeys` Chromium run if stable.
- Product/readiness pass: classify W-01〜W-06 as ready/evidence_gap/implementation_gap/runtime_instability based on actual evidence.

Done When:
- Browser console no longer shows `fs.existsSync is not a function` on the prioritized representative surfaces.
- SO-01/OA-01 progress past the current blocker points or pass.
- Full suite no longer ends with dev server connection refusal.
- `core_journeys_work` evidence is updated in scoring-model/checksheet/evidence-map.

Non-Goals:
- New business features.
- Contract termination/data retention/legal guarantee decisions.
- Secret value disclosure or recording.
- Broad UX polish unrelated to the shared blocker.
```
