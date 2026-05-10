#!/bin/bash
set -e

TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set"
  exit 1
fi

REPO_URL="https://${TOKEN}@github.com/Basem-Samir-Ebeid/ticket-new.git"

git remote set-url origin "$REPO_URL"
git push origin main
echo "Done: pushed to GitHub successfully"
