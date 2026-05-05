#!/bin/bash
# Pushes the current branch to GitHub using GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN.
# Called automatically by the post-commit hook after every Replit checkpoint commit.

set -e

# Support both token names
TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "[github-sync] No GitHub token found (GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN) — skipping push." >&2
  exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
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
  push origin "${BRANCH}:${BRANCH}" --force-with-lease --quiet

rm -f "$HELPER_SCRIPT"
echo "[github-sync] Done."
