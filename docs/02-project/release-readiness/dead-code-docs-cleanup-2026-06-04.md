---
title: Dead Code and Docs Cleanup 2026-06-04
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 20:21:43 JST
author: Codex
status: active
---

# Dead Code and Docs Cleanup 2026-06-04

## Purpose

長期開発で残った古いdocs、散在handoff、子スレッドworktree、デッドコード候補を整理し、ISMS実務検証の開発再開時に迷わない状態へ寄せる。

## Completed

| Area | Result |
| --- | --- |
| 子worktree整理 | `.codex/worktrees/*/pjt007` の子worktreeを棚卸しし、親mainへ未回収の価値ある差分がないことを確認後に削除した |
| docs/02-project整理 | 2025年の `90_*` / `91_*` ログ18件を `docs/02-project/archive/` へ移動した |
| docs参照更新 | 移動したprojectログへの参照を `docs/02-project/archive/...` へ更新した |
| handoff散在整理 | `docs/` 直下の2025-10 handoff 6件を `docs/handoff/archive/` へ移動した |
| handoff索引 | `docs/handoff/README.md` を追加し、直下とarchiveの使い分けを明記した |
| OS生成物 | docs配下の `.DS_Store` を削除した |

## Archived Project Logs

- `90_2025-06-09_dashboard-status.md`
- `90_2025-11-07_rbac-ui-review.md`
- `90_2025-11-08_risk-task-audit-review.md`
- `90_2025-11-10_progress.md`
- `90_2025-11-14_progress.md`
- `90_2025-11-18_assets-csv-roundtrip.md`
- `90_2025-11-18_controls-annex-wizard.md`
- `90_2025-11-18_initial-roles-wizard.md`
- `90_2025-11-18_org-settings-ux-regressions.md`
- `90_2025-11-18_phase4-ears.md`
- `90_2025-11-18_profile-name-persistence.md`
- `90_2025-11-18_risk-matrix-drilldown.md`
- `90_2025-11-18_settings-toast-unification.md`
- `90_2025-11-19_progress.md`
- `90_2025-11-20_codebase-review.md`
- `90_2025-11-27_progress.md`
- `90_2025-12-01_department-scope-implementation-plan.md`
- `91_2025-11-20_auth-role-review.md`

## Dead Code Candidates

| Candidate | Current Finding | Recommended Next Action | Priority |
| --- | --- | --- | --- |
| `mock:activities` QA path | `scripts/qa-home-activity-feed.js` calls `npm run mock:activities`, but `package.json` has no `mock:activities` script. 2026-06-05 child thread N confirmed the old seed script was removed as Supabase-dependent and the current runner/test contract is also stale. | Prefer archive/non-active classification rather than restoration now. Restoring would require a new Drizzle/SQLite seed, env/skip contract fixes, and `recent-activity-feed` testid alignment, so it should not block current W-02/W-03 practical verification. | P1 |
| `components/super-admin/SuperAdminHealthPanel.tsx` | Marked deprecated because the Edge Function health endpoint has been removed. | Confirm whether any route still imports it. If unused, remove component and docs references. | P2 |
| `app/api/auth/mfa/send` and `app/api/auth/mfa/verify` | Endpoints are explicitly deprecated and direct callers should use Better Auth TOTP endpoints. | Search runtime callers and decide whether to keep compatibility endpoints or remove after docs update. | P2 |
| `notificationChannels` deprecated client params | Several service methods retain ignored/deprecated client params. | Clean signatures after current browser API boundary work stabilizes. | P3 |

## Deferred

- Broad TypeScript dead-code removal was not executed in this pass. The current repository has many active QA/docs changes, so deletion should be done in a focused goal with typecheck and targeted QA.
- `issues_output.json` still contains historical references to archived docs. It is likely generated/backlog data, so links were updated but the file itself was not archived or regenerated.

## Verification

- `git worktree list --porcelain` shows only the main worktree.
- Moved docs no longer remain under `docs/02-project` root as 2025 `90_*` / `91_*` files.
- `docs/` root no longer contains `handoff-*.yaml`.
- `git diff --check` passed after reference cleanup.
