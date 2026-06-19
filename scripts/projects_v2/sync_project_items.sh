#!/usr/bin/env bash
# sync_project_items.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

load_projects_v2_config
ensure_project_setup

if [ -z "${GH_TOKEN:-}" ]; then
  if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
    export GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    export GH_TOKEN="$GITHUB_TOKEN"
  fi
fi

PROJECT_V2_NUMBER="${PROJECT_V2_NUMBER:-}"
PROJECT_OWNER="${PROJECT_V2_OWNER:-}"
PROJECT_DEPENDS_FIELD="${PROJECT_DEPENDS_FIELD:-Depends on}"
PROJECT_STATUS_FIELD="${PROJECT_STATUS_FIELD:-Status}"
PROJECT_STATUS_READY_OPTION="${PROJECT_STATUS_READY_OPTION:-Todo}"
PROJECT_STATUS_IN_PROGRESS_OPTION="${PROJECT_STATUS_IN_PROGRESS_OPTION:-In Progress}"
PROJECT_STATUS_BLOCKED_OPTION="${PROJECT_STATUS_BLOCKED_OPTION:-Blocked}"
PROJECT_STATUS_DONE_OPTION="${PROJECT_STATUS_DONE_OPTION:-Done}"

if [ -z "$PROJECT_V2_NUMBER" ]; then
  echo "PROJECT_V2_NUMBER is not set. Set it in config/projects_v2.toml or via PROJECT_V2_NUMBER." >&2
  exit 1
fi

repo_json="$(gh repo view --json owner,name)"
REPO_OWNER="$(echo "$repo_json" | jq -r '.owner.login')"
REPO_NAME="$(echo "$repo_json" | jq -r '.name')"
REPO_ISSUE_URL_BASE="https://github.com/$REPO_OWNER/$REPO_NAME/issues"

if [ -z "$PROJECT_OWNER" ]; then
  PROJECT_OWNER="$REPO_OWNER"
fi

project_json="$(gh project view "$PROJECT_V2_NUMBER" --owner "$PROJECT_OWNER" --format json)"
PROJECT_ID="$(echo "$project_json" | jq -r '.id')"

fields_json="$(gh project field-list "$PROJECT_V2_NUMBER" --owner "$PROJECT_OWNER" --format json)"

STATUS_FIELD_JSON="$(echo "$fields_json" | jq --arg name "$PROJECT_STATUS_FIELD" '.fields[] | select(.name == $name)' || true)"
STATUS_FIELD_ID="$(echo "$STATUS_FIELD_JSON" | jq -r '.id // empty' || true)"

if [ -z "$STATUS_FIELD_ID" ]; then
  echo "Warning: status field '$PROJECT_STATUS_FIELD' not found. Status updates will be skipped." >&2
fi

STATUS_READY_OPTION_ID=""
STATUS_IN_PROGRESS_OPTION_ID=""
STATUS_BLOCKED_OPTION_ID=""
STATUS_DONE_OPTION_ID=""

if [ -n "$STATUS_FIELD_ID" ]; then
  STATUS_READY_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_READY_OPTION" '.options[] | select(.name == $name) | .id' || true)"
  STATUS_IN_PROGRESS_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_IN_PROGRESS_OPTION" '.options[] | select(.name == $name) | .id' || true)"
  STATUS_BLOCKED_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_BLOCKED_OPTION" '.options[] | select(.name == $name) | .id' || true)"
  STATUS_DONE_OPTION_ID="$(echo "$STATUS_FIELD_JSON" | jq -r --arg name "$PROJECT_STATUS_DONE_OPTION" '.options[] | select(.name == $name) | .id' || true)"
fi

DEP_FIELD_ID="$(echo "$fields_json" | jq -r --arg name "$PROJECT_DEPENDS_FIELD" '.fields[] | select(.name == $name) | .id' || true)"
if [ -z "$DEP_FIELD_ID" ]; then
  echo "Warning: dependency field '$PROJECT_DEPENDS_FIELD' not found. Dependency sync will be skipped." >&2
fi

ensure_project_item() {
  local issue_number="$1"

  local existing_id
  existing_id="$(gh api graphql \
    -F owner="$REPO_OWNER" \
    -F name="$REPO_NAME" \
    -F number="$issue_number" \
    -f query='query ($owner:String!, $name:String!, $number:Int!) {
      repository(owner:$owner, name:$name) {
        issue(number:$number) {
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
    2>/dev/null || true)"

  if [ -n "$existing_id" ]; then
    printf '%s' "$existing_id"
    return 0
  fi

  local item_json
  item_json="$(gh project item-add "$PROJECT_V2_NUMBER" --owner "$PROJECT_OWNER" --url "$REPO_ISSUE_URL_BASE/$issue_number" --format json)"
  printf '%s' "$item_json" | jq -r '.id // empty'
}

update_status_field() {
  local issue_number="$1"
  local option_id="$2"

  if [ -z "$STATUS_FIELD_ID" ] || [ -z "$option_id" ]; then
    return 0
  fi

  local item_id
  item_id="$(ensure_project_item "$issue_number")"
  if [ -z "$item_id" ]; then
    echo "Warning: unable to resolve project item id for issue #$issue_number" >&2
    return 0
  fi

  gh project item-edit \
    --id "$item_id" \
    --project-id "$PROJECT_ID" \
    --field-id "$STATUS_FIELD_ID" \
    --single-select-option-id "$option_id" \
    >/dev/null
}

update_dep_field() {
  local issue_number="$1"
  local value="$2"

  if [ -z "$DEP_FIELD_ID" ] || [ -z "$value" ]; then
    return 0
  fi

  local item_id
  item_id="$(ensure_project_item "$issue_number")"
  if [ -z "$item_id" ]; then
    echo "Warning: unable to resolve project item id for issue #$issue_number" >&2
    return 0
  fi

  gh project item-edit \
    --id "$item_id" \
    --project-id "$PROJECT_ID" \
    --field-id "$DEP_FIELD_ID" \
    --text "$value" \
    >/dev/null
}

choose_status_option() {
  local state="$1"
  local labels_json="$2"

  if [ "$state" = "CLOSED" ] && [ -n "$STATUS_DONE_OPTION_ID" ]; then
    printf '%s' "$STATUS_DONE_OPTION_ID"
    return 0
  fi

  if [ -n "$STATUS_DONE_OPTION_ID" ] && echo "$labels_json" | jq -e 'index("done")' >/dev/null 2>&1; then
    printf '%s' "$STATUS_DONE_OPTION_ID"
    return 0
  fi

  if [ -n "$STATUS_BLOCKED_OPTION_ID" ] && echo "$labels_json" | jq -e 'index("blocked")' >/dev/null 2>&1; then
    printf '%s' "$STATUS_BLOCKED_OPTION_ID"
    return 0
  fi

  if [ -n "$STATUS_IN_PROGRESS_OPTION_ID" ] && echo "$labels_json" | jq -e 'index("in_progress")' >/dev/null 2>&1; then
    printf '%s' "$STATUS_IN_PROGRESS_OPTION_ID"
    return 0
  fi

  if [ -n "$STATUS_READY_OPTION_ID" ] && echo "$labels_json" | jq -e 'index("ready")' >/dev/null 2>&1; then
    printf '%s' "$STATUS_READY_OPTION_ID"
    return 0
  fi

  printf ''
}

extract_depends_line() {
  local line
  line=$(printf '%s\n' "$1" | grep -Ei '^Depends-on:' | head -n1 || true)
  printf '%s' "$line" | sed -E 's/^Depends-on:[[:space:]]*//'
}

issues_json="$(gh issue list --state all --json number,state,title,body,labels --limit 200)"
count=0

while IFS= read -r issue; do
  number="$(echo "$issue" | jq -r '.number')"
  state="$(echo "$issue" | jq -r '.state')"
  labels="$(echo "$issue" | jq -c '[.labels[].name]' 2>/dev/null || echo '[]')"
  body="$(echo "$issue" | jq -r '.body // ""')"

  option="$(choose_status_option "$state" "$labels")"
  if [ -n "$option" ]; then
    update_status_field "$number" "$option"
  fi

  deps_line="$(extract_depends_line "$body")"
  if [ -n "$deps_line" ]; then
    update_dep_field "$number" "$deps_line"
  fi

  count=$((count + 1))
  echo "synced issue #$number"
done < <(echo "$issues_json" | jq -c '.[]')

echo "Processed $count issues."
