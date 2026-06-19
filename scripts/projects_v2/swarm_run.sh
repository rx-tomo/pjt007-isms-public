#!/usr/bin/env bash
# swarm_run.sh
set -euo pipefail

START_TIME="$(date +%s)"

print_execution_time() {
  local end_time duration hours minutes seconds

  if ! end_time="$(date +%s 2>/dev/null)"; then
    return 0
  fi

  duration=$((end_time - START_TIME))
  if [ "$duration" -lt 0 ]; then
    duration=0
  fi

  hours=$((duration / 3600))
  minutes=$(((duration % 3600) / 60))
  seconds=$((duration % 60))

  printf '実行時間: %02d時間%02d分%02d秒\n' "$hours" "$minutes" "$seconds"
}

trap print_execution_time EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/lib_queue.sh"

queue_initialize
export PROJECTS_V2_QUEUE_INITIALIZED=1
export project_enabled project_number project_owner project_id dep_field_name dep_field_id repo_owner repo_name

# デフォルト待機秒数を短縮し、環境変数で上書きできる挙動は維持
GRAPHQL_RATE_LIMIT_SLEEP_SECONDS="${GRAPHQL_RATE_LIMIT_SLEEP_SECONDS:-120}"

calculate_rate_limit_sleep() {
  local fallback wait_seconds now reset

  fallback="$GRAPHQL_RATE_LIMIT_SLEEP_SECONDS"
  wait_seconds="$fallback"
  reset="${GRAPHQL_RATE_LIMIT_RESET:-}"

  if [[ "$reset" =~ ^[0-9]+$ ]]; then
    if now="$(date +%s 2>/dev/null)"; then
      wait_seconds=$((reset - now))
      if [ "$wait_seconds" -lt 60 ]; then
        wait_seconds=60
      fi
    fi
  fi

  if [ "$wait_seconds" -le 0 ]; then
    wait_seconds="$fallback"
  fi

  if [ "$wait_seconds" -lt 60 ]; then
    wait_seconds=60
  fi

  printf '%s' "$wait_seconds"
}

pause_for_graphql_rate_limit() {
  local context="$1"
  local remaining reset_human wait_seconds

  get_graphql_rate_limit || true
  remaining="${GRAPHQL_RATE_LIMIT_REMAINING:-unknown}"
  reset_human="$(format_epoch "${GRAPHQL_RATE_LIMIT_RESET:-}")"
  wait_seconds="$(calculate_rate_limit_sleep)"

  if [ -n "$reset_human" ]; then
    echo "Info: $context で GraphQL API レートリミットに達したため、$wait_seconds 秒待機します (remaining=$remaining, reset=$reset_human)." >&2
  else
    echo "Info: $context で GraphQL API レートリミットに達した可能性があるため、$wait_seconds 秒待機します。" >&2
  fi

  sleep "$wait_seconds"
}

run_refresh_blocked() {
  local refresh_status
  while true; do
    set +e
    "$SCRIPT_DIR/refresh_blocked.sh"
    refresh_status=$?
    set -e

    if [ $refresh_status -eq 0 ]; then
      break
    fi

    if [ $refresh_status -eq 2 ]; then
      pause_for_graphql_rate_limit "refresh_blocked.sh"
      continue
    fi

    return $refresh_status
  done
}

next_issue_with_retry() {
  local issue_output issue_status
  while true; do
    set +e
    issue_output="$("$SCRIPT_DIR/next_ready_issue.sh")"
    issue_status=$?
    set -e

    if [ $issue_status -eq 0 ]; then
      printf '%s' "$issue_output"
      return 0
    fi

    if [ $issue_status -eq 2 ]; then
      pause_for_graphql_rate_limit "next_ready_issue.sh"
      continue
    fi

    return $issue_status
  done
}

load_projects_v2_config
ensure_project_setup

if [ -z "${GH_TOKEN:-}" ]; then
  if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
    export GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    export GH_TOKEN="$GITHUB_TOKEN"
  fi
fi

run_refresh_blocked

# テンプレートはそのまま読み込み、数値置換は実行時にメモリ上で行う（ファイルは書き換えない）
PROMPT_TEMPLATE="$(cat "$SCRIPT_DIR/prompt.txt")"

repo_json="$(gh repo view --json owner,name)"
REPO_OWNER="$(echo "$repo_json" | jq -r '.owner.login')"
REPO_NAME="$(echo "$repo_json" | jq -r '.name')"
REPO_ISSUE_URL_BASE="https://github.com/$REPO_OWNER/$REPO_NAME/issues"

PROJECT_V2_NUMBER="${PROJECT_V2_NUMBER:-}"
PROJECT_OWNER="${PROJECT_V2_OWNER:-$REPO_OWNER}"
PROJECT_DEPENDS_FIELD="${PROJECT_DEPENDS_FIELD:-Depends on}"
PROJECT_STATUS_FIELD="${PROJECT_STATUS_FIELD:-Status}"
PROJECT_STATUS_READY_OPTION="${PROJECT_STATUS_READY_OPTION:-Todo}"
PROJECT_STATUS_IN_PROGRESS_OPTION="${PROJECT_STATUS_IN_PROGRESS_OPTION:-In Progress}"
PROJECT_STATUS_BLOCKED_OPTION="${PROJECT_STATUS_BLOCKED_OPTION:-Blocked}"
PROJECT_STATUS_DONE_OPTION="${PROJECT_STATUS_DONE_OPTION:-Done}"
CODEX_CMD="${CODEX_CMD:-codex}"
read -r -a CODEX_ARR <<< "$CODEX_CMD"
if ! command -v "${CODEX_ARR[0]}" >/dev/null 2>&1; then
  if command -v codex >/dev/null 2>&1; then
    CODEX_CMD="codex"
  elif command -v npx >/dev/null 2>&1; then
    CODEX_CMD="npx @openai/codex"
  else
    echo "Error: codex CLI (or npx) が見つかりません。CODEX_CMD を設定してください。" >&2
    exit 1
  fi
  read -r -a CODEX_ARR <<< "$CODEX_CMD"
fi

if [ -z "$PROJECT_V2_NUMBER" ]; then
  echo "Error: PROJECT_V2_NUMBER is not set. 環境変数を設定してから再実行してください。" >&2
  exit 1
fi

PROJECT_ENABLED=0
PROJECT_ID=""
STATUS_FIELD_ID=""
STATUS_READY_OPTION_ID=""
STATUS_IN_PROGRESS_OPTION_ID=""
STATUS_BLOCKED_OPTION_ID=""
STATUS_DONE_OPTION_ID=""
CURRENT_PROJECT_ITEM_ID=""

if [ -n "$PROJECT_V2_NUMBER" ]; then
  project_json="$(gh project view "$PROJECT_V2_NUMBER" --owner "$PROJECT_OWNER" --format json 2>/dev/null || true)"
  PROJECT_ID="$(echo "$project_json" | jq -r '.id // empty' || true)"

  if [ -n "$PROJECT_ID" ]; then
    fields_json="$(gh project field-list "$PROJECT_V2_NUMBER" --owner "$PROJECT_OWNER" --format json)"
    STATUS_FIELD_JSON="$(echo "$fields_json" | jq --arg name "$PROJECT_STATUS_FIELD" '.fields[] | select(.name == $name)' || true)"
    STATUS_FIELD_ID="$(echo "$STATUS_FIELD_JSON" | jq -r '.id // empty' || true)"

    if [ -n "$STATUS_FIELD_ID" ]; then
      STATUS_READY_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_READY_OPTION" '.options[] | select(.name == $name) | .id' || true)"
      STATUS_IN_PROGRESS_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_IN_PROGRESS_OPTION" '.options[] | select(.name == $name) | .id' || true)"
      STATUS_BLOCKED_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_BLOCKED_OPTION" '.options[] | select(.name == $name) | .id' || true)"
      STATUS_DONE_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_DONE_OPTION" '.options[] | select(.name == $name) | .id' || true)"

      if [ -z "$STATUS_READY_OPTION_ID" ]; then
        echo "Warning: status option '$PROJECT_STATUS_READY_OPTION' not found; ready state sync will be skipped." >&2
      fi
      if [ -z "$STATUS_IN_PROGRESS_OPTION_ID" ]; then
        echo "Warning: status option '$PROJECT_STATUS_IN_PROGRESS_OPTION' not found; in-progress sync will be skipped." >&2
      fi
      if [ -z "$STATUS_BLOCKED_OPTION_ID" ]; then
        echo "Warning: status option '$PROJECT_STATUS_BLOCKED_OPTION' not found; blocked sync will reuse in-progress state." >&2
        STATUS_BLOCKED_OPTION_ID="$STATUS_IN_PROGRESS_OPTION_ID"
      fi
      if [ -z "$STATUS_DONE_OPTION_ID" ]; then
        echo "Warning: status option '$PROJECT_STATUS_DONE_OPTION' not found; done sync will be skipped." >&2
      fi
    else
      echo "Warning: project status field '$PROJECT_STATUS_FIELD' not found; status sync disabled." >&2
    fi

    PROJECT_ENABLED=1
else
  echo "Warning: project $PROJECT_OWNER/$PROJECT_V2_NUMBER not accessible; project sync disabled." >&2
fi
fi

get_project_item_id() {
  local issue_number="$1"
  if [ "$PROJECT_ENABLED" -ne 1 ]; then
    return 0
  fi

  gh api graphql \
    -F owner="$REPO_OWNER" \
    -F name="$REPO_NAME" \
    -F number="$issue_number" \
    -f query='query ($owner:String!, $name:String!, $number:Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          projectItems(first: 20) {
            nodes {
              id
              project { number }
            }
          }
        }
      }
    }' \
    --argjson projectNumber "$PROJECT_V2_NUMBER" \
    --jq '(.data.repository.issue.projectItems.nodes // [])[] | select(.project.number == $projectNumber) | .id' \
    2>/dev/null || true
}

ensure_project_item() {
  local issue_number="$1"
  if [ "$PROJECT_ENABLED" -ne 1 ]; then
    return 0
  fi

  local existing_id
  existing_id="$(get_project_item_id "$issue_number")"
  if [ -n "$existing_id" ]; then
    printf '%s' "$existing_id"
    return 0
  fi

  local item_json
  item_json="$(gh project item-add "$PROJECT_V2_NUMBER" --owner "$PROJECT_OWNER" --url "$REPO_ISSUE_URL_BASE/$issue_number" --format json 2>/dev/null || true)"
  printf '%s' "$item_json" | jq -r '.id // empty' 2>/dev/null || true
}

update_project_status() {
  local issue_number="$1"
  local option_id="$2"
  local cached_item_id="${3:-}"

  if [ "$PROJECT_ENABLED" -ne 1 ] || [ -z "$STATUS_FIELD_ID" ] || [ -z "$option_id" ]; then
    return 0
  fi

  local item_id
  if [ -n "$cached_item_id" ]; then
    item_id="$cached_item_id"
  else
    item_id="$(ensure_project_item "$issue_number")"
  fi
  if [ -z "$item_id" ]; then
    echo "Warning: could not resolve project item id for issue #$issue_number; status sync skipped." >&2
    return 0
  fi

  gh project item-edit \
    --id "$item_id" \
    --project-id "$PROJECT_ID" \
    --field-id "$STATUS_FIELD_ID" \
    --single-select-option-id "$option_id" \
    >/dev/null
}

while true; do

  ISSUE_NUM="$(next_issue_with_retry)"
  if [ -z "$ISSUE_NUM" ]; then
    echo "No ready issues with resolved dependencies."
    break
  fi

  issue_state="$(gh issue view "$ISSUE_NUM" --json state --jq '.state' 2>/dev/null || echo '')"
  if [ -z "$issue_state" ]; then
    echo "Warning: issue #$ISSUE_NUM にアクセスできませんでした。次の issue を探索します。"
    continue
  fi

  if [ "$issue_state" != "OPEN" ]; then
    echo "Info: issue #$ISSUE_NUM は state=$issue_state のためスキップします。"
    continue
  fi

  echo "Dispatching subagent for issue #$ISSUE_NUM ..."

  gh issue edit "$ISSUE_NUM" --remove-label ready --add-label in_progress --add-assignee "@me" || true

  CURRENT_PROJECT_ITEM_ID=""
  if [ "$PROJECT_ENABLED" -eq 1 ]; then
    CURRENT_PROJECT_ITEM_ID="$(ensure_project_item "$ISSUE_NUM")"
    if [ -z "$CURRENT_PROJECT_ITEM_ID" ]; then
      echo "Warning: project item id for issue #$ISSUE_NUM を取得できませんでした。プロジェクト更新をスキップします。" >&2
    fi
  fi

  update_project_status "$ISSUE_NUM" "$STATUS_IN_PROGRESS_OPTION_ID" "$CURRENT_PROJECT_ITEM_ID"

  PROMPT="${PROMPT_TEMPLATE//\$ISSUE_NUM/$ISSUE_NUM}"

  if "${CODEX_ARR[@]}" exec -m gpt-5.1-codex -s danger-full-access "$PROMPT"; then
    gh issue close "$ISSUE_NUM" -c "Auto-closed by swarm_run. ✅"
    gh issue edit "$ISSUE_NUM" --remove-label in_progress --add-label done
    update_project_status "$ISSUE_NUM" "$STATUS_DONE_OPTION_ID" "$CURRENT_PROJECT_ITEM_ID"
    run_refresh_blocked
  else
    echo "Subagent failed for #$ISSUE_NUM, marking blocked."
    gh issue edit "$ISSUE_NUM" --remove-label in_progress --add-label blocked
    update_project_status "$ISSUE_NUM" "$STATUS_BLOCKED_OPTION_ID" "$CURRENT_PROJECT_ITEM_ID"
    run_refresh_blocked
    continue
  fi
done
