#!/bin/bash
# Pushes the current branch to GitHub using GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN.
# Called automatically by the post-commit hook after every Replit checkpoint commit.
#
# Optional environment variable:
#   GITHUB_SYNC_BRANCH — when set, only that branch is synced to GitHub.
#                        If the current HEAD branch does not match, the push
#                        is skipped silently. When unset, the current branch
#                        is always synced (original behaviour).

set -e

# Support both token names
TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "[github-sync] No GitHub token found (GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN) — skipping push." >&2
  exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")

# If a specific branch is configured, skip silently when HEAD is on a different branch
if [ -n "$GITHUB_SYNC_BRANCH" ] && [ "$BRANCH" != "$GITHUB_SYNC_BRANCH" ]; then
  exit 0
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
  echo "[github-sync] No 'origin' remote found — skipping push." >&2
  exit 0
fi

HELPER_SCRIPT=$(mktemp /tmp/git-credential-XXXXXX)
chmod 700 "$HELPER_SCRIPT"
cat > "$HELPER_SCRIPT" << HELPER
#!/bin/bash
echo "username=x-token-auth"
echo "password=${TOKEN}"
HELPER

echo "[github-sync] Pushing branch '${BRANCH}' to origin (${REMOTE_URL})..."
git \
  -c "credential.helper=${HELPER_SCRIPT}" \
  push origin "${BRANCH}:${BRANCH}" --force --quiet

rm -f "$HELPER_SCRIPT"
echo "[github-sync] Done."
