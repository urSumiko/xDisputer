#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
BRANCH="${XDISPUTER_PREVIEW_BRANCH:-main}"
VISIBILITY="${CODESPACES_PORT_VISIBILITY:-public}"

cd "$(git rev-parse --show-toplevel)"

echo "== xDisputer Codespaces synced live preview =="
echo "Branch: $BRANCH"
echo "Port:   $PORT"

if [ -n "$(git status --porcelain)" ]; then
  git stash push -u -m "codespaces preview autosave $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
rm -rf .next
npm ci

node scripts/repair-letter-workspace-syntax.mjs
node scripts/repair-letter-workspace-contracts.mjs
node scripts/repair-letter-workspace-blob-boundaries.mjs
node scripts/repair-letter-workspace-header-chip.mjs

if ! grep -q "OutputLimitResetChip" components/LetterGeneratorWorkspaceV2.tsx; then
  echo "ERROR: OutputLimitResetChip is still missing from LetterGeneratorWorkspaceV2.tsx after repair." >&2
  exit 1
fi

if [ -n "${CODESPACE_NAME:-}" ]; then
  if command -v gh >/dev/null 2>&1; then
    gh codespace ports visibility "$PORT:$VISIBILITY" -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
  fi
  echo ""
  echo "Open live preview:"
  echo "https://${CODESPACE_NAME}-${PORT}.app.github.dev/workspace"
else
  echo ""
  echo "Open live preview:"
  echo "http://localhost:${PORT}/workspace"
fi

echo ""
echo "This preview hot-reloads saved UI edits instantly. Keep this terminal running."
echo "Stop with Ctrl+C."

exec npx next dev -H 0.0.0.0 -p "$PORT"
