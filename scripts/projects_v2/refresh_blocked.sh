#!/usr/bin/env bash
# refresh_blocked.sh
# Re-evaluate blocked issues and return them to ready when all dependencies are resolved.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/lib_queue.sh"

ensure_queue_context() {
  if [ "${PROJECTS_V2_QUEUE_INITIALIZED:-0}" -eq 1 ] \
    && [ -n "${project_number:-}" ] \
    && [ -n "${repo_owner:-}" ] \
    && [ -n "${repo_name:-}" ]; then
    ensure_github_token
    return 0
  fi

  queue_initialize
}

ensure_queue_context

set +e
blocked_cmd_output="$(gh issue list --state open --label blocked --json number,title,body --limit 200 2>&1)"
blocked_cmd_status=$?
set -e

if [ $blocked_cmd_status -ne 0 ]; then
  get_graphql_rate_limit || true
  if [[ "${GRAPHQL_RATE_LIMIT_REMAINING:-}" =~ ^[0-9]+$ ]] && [ "${GRAPHQL_RATE_LIMIT_REMAINING:-0}" -le 0 ]; then
    human="$(format_epoch "$GRAPHQL_RATE_LIMIT_RESET")"
    if [ -n "$human" ]; then
      echo "Error: GraphQL APIのレートリミット超過によりblockedラベルのIssue取得に失敗しました。リセット予定: $human (epoch: $GRAPHQL_RATE_LIMIT_RESET)." >&2
    else
      echo "Error: GraphQL APIのレートリミット超過によりblockedラベルのIssue取得に失敗しました。リセットEpoch: $GRAPHQL_RATE_LIMIT_RESET." >&2
    fi
  else
    echo "Error: blockedラベルのIssue取得に失敗しました。詳細: $blocked_cmd_output" >&2
  fi
  exit 2
fi

if [ -z "$blocked_cmd_output" ] || [ "$blocked_cmd_output" = "[]" ]; then
  exit 0
fi

set +e
open_cmd_output="$(gh issue list --state open --json number --limit 1000 2>&1)"
open_cmd_status=$?
set -e

if [ $open_cmd_status -ne 0 ]; then
  get_graphql_rate_limit || true
  if [[ "${GRAPHQL_RATE_LIMIT_REMAINING:-}" =~ ^[0-9]+$ ]] && [ "${GRAPHQL_RATE_LIMIT_REMAINING:-0}" -le 0 ]; then
    human="$(format_epoch "$GRAPHQL_RATE_LIMIT_RESET")"
    if [ -n "$human" ]; then
      echo "Error: GraphQL APIのレートリミット超過によりopen Issue一覧の取得に失敗しました。リセット予定: $human (epoch: $GRAPHQL_RATE_LIMIT_RESET)." >&2
    else
      echo "Error: GraphQL APIのレートリミット超過によりopen Issue一覧の取得に失敗しました。リセットEpoch: $GRAPHQL_RATE_LIMIT_RESET." >&2
    fi
  else
    echo "Error: open Issue一覧の取得に失敗しました。詳細: $open_cmd_output" >&2
  fi
  exit 2
fi

open_issue_numbers="$(echo "$open_cmd_output" | jq -r '.[].number' | tr '\n' ' ')"

echo "$blocked_cmd_output" | jq -c '.[]' | while read -r issue_json; do
  issue_number="$(echo "$issue_json" | jq -r '.number')"
  issue_title="$(echo "$issue_json" | jq -r '.title')"
  issue_body="$(echo "$issue_json" | jq -r '.body // ""')"

  deps_text=""
  if [ "${project_enabled:-0}" -eq 1 ]; then
    deps_text="$(project_dependencies "$issue_number")"
  fi

  if [ -z "$deps_text" ]; then
    dep_line="$(printf '%s\n' "$issue_body" | grep -Ei '^Depends-on:' | head -n1 || true)"
    if [ -n "$dep_line" ]; then
      deps_text="$dep_line"
    fi
  fi

  deps_list="$(extract_dep_ids "$deps_text")"
  if [ -z "$deps_list" ]; then
    # 明示的な依存が無い場合は手動ブロックの可能性があるため自動復帰しない。
    continue
  fi

  unresolved=0
  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    if [[ "$dep" =~ ^[0-9]+$ ]]; then
      dep=$((10#$dep))
    fi
    if [[ " $open_issue_numbers " == *" $dep "* ]]; then
      unresolved=1
      break
    fi
  done <<< "$deps_list"

  if [ "$unresolved" -eq 0 ]; then
    gh issue edit "$issue_number" --remove-label blocked --add-label ready
    gh issue comment "$issue_number" --body "依存Issueが完了したため、自動的に ready へ戻しました。"
    echo "Unblocked issue #$issue_number ($issue_title)"
  fi
done
