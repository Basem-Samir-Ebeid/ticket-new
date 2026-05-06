#!/bin/bash
# Pushes the current branch to GitHub using GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN.
# Called automatically by the post-commit hook after every Replit checkpoint commit.
#
# Optional environment variable:
#   GITHUB_SYNC_BRANCH — when set, only that branch is synced to GitHub.
#                        If the current HEAD branch does not match, the push
#                        is skipped silently. When unset, the current branch
#                        is always synced (original behaviour).

STATUS_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.github-sync-status"
CONFIG_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/server/github-sync-config.json"

write_status() {
  local result="$1"
  local message="$2"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  printf '[%s] %s: %s\n' "$ts" "$result" "$message" > "$STATUS_FILE"
}

# Read config file values as fallback.
# Uses jq when available; falls back to grep+sed for environments without jq.
CONFIG_TOKEN=""
CONFIG_BRANCH=""
if [ -f "$CONFIG_FILE" ]; then
  if command -v jq >/dev/null 2>&1; then
    CONFIG_TOKEN=$(jq -r '.token // empty' "$CONFIG_FILE" 2>/dev/null || true)
    CONFIG_BRANCH=$(jq -r '.branch // empty' "$CONFIG_FILE" 2>/dev/null || true)
  else
    CONFIG_TOKEN=$(grep '"token"' "$CONFIG_FILE" 2>/dev/null | sed 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || true)
    CONFIG_BRANCH=$(grep '"branch"' "$CONFIG_FILE" 2>/dev/null | sed 's/.*"branch"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || true)
  fi
fi

# Support both env token names, then fall back to config file token
TOKEN="${GITHUB_TOKEN:-${GITHUB_PERSONAL_ACCESS_TOKEN:-$CONFIG_TOKEN}}"

if [ -z "$TOKEN" ]; then
  echo "[github-sync] No GitHub token found (GITHUB_TOKEN, GITHUB_PERSONAL_ACCESS_TOKEN, or config file) — skipping push." >&2
  write_status "SKIPPED" "No GitHub token configured"
  exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")

# Determine the configured sync branch: env var takes priority, then config file
EFFECTIVE_SYNC_BRANCH="${GITHUB_SYNC_BRANCH:-$CONFIG_BRANCH}"

# If a specific branch is configured, skip silently when HEAD is on a different branch
if [ -n "$EFFECTIVE_SYNC_BRANCH" ] && [ "$BRANCH" != "$EFFECTIVE_SYNC_BRANCH" ]; then
  write_status "SKIPPED" "Branch '${BRANCH}' does not match configured sync branch '${EFFECTIVE_SYNC_BRANCH}'"
  exit 0
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
  echo "[github-sync] No 'origin' remote found — skipping push." >&2
  write_status "SKIPPED" "No 'origin' remote configured"
  exit 0
fi

# Strip any embedded credentials (https://user:token@host -> https://host)
SAFE_REMOTE_URL=$(echo "$REMOTE_URL" | sed 's|://[^@]*@|://|')

HELPER_SCRIPT=$(mktemp /tmp/git-credential-XXXXXX)
chmod 700 "$HELPER_SCRIPT"
cat > "$HELPER_SCRIPT" << HELPER
#!/bin/bash
echo "username=x-token-auth"
echo "password=${TOKEN}"
HELPER

echo "[github-sync] Pushing branch '${BRANCH}' to origin (${SAFE_REMOTE_URL})..."

PUSH_ERROR=$(git \
  -c "credential.helper=${HELPER_SCRIPT}" \
  push origin "${BRANCH}:${BRANCH}" --force --quiet 2>&1)
PUSH_EXIT=$?

rm -f "$HELPER_SCRIPT"

notify_failure() {
  local branch="$1"
  local error_msg="$2"
  local secret="${INTERNAL_NOTIFY_SECRET}"
  local port="${PORT:-3000}"

  if [ -z "$secret" ]; then
    echo "[github-sync] WARN: INTERNAL_NOTIFY_SECRET is not set — super_admins will not be notified of this failure." >&2
    return
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "[github-sync] WARN: jq is not installed — cannot send admin failure notification." >&2
    return
  fi

  local payload
  payload=$(jq -n \
    --arg branch "$branch" \
    --arg error "${error_msg:0:200}" \
    '{branch: $branch, error: $error}')

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "http://localhost:${port}/api/internal/github-sync/notify-failure" \
    -H "Content-Type: application/json" \
    -H "x-internal-secret: ${secret}" \
    -d "$payload" 2>/dev/null) || http_code="000"

  if [ "$http_code" != "200" ]; then
    echo "[github-sync] WARN: Failed to notify admins of sync failure (HTTP ${http_code})." >&2
  fi
}

if [ $PUSH_EXIT -ne 0 ]; then
  echo "[github-sync] ERROR: Push failed (exit ${PUSH_EXIT}): ${PUSH_ERROR}" >&2
  write_status "FAILED" "Push of '${BRANCH}' failed (exit ${PUSH_EXIT}): ${PUSH_ERROR}"
  notify_failure "${BRANCH}" "${PUSH_ERROR}"
  exit $PUSH_EXIT
fi

echo "[github-sync] Done."
write_status "SUCCESS" "Branch '${BRANCH}' pushed to ${SAFE_REMOTE_URL}"
