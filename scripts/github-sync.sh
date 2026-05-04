#!/bin/bash
# Pushes the current branch to GitHub using GITHUB_TOKEN for authentication.
# Called automatically by the post-commit hook after every Replit checkpoint commit.

set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[github-sync] GITHUB_TOKEN is not set — skipping push to GitHub." >&2
  exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
  echo "[github-sync] No 'origin' remote found — skipping push." >&2
  exit 0
fi

# Inject the token via a transient credential helper so it never appears in
# process arguments or git log output.
HELPER_SCRIPT=$(mktemp /tmp/git-credential-XXXXXX)
chmod 700 "$HELPER_SCRIPT"
cat > "$HELPER_SCRIPT" << HELPER
#!/bin/bash
echo "username=x-token-auth"
echo "password=${GITHUB_TOKEN}"
HELPER

echo "[github-sync] Pushing branch '${BRANCH}' to origin (${REMOTE_URL})..."
git \
  -c "credential.helper=${HELPER_SCRIPT}" \
  push origin "${BRANCH}:${BRANCH}" --force-with-lease --quiet

rm -f "$HELPER_SCRIPT"
echo "[github-sync] Done."
