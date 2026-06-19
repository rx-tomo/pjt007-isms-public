#!/usr/bin/env bash
# Shared helpers for Projects v2 issue queue workflows.

GRAPHQL_RATE_LIMIT_REMAINING="${GRAPHQL_RATE_LIMIT_REMAINING:-}"
GRAPHQL_RATE_LIMIT_RESET="${GRAPHQL_RATE_LIMIT_RESET:-}"

format_epoch() {
  local epoch="$1"
  local formatted

  if [ -z "$epoch" ] || [ "$epoch" = "null" ]; then
    return 0
  fi

  if formatted="$(date -r "$epoch" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null)"; then
    printf '%s' "$formatted"
    return 0
  fi

  if formatted="$(date -d "@$epoch" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null)"; then
    printf '%s' "$formatted"
    return 0
  fi

  printf '%s' "$epoch"
}

get_graphql_rate_limit() {
  local payload

  if ! payload="$(gh api rate_limit --jq '.resources.graphql' 2>/dev/null)"; then
    GRAPHQL_RATE_LIMIT_REMAINING=""
    GRAPHQL_RATE_LIMIT_RESET=""
    return 1
  fi

  GRAPHQL_RATE_LIMIT_REMAINING="$(echo "$payload" | jq -r '.remaining // empty')"
  GRAPHQL_RATE_LIMIT_RESET="$(echo "$payload" | jq -r '.reset // empty')"

  if [ "$GRAPHQL_RATE_LIMIT_REMAINING" = "null" ]; then
    GRAPHQL_RATE_LIMIT_REMAINING=""
  fi
  if [ "$GRAPHQL_RATE_LIMIT_RESET" = "null" ]; then
    GRAPHQL_RATE_LIMIT_RESET=""
  fi

  return 0
}

check_graphql_rate_limit() {
  local min_required="${1:-0}"

  if ! get_graphql_rate_limit; then
    echo "Warning: GraphQLレートリミット情報を取得できませんでした。レート超過検知ができない可能性があります。" >&2
    return 0
  fi

  local remaining="$GRAPHQL_RATE_LIMIT_REMAINING"
  local reset="$GRAPHQL_RATE_LIMIT_RESET"

  if [[ "$remaining" =~ ^[0-9]+$ ]]; then
    if [ "$remaining" -le 0 ]; then
      local human
      human="$(format_epoch "$reset")"
      if [ -n "$human" ]; then
        echo "Error: GitHub GraphQL APIのレートリミットが枯渇しています。リセット予定: $human (epoch: $reset)." >&2
      else
        echo "Error: GitHub GraphQL APIのレートリミットが枯渇しています。リセットEpoch: $reset." >&2
      fi
      echo "gh api rate_limit で残数を確認し、リセット後に再実行してください。" >&2
      exit 2
    elif [ "$remaining" -le "$min_required" ]; then
      local human
      human="$(format_epoch "$reset")"
      if [ -n "$human" ]; then
        echo "Error: GraphQL API残りコール数が不足しています (remaining=$remaining)。リセット予定: $human (epoch: $reset)。" >&2
      else
        echo "Error: GraphQL API残りコール数が不足しています (remaining=$remaining, reset_epoch=$reset)。" >&2
      fi
      echo "必要な呼び出し枠が確保できてから再実行してください。" >&2
      exit 2
    elif [ "$remaining" -lt 20 ]; then
      local human
      human="$(format_epoch "$reset")"
      if [ -n "$human" ]; then
        echo "Warning: GraphQL API 残り呼び出しが少なくなっています (remaining=$remaining, reset=$human)." >&2
      else
        echo "Warning: GraphQL API 残り呼び出しが少なくなっています (remaining=$remaining, reset_epoch=$reset)." >&2
      fi
    fi
  fi
}

ensure_github_token() {
  if [ -z "${GH_TOKEN:-}" ]; then
    if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
      export GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"
    elif [ -n "${GITHUB_TOKEN:-}" ]; then
      export GH_TOKEN="$GITHUB_TOKEN"
    fi
  fi
}

queue_initialize() {
  ensure_github_token

  GRAPHQL_RATE_LIMIT_REMAINING=""
  GRAPHQL_RATE_LIMIT_RESET=""

  load_projects_v2_config
  check_graphql_rate_limit 10
  ensure_project_setup
  check_graphql_rate_limit

  local repo_json
  repo_json="$(gh repo view --json owner,name)"
  repo_owner="$(echo "$repo_json" | jq -r '.owner.login')"
  repo_name="$(echo "$repo_json" | jq -r '.name')"

  project_number="${PROJECT_V2_NUMBER:-}"
  if [ -z "$project_number" ]; then
    echo "Error: PROJECT_V2_NUMBER is not set. 環境変数を設定してから再実行してください。" >&2
    exit 1
  fi

  project_owner="${PROJECT_V2_OWNER:-$repo_owner}"
  project_enabled=0
  project_id=""
  dep_field_name="${PROJECT_DEPENDS_FIELD:-Depends on}"
  dep_field_id=""

  local project_json
  project_json="$(gh project view "$project_number" --owner "$project_owner" --format json 2>/dev/null || true)"
  project_id="$(echo "$project_json" | jq -r '.id // empty' || true)"
  if [ -n "$project_id" ]; then
    local fields_json
    fields_json="$(gh project field-list "$project_number" --owner "$project_owner" --format json)"
    dep_field_id="$(echo "$fields_json" | jq -r --arg name "$dep_field_name" '.fields[] | select(.name == $name) | .id' || true)"
    if [ -n "$dep_field_id" ]; then
      project_enabled=1
    else
      echo "Warning: project field '$dep_field_name' not found. Falling back to body-based dependency parsing." >&2
    fi
  else
    echo "Warning: project $project_owner/$project_number not accessible. Falling back to body-based dependency parsing." >&2
  fi
}

extract_dep_ids() {
  local raw="$1"
  if [ -z "$raw" ]; then
    return 0
  fi

  printf '%s\n' "$raw" \
    | tr ',;' '\n' \
    | grep -oE '#?[0-9]+' \
    | tr -d '# ' \
    | sed '/^$/d' || true
}

project_dependencies() {
  local issue_number="$1"
  if [ "${project_enabled:-0}" -ne 1 ]; then
    return 0
  fi

  local response
  response="$(gh api graphql \
    -F owner="$repo_owner" \
    -F name="$repo_name" \
    -F number="$issue_number" \
    -F fieldName="$dep_field_name" \
    -f query='query ($owner:String!, $name:String!, $number:Int!, $fieldName:String!) {
      repository(owner:$owner, name:$name) {
        issue(number:$number) {
          projectItems(first: 20) {
            nodes {
              project { number }
              fieldValueByName(name: $fieldName) {
                __typename
                ... on ProjectV2ItemFieldTextValue { text }
                ... on ProjectV2ItemFieldSingleSelectValue { name }
                ... on ProjectV2ItemFieldNumberValue { number }
              }
            }
          }
        }
      }
    }' 2>/dev/null || true)"

  if [ -z "$response" ]; then
    return 0
  fi

  printf '%s' "$response" \
    | jq -r --argjson projectNumber "$project_number" '
        (.data.repository.issue.projectItems.nodes // [])[]
        | select(.project.number == $projectNumber)
        | .fieldValueByName
        | select(. != null)
        | if has("text") and (.text // null) then .text
          elif has("name") and (.name // null) then .name
          elif has("number") and (.number // null) then (.number | tostring)
          else empty
          end
      ' || true
}
