#!/bin/bash
# Checks whether core.hooksPath is configured for auto GitHub sync.
# If not, runs setup-git-hooks.sh to self-heal.
# Called automatically at dev startup so fresh workspaces never silently miss pushes.

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

CONFIGURED=$(git config --get core.hooksPath 2>/dev/null || true)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED="${SCRIPT_DIR}/git-hooks"

if [ "$CONFIGURED" != "$EXPECTED" ]; then
  echo "[check-git-hooks] WARNING: core.hooksPath is not set — auto GitHub sync will not work." >&2
  echo "[check-git-hooks] Running setup-git-hooks.sh to activate..." >&2
  bash "${SCRIPT_DIR}/setup-git-hooks.sh"
fi
