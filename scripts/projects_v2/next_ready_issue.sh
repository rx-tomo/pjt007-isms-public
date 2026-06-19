#!/usr/bin/env bash
# next_ready_issue.sh
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

# open & ready なIssue一覧
set +e
issues_cmd_output="$(gh issue list --state open --label ready --json number,title,body,createdAt --limit 200 2>&1)"
issues_cmd_status=$?
set -e

if [ $issues_cmd_status -ne 0 ]; then
  get_graphql_rate_limit || true
  if [[ "${GRAPHQL_RATE_LIMIT_REMAINING:-}" =~ ^[0-9]+$ ]] && [ "${GRAPHQL_RATE_LIMIT_REMAINING:-0}" -le 0 ]; then
    human="$(format_epoch "$GRAPHQL_RATE_LIMIT_RESET")"
    if [ -n "$human" ]; then
      echo "Error: GraphQL APIのレートリミット超過によりreadyラベルのIssue取得に失敗しました。リセット予定: $human (epoch: $GRAPHQL_RATE_LIMIT_RESET)." >&2
    else
      echo "Error: GraphQL APIのレートリミット超過によりreadyラベルのIssue取得に失敗しました。リセットEpoch: $GRAPHQL_RATE_LIMIT_RESET." >&2
    fi
  else
    echo "Error: readyラベルのIssue取得に失敗しました。詳細: $issues_cmd_output" >&2
  fi
  exit 2
fi

issues_json="$issues_cmd_output"

get_graphql_rate_limit || true

if { [ -z "$issues_json" ] || [ "$issues_json" = "[]" ]; } && [[ "${GRAPHQL_RATE_LIMIT_REMAINING:-}" =~ ^[0-9]+$ ]] && [ "${GRAPHQL_RATE_LIMIT_REMAINING:-0}" -le 0 ]; then
  human="$(format_epoch "$GRAPHQL_RATE_LIMIT_RESET")"
  if [ -n "$human" ]; then
    echo "Error: GraphQL APIのレートリミット超過によりreadyラベルのIssue取得に失敗しました。リセット予定: $human (epoch: $GRAPHQL_RATE_LIMIT_RESET)." >&2
  else
    echo "Error: GraphQL APIのレートリミット超過によりreadyラベルのIssue取得に失敗しました。リセットEpoch: $GRAPHQL_RATE_LIMIT_RESET." >&2
  fi
  exit 2
fi

set +e
open_issues_cmd_output="$(gh issue list --state open --json number --limit 1000 2>&1)"
open_issues_cmd_status=$?
set -e

if [ $open_issues_cmd_status -ne 0 ]; then
  get_graphql_rate_limit || true
  if [[ "${GRAPHQL_RATE_LIMIT_REMAINING:-}" =~ ^[0-9]+$ ]] && [ "${GRAPHQL_RATE_LIMIT_REMAINING:-0}" -le 0 ]; then
    human="$(format_epoch "$GRAPHQL_RATE_LIMIT_RESET")"
    if [ -n "$human" ]; then
      echo "Error: GraphQL APIのレートリミット超過によりopen Issue一覧の取得に失敗しました。リセット予定: $human (epoch: $GRAPHQL_RATE_LIMIT_RESET)." >&2
    else
      echo "Error: GraphQL APIのレートリミット超過によりopen Issue一覧の取得に失敗しました。リセットEpoch: $GRAPHQL_RATE_LIMIT_RESET." >&2
    fi
  else
    echo "Error: open Issue一覧の取得に失敗しました。詳細: $open_issues_cmd_output" >&2
  fi
  exit 2
fi

open_issues_json="$open_issues_cmd_output"
open_issue_numbers="$(echo "$open_issues_json" | jq -r '.[].number' | tr '\n' ' ')"
pick_issue() {
  echo "$issues_json" \
  | jq -r 'sort_by(.number)[] | [.number, .body, .createdAt] | @tsv' \
  | while IFS=$'\t' read -r num body created; do
      deps_text=""
      if [ "$project_enabled" -eq 1 ]; then
        deps_text="$(project_dependencies "$num")"
      else
        deps_text=""
      fi

      if [ -n "$deps_text" ]; then
        deps=$(extract_dep_ids "$deps_text")
      else
        dep_line="$(printf '%s\n' "$body" | grep -Ei '^Depends-on:' | head -n1 || true)"
        if [ -n "$dep_line" ]; then
          deps=$(extract_dep_ids "$dep_line")
        else
          deps=""
        fi
      fi

      unresolved=0
      for d in $deps; do
        clean="$d"
        if [[ "$clean" =~ ^[0-9]+$ ]]; then
          clean=$((10#$clean))
        fi
        if [[ " $open_issue_numbers " == *" $clean "* ]]; then
          unresolved=1
        fi
      done

      if [ "$unresolved" -eq 0 ]; then
        echo "$num"
        return 0
      fi
    done
}

num="$(pick_issue || true)"
if [ -n "${num:-}" ]; then
  echo "$num"
else
  echo ""
fi
