#!/usr/bin/env bash
# 共通設定読み込み
set -euo pipefail

CONFIG_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONFIG_PATH="$(cd "$CONFIG_SCRIPT_DIR/../.." >/dev/null 2>&1 && pwd)/config/projects_v2.toml"
PROJECTS_V2_CONFIG_PATH="${PROJECTS_V2_CONFIG:-$DEFAULT_CONFIG_PATH}"

_config_trim() {
  local value="$1"
  value="${value%%\"}"
  value="${value%\"}"
  value="${value##\"}"
  value="${value%%\"}"
  printf '%s' "$(echo "$value" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
}

_config_update_value() {
  local key="$1"
  local value="$2"
  local file="$PROJECTS_V2_CONFIG_PATH"
  if [ ! -w "$file" ]; then
    echo "Warning: cannot update $key in config (file not writable): $file" >&2
    return 0
  fi
  perl -0pi -e 's/^('"$key"'\s*=\s*).*/$1'"$value"'/m' "$file"
}

load_projects_v2_config() {
  local config_path="$PROJECTS_V2_CONFIG_PATH"

  if [ ! -f "$config_path" ]; then
    echo "Error: Projects v2 config file not found: $config_path" >&2
    exit 1
  fi

  local cfg_project_number=""
  local cfg_project_owner=""
  local cfg_project_title=""
  local cfg_depends_field=""
  local cfg_status_field=""
  local cfg_status_ready=""
  local cfg_status_in_progress=""
  local cfg_status_blocked=""
  local cfg_status_done=""
  local cfg_codex_cmd=""

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="${line%%;*}"
    line="$(echo "$line" | tr -d '\r')"
    [ -z "${line// }" ] && continue
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z0-9_]+)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local raw_value="${BASH_REMATCH[2]}"
      local value="$(_config_trim "$raw_value")"
      case "$key" in
        project_number) cfg_project_number="$value" ;;
        project_owner) cfg_project_owner="$value" ;;
        project_title) cfg_project_title="$value" ;;
        depends_field) cfg_depends_field="$value" ;;
        status_field) cfg_status_field="$value" ;;
        status_ready) cfg_status_ready="$value" ;;
        status_in_progress) cfg_status_in_progress="$value" ;;
        status_blocked) cfg_status_blocked="$value" ;;
        status_done) cfg_status_done="$value" ;;
        codex_cmd) cfg_codex_cmd="$value" ;;
      esac
    fi
  done < "$config_path"

  PROJECT_V2_NUMBER="${PROJECT_V2_NUMBER:-$cfg_project_number}"
  PROJECT_V2_OWNER="${PROJECT_V2_OWNER:-$cfg_project_owner}"
  PROJECT_V2_TITLE="${PROJECT_V2_TITLE:-$cfg_project_title}"
  PROJECT_DEPENDS_FIELD="${PROJECT_DEPENDS_FIELD:-${cfg_depends_field:-Depends on}}"
  PROJECT_STATUS_FIELD="${PROJECT_STATUS_FIELD:-${cfg_status_field:-Status}}"
  PROJECT_STATUS_READY_OPTION="${PROJECT_STATUS_READY_OPTION:-${cfg_status_ready:-Todo}}"
  PROJECT_STATUS_IN_PROGRESS_OPTION="${PROJECT_STATUS_IN_PROGRESS_OPTION:-${cfg_status_in_progress:-In Progress}}"
  PROJECT_STATUS_BLOCKED_OPTION="${PROJECT_STATUS_BLOCKED_OPTION:-${cfg_status_blocked:-Blocked}}"
  PROJECT_STATUS_DONE_OPTION="${PROJECT_STATUS_DONE_OPTION:-${cfg_status_done:-Done}}"
  CODEX_CMD="${CODEX_CMD:-${cfg_codex_cmd:-codex}}"
}

_lookup_project_owner_id() {
  local login="$1"
  local node_id=""

  if [ "$login" = "@me" ]; then
    node_id="$(gh api user --jq '.node_id' 2>/dev/null || true)"
  else
    node_id="$(gh api "orgs/$login" --jq '.node_id' 2>/dev/null || true)"
    if [ -z "$node_id" ]; then
      node_id="$(gh api "users/$login" --jq '.node_id' 2>/dev/null || true)"
    fi
  fi

  if [ -n "$node_id" ] && [ "$node_id" != "null" ]; then
    printf '%s' "$node_id"
    return 0
  fi

  return 1
}

ensure_project_setup() {
  if [ "${SKIP_PROJECT_SETUP:-0}" = "1" ]; then
    return 0
  fi
  if [ "${PROJECT_SETUP_DONE:-0}" = "1" ]; then
    return 0
  fi

  if [ -z "${PROJECT_V2_OWNER:-}" ]; then
    echo "Error: project_owner is not set in config or environment." >&2
    exit 1
  fi

  local project_view
  if [ -n "${PROJECT_V2_NUMBER:-}" ]; then
    project_view="$(gh project view "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --format json 2>/dev/null || true)"
  else
    project_view=""
  fi

  if [ -z "$project_view" ]; then
    local new_project_number
    if [ -z "${PROJECT_V2_TITLE:-}" ]; then
      PROJECT_V2_TITLE="Automated Project $(date '+%Y-%m-%d %H:%M:%S')"
    fi

    if [ -n "${PROJECT_V2_NUMBER:-}" ]; then
      echo "Warning: configured Projects v2 board '$PROJECT_V2_OWNER/#$PROJECT_V2_NUMBER' が見つかりません。新規にボードを作成して config を更新します。" >&2
    else
      echo "Projects v2 board が未設定のため、新規作成します: '$PROJECT_V2_TITLE'" >&2
    fi

    local project_create_output
    if ! project_create_output="$(gh project create --owner "$PROJECT_V2_OWNER" --title "$PROJECT_V2_TITLE" --format json 2>&1)"; then
      if printf '%s' "$project_create_output" | grep -qi 'unknown owner type'; then
        local owner_id
        if ! owner_id="$(_lookup_project_owner_id "$PROJECT_V2_OWNER")"; then
          echo "Error: Projects v2 board を自動作成できませんでした（owner解決失敗）。original: $project_create_output" >&2
          exit 1
        fi

        local graphql_payload
        graphql_payload="$(jq -n --arg ownerId "$owner_id" --arg title "$PROJECT_V2_TITLE" '{
          "query": "mutation ($ownerId: ID!, $title: String!) { createProjectV2(input: { ownerId: $ownerId, title: $title }) { projectV2 { id number title } } }",
          "variables": {"ownerId": $ownerId, "title": $title}
        }')"

        local graphql_response
        if ! graphql_response="$(printf '%s' "$graphql_payload" | gh api graphql --input - 2>&1)"; then
          echo "Error: Projects v2 board を自動作成できませんでした（GraphQL失敗）。original: $project_create_output" >&2
          echo "$graphql_response" >&2
          exit 1
        fi

        new_project_number="$(printf '%s' "$graphql_response" | jq -r '.data.createProjectV2.projectV2.number // empty')"
        if [ -z "$new_project_number" ]; then
          echo "Error: GraphQL から project_number を取得できませんでした。" >&2
          exit 1
        fi

        project_view="$(gh project view "$new_project_number" --owner "$PROJECT_V2_OWNER" --format json)"
      else
        echo "Error: Projects v2 board を自動作成できませんでした。権限や owner 設定を確認してください。" >&2
        echo "$project_create_output" >&2
        exit 1
      fi
    else
      project_view="$project_create_output"
    fi

    new_project_number="$(echo "$project_view" | jq -r '.number // empty')"
    if [ -z "$new_project_number" ]; then
      echo "Error: 新規に作成した Projects v2 board の番号を取得できませんでした。" >&2
      exit 1
    fi

    if [ -n "${PROJECT_V2_NUMBER:-}" ] && [ "$new_project_number" != "$PROJECT_V2_NUMBER" ]; then
      echo "Info: project_number を '$PROJECT_V2_NUMBER' から '$new_project_number' に更新します。" >&2
    fi

    PROJECT_V2_NUMBER="$new_project_number"
    _config_update_value "project_number" "$PROJECT_V2_NUMBER"
    if [ -n "$PROJECT_V2_TITLE" ]; then
      _config_update_value "project_title" "\"$PROJECT_V2_TITLE\""
    fi
  fi

  PROJECT_ID="$(echo "$project_view" | jq -r '.id')"
  if [ -z "$PROJECT_ID" ]; then
    PROJECT_VIEW="$(gh project view "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --format json)"
    PROJECT_ID="$(echo "$PROJECT_VIEW" | jq -r '.id')"
  fi

  local fields_json
  fields_json="$(gh project field-list "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --format json)"

  local status_field_json
  status_field_json="$(echo "$fields_json" | jq --arg name "$PROJECT_STATUS_FIELD" '.fields[] | select(.name == $name)' || true)"
  if [ -z "$status_field_json" ]; then
    echo "Creating status field '$PROJECT_STATUS_FIELD'..." >&2
    gh project field-create "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --name "$PROJECT_STATUS_FIELD" --data-type SINGLE_SELECT --single-select-options "${PROJECT_STATUS_READY_OPTION},${PROJECT_STATUS_IN_PROGRESS_OPTION},${PROJECT_STATUS_BLOCKED_OPTION},${PROJECT_STATUS_DONE_OPTION}" >/dev/null
    fields_json="$(gh project field-list "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --format json)"
    status_field_json="$(echo "$fields_json" | jq --arg name "$PROJECT_STATUS_FIELD" '.fields[] | select(.name == $name)')"
  fi

  local depends_field_json
  depends_field_json="$(echo "$fields_json" | jq --arg name "$PROJECT_DEPENDS_FIELD" '.fields[] | select(.name == $name)' || true)"
  if [ -z "$depends_field_json" ]; then
    echo "Creating dependency field '$PROJECT_DEPENDS_FIELD'..." >&2
    gh project field-create "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --name "$PROJECT_DEPENDS_FIELD" --data-type TEXT >/dev/null
    fields_json="$(gh project field-list "$PROJECT_V2_NUMBER" --owner "$PROJECT_V2_OWNER" --format json)"
    depends_field_json="$(echo "$fields_json" | jq --arg name "$PROJECT_DEPENDS_FIELD" '.fields[] | select(.name == $name)')"
  fi

  if [ -n "$status_field_json" ]; then
    local desired_options_json
    desired_options_json=$(jq -n --arg ready "$PROJECT_STATUS_READY_OPTION" --arg inprog "$PROJECT_STATUS_IN_PROGRESS_OPTION" --arg blocked "$PROJECT_STATUS_BLOCKED_OPTION" --arg done "$PROJECT_STATUS_DONE_OPTION" '[
      {"name":$ready, "description":$ready, "color":"GRAY"},
      {"name":$inprog, "description":$inprog, "color":"BLUE"},
      {"name":$blocked, "description":$blocked, "color":"RED"},
      {"name":$done, "description":$done, "color":"GREEN"}
    ]')

    local existing_names
    existing_names=$(echo "$status_field_json" | jq -r '.options[]?.name' 2>/dev/null | paste -sd',' -)
    local expected_names
    expected_names=$(echo "$desired_options_json" | jq -r '.[].name' | paste -sd',' -)

    if [ "$existing_names" != "$expected_names" ]; then
      local field_id
      field_id=$(echo "$status_field_json" | jq -r '.id')
      jq -n --arg fieldId "$field_id" --argjson options "$desired_options_json" '{
        "query": "mutation ($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) { updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: $options }) { projectV2Field { __typename } } }",
        "variables": {"fieldId": $fieldId, "options": $options}
      }' | gh api graphql --input - >/dev/null
    fi
  fi

  PROJECT_SETUP_DONE=1
}
