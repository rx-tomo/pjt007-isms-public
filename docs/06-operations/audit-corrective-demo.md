# Fictional audit corrective-action scenario

Start at `/ja/dev-login` and choose **井上拓（組織管理者）で是正デモを開始**. The scenario belongs to 継続運用モデル株式会社 and uses `DEMO-ACCESS-001`: no record can be found for a quarterly access review. All names, account IDs and records are fictional.

The nonconformity guide links to its audit plan and checklist. In the plan's follow-ups, assign **担当決定と初回是正** and advance it to 対応中. This assignee belongs to the follow-up; the separate nonconformity/action responsibility fields are not changed automatically. Save the cause investigation, corrective work, dates and progress on the nonconformity screen. Save fictional evidence in the checklist’s 証跡メモ text field. The downloadable CSV is an initial gap observation, not a completed review or effectiveness finding. File attachments are unavailable in the public demo.

After reviewing the result, record completion. Keep **次回点検で有効性確認** open until another quarterly review demonstrates the procedure actually recurs. Completion, effectiveness review and closure approval are separate decisions. Saving the corrective action precedes any closure-approval submission; approval is not guaranteed by this demo.

Data is shared and the configured daily reset recreates the starting scenario; another visitor may have progressed it. Current edits are not durable. The reset runs at 19:00 UTC (the hosting schedule may vary within the hour). A failed reset does not prove recreation occurred. Do not reset the shared demo merely to restart one evaluation.

## Operator bootstrap

The Start button first uses the existing fictional organization administrator session to insert missing scenario rows. It checks same-origin requests, demo availability, the exact fictional tenant, active admin membership, and the public database reset marker in a write transaction. It does not accept tenant IDs or fixture values from the request and never updates existing rows.

The normal `scripts/seed-practical-verification.mjs --reset --scenario all` includes this fixture. For first rollout, `node scripts/seed-audit-corrective-demo.mjs --public-demo` adds only the seven reserved rows in one transaction. Configure the existing public-demo environment securely; it requires `NODE_ENV=production`, `PUBLIC_DEMO_ENABLED=true`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `PUBLIC_DEMO_EXPECTED_DATABASE_URL` and `PUBLIC_DEMO_EXPECTED_DATABASE_ID`. The marker must belong to that database and not be resetting. No secret values belong in source or command output. Rerunning inserts zero rows and preserves visitor changes. The script provides no remote reset or delete option.

For local evaluation, provision an isolated temporary database and storage directory, run the normal practical seed, and start the app with those paths. The additive script without `--public-demo` accepts only an existing canonical database path below the OS temporary directory.

Reserved plan: `7c020000-0000-4000-8000-000200000091`. Nonconformity: `7c050000-0000-4000-8000-000200000091`. Two follow-ups end in `91` and `92` respectively. Schema, authentication, roles and public external-effect policy are unchanged.
