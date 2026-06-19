#!/usr/bin/env bash
# create_issues.sh
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

# 必須ラベルを事前に用意する（存在しない場合は作成）
ensure_required_labels() {
  local labels_json
  labels_json="$(gh label list --json name --limit 200 2>/dev/null || echo '[]')"

  ensure_label() {
    local label_name="$1"
    local label_color="$2"
    local label_description="$3"

    if printf '%s' "$labels_json" | jq -e --arg name "$label_name" 'map(.name) | index($name)' >/dev/null 2>&1; then
      return 0
    fi

    if gh label create "$label_name" --color "$label_color" --description "$label_description" >/dev/null 2>&1; then
      labels_json="$(printf '%s' "$labels_json" | jq --arg name "$label_name" '[.[]] + [{"name": $name}]')"
    else
      echo "Warning: failed to create label '$label_name'. Please create it manually." >&2
    fi
  }

  ensure_label "ready" "6e7781" "Issue is ready to be picked up"
  ensure_label "in_progress" "0969da" "Issue is currently being worked on"
  ensure_label "blocked" "cf222e" "Issue is blocked and needs attention"
  ensure_label "done" "1a7f37" "Issue has been completed"
}

# Ensure lowercase slug lookups and output
ensure_required_labels

# 期待入力: tasks.json = [{"title":"...", "body":"...","labels":["ready"]}, ...]
FILE="${1:-tasks.json}"

repo_json="$(gh repo view --json owner,name)"
REPO_OWNER="$(echo "$repo_json" | jq -r '.owner.login')"
REPO_NAME="$(echo "$repo_json" | jq -r '.name')"
REPO_ISSUE_URL_BASE="https://github.com/$REPO_OWNER/$REPO_NAME/issues"

SUPPORTS_ISSUE_JSON=0
if gh issue create --help 2>&1 | grep -q -- '--json'; then
  SUPPORTS_ISSUE_JSON=1
fi

if [ ! -f "$FILE" ]; then
  echo "tasks file not found: $FILE" >&2
  exit 1
fi

project_number="${PROJECT_V2_NUMBER:-}"
project_owner="${PROJECT_V2_OWNER:-}"
project_enabled=0
project_id=""
dep_field_id=""
status_field_id=""
status_ready_option_id=""
repo_owner="${REPO_OWNER}"
repo_name="${REPO_NAME}"

slug_map_file="$(mktemp /tmp/p2-slug-map.XXXXXX)"
trap 'rm -f "$slug_map_file"' EXIT

slug_map_set() {
  local slug="$1"
  local issue="$2"
  if [ -z "$slug" ] || [ -z "$issue" ]; then
    return 0
  fi
  printf '%s|%s\n' "$slug" "$issue" >> "$slug_map_file"
}

slug_map_get() {
  local slug="$1"
  awk -F'|' -v key="$slug" '$1 == key {value = $2} END {if (value) printf "%s", value}' "$slug_map_file"
}

if [ -n "$project_number" ]; then
  repo_json="$(gh repo view --json owner,name)"
  repo_owner="$(echo "$repo_json" | jq -r '.owner.login')"
  repo_name="$(echo "$repo_json" | jq -r '.name')"

  if [ -z "$project_owner" ]; then
    project_owner="$repo_owner"
  fi

  project_json="$(gh project view "$project_number" --owner "$project_owner" --format json)"
  project_id="$(echo "$project_json" | jq -r '.id // empty' || true)"

  if [ -n "$project_id" ]; then
    field_json="$(gh project field-list "$project_number" --owner "$project_owner" --format json)"
    dep_field_id="$(echo "$field_json" | jq -r --arg name "${PROJECT_DEPENDS_FIELD:-Depends on}" '.fields[] | select(.name == $name) | .id' || true)"

    status_field="$(echo "$field_json" | jq --arg name "${PROJECT_STATUS_FIELD:-Status}" '.fields[] | select(.name == $name)' || true)"
    status_field_id="$(echo "$status_field" | jq -r '.id // empty' || true)"

    if [ -n "$status_field_id" ]; then
      status_ready_name="${PROJECT_STATUS_READY_OPTION:-Todo}"
      status_ready_option_id="$(echo "$status_field" | jq -r --arg name "$status_ready_name" '.options[] | select(.name == $name) | .id' || true)"

      if [ -z "$status_ready_option_id" ]; then
        echo "Warning: status option '$status_ready_name' not found in project; status initialisation will be skipped." >&2
      fi
    else
      echo "Warning: project status field '${PROJECT_STATUS_FIELD:-Status}' not found; status initialisation will be skipped." >&2
    fi

    project_enabled=1
  else
    echo "Warning: project number '$project_number' not found for owner '$project_owner'; project syncing skipped." >&2
  fi
fi

ensure_project_item() {
  local issue_number="$1"
  if [ "$project_enabled" -ne 1 ]; then
    return 0
  fi

  local existing_id
  existing_id="$(gh api graphql \
    -F owner="$repo_owner" \
    -F name="$repo_name" \
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
    --argjson projectNumber "$project_number" \
    --jq '(.data.repository.issue.projectItems.nodes // [])[] | select(.project.number == $projectNumber) | .id' \
    2>/dev/null || true)"

  if [ -n "$existing_id" ]; then
    printf '%s' "$existing_id"
    return 0
  fi

  local item_json
  item_json="$(gh project item-add "$project_number" --owner "$project_owner" --url "$REPO_ISSUE_URL_BASE/$issue_number" --format json 2>/dev/null || true)"
  printf '%s' "$item_json" | jq -r '.id // empty' || true
}

update_dep_field() {
  local issue_number="$1"
  local value="$2"

  if [ -z "$dep_field_id" ] || [ -z "$value" ]; then
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
    --project-id "$project_id" \
    --field-id "$dep_field_id" \
    --text "$value" \
    >/dev/null
}

len=$(jq 'length' "$FILE")
for i in $(seq 0 $((len-1))); do
  slug=$(jq -r ".[$i].slug // empty" "$FILE")
  existing=$(jq -r ".[$i].existing_issue_number // empty" "$FILE")
  if [ -n "$slug" ] && [ "$slug" != "null" ] && [ -n "$existing" ] && [ "$existing" != "null" ]; then
    slug_map_set "$slug" "$existing"
  fi
done


echo "creating $len issues..."

for i in $(seq 0 $((len-1))); do
  title=$(jq -r ".[$i].title" "$FILE")
  body=$(jq -r ".[$i].body" "$FILE")
  labels=$(jq -r ".[$i].labels | join(\",\") // \"\"" "$FILE")
  slug=$(jq -r ".[$i].slug // empty" "$FILE")
  existing=$(jq -r ".[$i].existing_issue_number // empty" "$FILE")

  [ "$body" = "null" ] && body=""

  # --label オプションを複数扱うために配列を構築
  IFS=',' read -r -a raw_label_array <<< "${labels:-}"
  label_args=()
  cleaned_labels=()
  for label in "${raw_label_array[@]}"; do
    if [ -z "$label" ]; then
      continue
    fi
    label_trimmed=$(printf '%s' "$label" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
    if [ -n "$label_trimmed" ]; then
      label_args+=("--label" "$label_trimmed")
      cleaned_labels+=("$label_trimmed")
    fi
  done

  add_label_csv=""
  if [ ${#cleaned_labels[@]} -gt 0 ]; then
    add_label_csv=$(IFS=','; printf '%s' "${cleaned_labels[*]}")
  fi

  # Keep a CSV copy of the cleaned labels so we can reapply them during edits without inducing duplicates.

  issue_number=""
  issue_url=""
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    issue_number="$existing"
    issue_url="$REPO_ISSUE_URL_BASE/$issue_number"
    echo "updating existing issue #$issue_number: $title"

    edit_args=("$issue_number" "--title" "$title")
    body_file=""
    if [ -n "$body" ]; then
      body_file=$(mktemp /tmp/gh-issue-body.XXXXXX)
      printf '%s' "$body" > "$body_file"
      edit_args+=("--body-file" "$body_file")
    fi
    if [ -n "$add_label_csv" ]; then
      edit_args+=("--add-label" "$add_label_csv")
    fi

    gh issue edit "${edit_args[@]}" >/dev/null
    if [ -n "$body_file" ]; then
      rm -f "$body_file"
    fi
  else
    if [ "$SUPPORTS_ISSUE_JSON" -eq 1 ]; then
      issue_json=$(gh issue create --title "$title" --body "$body" "${label_args[@]}" --json number,url,id)
      issue_number=$(echo "$issue_json" | jq -r '.number')
      issue_url=$(echo "$issue_json" | jq -r '.url')
    else
      output=$(gh issue create --title "$title" --body "$body" "${label_args[@]}")
      issue_url=$(printf '%s\n' "$output" | grep -Eo 'https://github.com/[^ ]+/issues/[0-9]+' | tail -n1)
      if [ -z "$issue_url" ]; then
        echo "$output" >&2
        echo "Error: issue URL not detected. Please update GitHub CLI or create the issue manually." >&2
        exit 1
      fi
      issue_number="${issue_url##*/}"
    fi
    echo "created issue #$issue_number: $title"
  fi

  if [ -n "$slug" ]; then
    slug_map_set "$slug" "$issue_number"
  fi

  if [ "$project_enabled" -eq 1 ]; then
    item_id="$(ensure_project_item "$issue_number")"
    if [ -n "$item_id" ] && [ -n "$status_field_id" ] && [ -n "$status_ready_option_id" ]; then
      gh project item-edit --id "$item_id" --project-id "$project_id" --field-id "$status_field_id" --single-select-option-id "$status_ready_option_id" >/dev/null
    fi
  fi
done

if [ "$project_enabled" -eq 1 ] && [ -n "$dep_field_id" ]; then
  for i in $(seq 0 $((len-1))); do
    slug=$(jq -r ".[$i].slug // empty" "$FILE")
    issue_number="$(slug_map_get "$slug")"
    if [ -z "$issue_number" ]; then
      continue
    fi

    dep_slugs_raw=$(jq -r ".[$i].depends_on_slugs // [] | .[]" "$FILE" 2>/dev/null || true)
    dep_refs=()
    if [ -n "$dep_slugs_raw" ]; then
      while IFS= read -r dep_slug; do
        slug_key="${dep_slug#"#"}"
        slug_key="$(printf '%s' "$slug_key" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
        dep_issue="$(slug_map_get "$slug_key")"
        if [ -n "$dep_issue" ]; then
          dep_refs+=("#$dep_issue")
        else
          echo "Warning: dependency slug '$dep_slug' for issue #$issue_number is unresolved." >&2
        fi
      done <<EOF
$dep_slugs_raw
EOF
    fi

    if [ "${#dep_refs[@]}" -gt 0 ]; then
      final_deps="${dep_refs[0]}"
      for dep_ref in "${dep_refs[@]:1}"; do
        final_deps="${final_deps}, $dep_ref"
      done
      update_dep_field "$issue_number" "$final_deps"
      continue
    fi

    body=$(jq -r ".[$i].body" "$FILE")
    deps_line=$(printf '%s\n' "$body" | grep -Ei '^Depends-on:' | head -n 1 || true)
    dep_text=$(printf '%s' "$deps_line" | sed -E 's/^Depends-on:[[:space:]]*//')
    dep_text_trimmed=$(echo "$dep_text" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')

    if [ -n "$dep_text_trimmed" ]; then
      update_dep_field "$issue_number" "$dep_text_trimmed"
    fi
  done
fi
