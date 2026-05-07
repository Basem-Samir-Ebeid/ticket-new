#!/bin/bash
# Configures git to use the tracked hooks in scripts/git-hooks/.
# Run this script once to activate automatic GitHub sync on every commit.
# It is also called automatically by scripts/post-merge.sh after each task merge.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_SRC="${SCRIPT_DIR}/git-hooks"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[setup-git-hooks] Not inside a git work tree — skipping." >&2
  exit 0
fi

# Make all hooks in the tracked directory executable.
chmod +x "${HOOKS_SRC}"/*

# Point git at the tracked hooks directory so hooks survive fresh clones.
git config core.hooksPath "${HOOKS_SRC}"
echo "[setup-git-hooks] core.hooksPath set to ${HOOKS_SRC}"

# Also copy into .git/hooks/ as a fallback for tools that bypass core.hooksPath.
if [ -d ".git/hooks" ]; then
  cp "${HOOKS_SRC}/post-commit" ".git/hooks/post-commit"
  chmod +x ".git/hooks/post-commit"
  echo "[setup-git-hooks] post-commit hook copied to .git/hooks/post-commit"
fi
