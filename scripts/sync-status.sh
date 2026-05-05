#!/bin/bash
# Prints the effective sync configuration without performing any push.
# Shows which branch would be synced and whether GITHUB_SYNC_BRANCH is set.

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")

echo "[github-sync] Dry-run status check"
echo "-----------------------------------"

if [ -n "$GITHUB_SYNC_BRANCH" ]; then
  echo "GITHUB_SYNC_BRANCH : set to '${GITHUB_SYNC_BRANCH}'"
else
  echo "GITHUB_SYNC_BRANCH : not set (current branch will always be synced)"
fi

echo "Current branch     : ${CURRENT_BRANCH}"

if [ -n "$GITHUB_SYNC_BRANCH" ]; then
  if [ "$CURRENT_BRANCH" = "$GITHUB_SYNC_BRANCH" ]; then
    echo "Effective action   : WOULD PUSH '${CURRENT_BRANCH}' to origin"
  else
    echo "Effective action   : WOULD SKIP (current branch '${CURRENT_BRANCH}' does not match '${GITHUB_SYNC_BRANCH}')"
  fi
else
  echo "Effective action   : WOULD PUSH '${CURRENT_BRANCH}' to origin"
fi

TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"
if [ -z "$TOKEN" ]; then
  echo "Token              : NOT configured (push would be skipped)"
else
  echo "Token              : configured"
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$REMOTE_URL" ]; then
  SAFE_REMOTE_URL=$(echo "$REMOTE_URL" | sed 's|://[^@]*@|://|')
  echo "Remote (origin)    : ${SAFE_REMOTE_URL}"
else
  echo "Remote (origin)    : NOT configured (push would be skipped)"
fi
