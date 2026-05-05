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

write_status() {
  local result="$1"
  local message="$2"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  printf '[%s] %s: %s\n' "$ts" "$result" "$message" > "$STATUS_FILE"
}

# Support both token names
TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "[github-sync] No GitHub token found (GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN) — skipping push." >&2
  write_status "SKIPPED" "No GitHub token configured"
  exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")

# If a specific branch is configured, skip silently when HEAD is on a different branch
if [ -n "$GITHUB_SYNC_BRANCH" ] && [ "$BRANCH" != "$GITHUB_SYNC_BRANCH" ]; then
  write_status "SKIPPED" "Branch '${BRANCH}' does not match GITHUB_SYNC_BRANCH='${GITHUB_SYNC_BRANCH}'"
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

if [ $PUSH_EXIT -ne 0 ]; then
  echo "[github-sync] ERROR: Push failed (exit ${PUSH_EXIT}): ${PUSH_ERROR}" >&2
  write_status "FAILED" "Push of '${BRANCH}' failed (exit ${PUSH_EXIT}): ${PUSH_ERROR}"
  exit $PUSH_EXIT
fi

echo "[github-sync] Done."
write_status "SUCCESS" "Branch '${BRANCH}' pushed to ${SAFE_REMOTE_URL}"
