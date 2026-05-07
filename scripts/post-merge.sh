#!/bin/bash
set -e

echo "[post-merge] Installing npm dependencies..."
npm install --ignore-scripts --silent

echo "[post-merge] Done."
