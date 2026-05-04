#!/bin/bash
set -e

echo "[post-merge] Installing npm dependencies..."
npm install --silent

echo "[post-merge] Re-installing git hooks..."
bash scripts/setup-git-hooks.sh

echo "[post-merge] Done."
