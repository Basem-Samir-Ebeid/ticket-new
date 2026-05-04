#!/bin/bash
# Pushes the current branch to GitHub using GITHUB_TOKEN for authentication.
# Called automatically by the post-commit hook after every Replit checkpoint commit.

set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[github-sync] GITHUB_TOKEN is not set — skipping push to GitHub." >&2
  exit 0
fi

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/Basem-Samir-Ebeid/ticket-new.git"
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")

echo "[github-sync] Pushing branch '${BRANCH}' to GitHub..."
git push "$REMOTE_URL" "${BRANCH}:${BRANCH}" --force --quiet
echo "[github-sync] Done."
