#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== xDisputer safe sync + guard ==="
echo "Working directory: $ROOT"

if [[ -n "$(git status --short)" ]]; then
  echo "Local changes detected. Stashing them before sync."
  git status --short
  git stash push -u -m "safe-sync-guard auto stash $(date -u +%Y-%m-%dT%H:%M:%SZ)"
else
  echo "No local changes detected."
fi

git fetch origin main
git pull --rebase origin main

npm ci
npm run xdisputer:guard

echo "Safe sync guard passed."
echo "If a stash was created and you need it, inspect with: git stash list"
