#!/bin/bash
set -e

echo "[post-merge] Installing npm dependencies..."
npm install --ignore-scripts --silent

echo "[post-merge] Configuring git hooks..."
bash "$(dirname "$0")/setup-git-hooks.sh"

echo "[post-merge] Done."
