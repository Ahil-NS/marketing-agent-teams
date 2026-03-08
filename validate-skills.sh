#!/usr/bin/env bash
#
# validate-skills.sh - Validate all SKILL.md files
# Standalone bash validator. No npm required.
#

set -euo pipefail

AGENTS_ROOT="${1:-src/agents}"
ERRORS=0
CHECKED=0
VALID_CLUSTERS="intelligence strategy creation optimization quality distribution coordination"

red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }

check_agent() {
  local skill_path="$1"
  local agent_dir
  agent_dir=$(dirname "$skill_path")
  local agent_name
  agent_name=$(basename "$agent_dir")
  local agent_errors=0

  CHECKED=$((CHECKED + 1))

  # Check 1: File exists and is readable
  if [ ! -r "$skill_path" ]; then
    red "  FAIL: Cannot read $skill_path"
    ERRORS=$((ERRORS + 1))
    return
  fi

  # Check 2: YAML front matter exists
  local first_line
  first_line=$(head -1 "$skill_path" | tr -d '[:space:]')
  if [ "$first_line" != "---" ]; then
    red "  FAIL [$agent_name]: Missing YAML front matter (must start with ---)"
    agent_errors=$((agent_errors + 1))
  fi

  # Check 3: Has closing delimiter
  local delimiter_count
  delimiter_count=$(grep -c '^---' "$skill_path" 2>/dev/null || true)
  if [ "$delimiter_count" -lt 2 ]; then
    red "  FAIL [$agent_name]: Missing closing --- delimiter"
    agent_errors=$((agent_errors + 1))
  fi

  # Check 4: Has required field: name
  if ! grep -q '^name:' "$skill_path"; then
    red "  FAIL [$agent_name]: Missing required field 'name'"
    agent_errors=$((agent_errors + 1))
  fi

  # Check 5: Has required field: description
  if ! grep -q '^description:' "$skill_path"; then
    red "  FAIL [$agent_name]: Missing required field 'description'"
    agent_errors=$((agent_errors + 1))
  fi

  # Check 6: Has required field: cluster
  local cluster
  cluster=$(grep '^cluster:' "$skill_path" | head -1 | sed 's/cluster:[[:space:]]*//' | tr -d '[:space:]')
  if [ -z "$cluster" ]; then
    red "  FAIL [$agent_name]: Missing required field 'cluster'"
    agent_errors=$((agent_errors + 1))
  else
    # Check 7: Cluster is valid
    local valid=false
    for vc in $VALID_CLUSTERS; do
      if [ "$cluster" = "$vc" ]; then
        valid=true
        break
      fi
    done
    if [ "$valid" = "false" ]; then
      red "  FAIL [$agent_name]: Invalid cluster '$cluster' (expected: $VALID_CLUSTERS)"
      agent_errors=$((agent_errors + 1))
    fi
  fi

  # Check 8: Description length (extract multi-line description)
  local desc_text
  desc_text=$(sed -n '/^description:/,/^[a-z]/p' "$skill_path" | head -5 | sed 's/^description:[[:space:]]*//' | tr '\n' ' ')
  local desc_words
  desc_words=$(echo "$desc_text" | wc -w | tr -d '[:space:]')
  if [ "$desc_words" -lt 5 ]; then
    yellow "  WARN [$agent_name]: Description too short ($desc_words words, recommended: 5+)"
  fi

  # Check 9: Line count < 500
  local line_count
  line_count=$(wc -l < "$skill_path" | tr -d '[:space:]')
  if [ "$line_count" -ge 500 ]; then
    red "  FAIL [$agent_name]: $line_count lines (limit: 500)"
    agent_errors=$((agent_errors + 1))
  fi

  ERRORS=$((ERRORS + agent_errors))

  if [ "$agent_errors" -eq 0 ]; then
    green "  PASS [$agent_name] ($line_count lines)"
  fi
}

echo "Validating SKILL.md files in $AGENTS_ROOT..."
echo ""

# Find and validate all SKILL.md files
while IFS= read -r -d '' skill_file; do
  check_agent "$skill_file"
done < <(find "$AGENTS_ROOT" -name "SKILL.md" -print0 | sort -z)

echo ""
echo "---"
echo "Checked: $CHECKED agents"
if [ "$ERRORS" -eq 0 ]; then
  green "Result: All agents valid"
  exit 0
else
  red "Result: $ERRORS error(s) found"
  exit 1
fi
