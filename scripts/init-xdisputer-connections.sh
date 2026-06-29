#!/usr/bin/env bash
set -Eeuo pipefail

# xDisputer connection initializer
# Purpose: reset/sync the active Codespace clone, pull Vercel production env, inspect Supabase linkage,
# and run local verification without mutating database data.
# Usage:
#   npm run init:connections
#   npm run init:connections -- --reset-local --verify

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

RESET_LOCAL=false
VERIFY_BUILD=false
SYNC_DB=false

for arg in "$@"; do
  case "$arg" in
    --reset-local) RESET_LOCAL=true ;;
    --verify) VERIFY_BUILD=true ;;
    --sync-db) SYNC_DB=true ;;
    -h|--help)
      cat <<'HELP'
xDisputer connection initializer

Options:
  --reset-local   Discard local uncommitted changes and remove generated build/cache folders.
  --verify        Run typecheck and build after dependency/env sync.
  --sync-db       Run `supabase db push` after local Supabase project validation.
  -h, --help      Show this help.

Safe defaults:
  - Without --reset-local, local uncommitted work is preserved and the script exits if the tree is dirty.
  - Without --sync-db, database changes are not pushed; the script only reports migration status.
HELP
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

log() {
  printf '\n== %s ==\n' "$1"
}

run() {
  printf '▶ %s\n' "$*"
  "$@"
}

on_error() {
  local line_no="$1"
  echo "\n❌ init-xdisputer-connections failed at line ${line_no}." >&2
  echo "Root-cause protocol: read docs/error-ledger.md, fix the first failing command, then rerun this script." >&2
}
trap 'on_error $LINENO' ERR

log "Repository identity"
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
printf 'Root:   %s\n' "$ROOT_DIR"
printf 'Remote: %s\n' "${REMOTE_URL:-missing}"
printf 'Branch: %s\n' "${CURRENT_BRANCH:-detached-or-missing}"

if [[ -z "$REMOTE_URL" ]] || [[ ! "$REMOTE_URL" =~ Arisu-art/xDisputer(.git)?$ ]]; then
  echo "Expected Git remote to resolve to Arisu-art/xDisputer. Refusing to sync the wrong repository." >&2
  exit 3
fi

log "Local change policy"
if [[ "$RESET_LOCAL" == true ]]; then
  echo "Reset requested: generated caches and uncommitted local modifications will be discarded."
  run git restore --source=HEAD --staged --worktree .
  run git clean -fd -- .next .turbo node_modules/.cache .local-backups 2>/dev/null || true
else
  if [[ -n "$(git status --short)" ]]; then
    echo "Local tree has uncommitted changes. Re-run with --reset-local to discard them, or commit/stash first." >&2
    git status --short
    exit 4
  fi
  echo "Local tree is clean."
fi

log "Pull latest main"
run git fetch origin main --prune
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  run git checkout main
fi
run git pull --rebase origin main

log "Dependency sync"
if [[ -f package-lock.json ]]; then
  run npm ci
else
  run npm install
fi

log "Vercel production environment sync"
if command -v npx >/dev/null 2>&1; then
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    run npx --yes vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
  else
    echo "VERCEL_TOKEN is not exported. Trying Vercel CLI with the current logged-in Codespace/session."
    run npx --yes vercel pull --yes --environment=production
  fi
else
  echo "npx is unavailable; install Node/npm before running Vercel sync." >&2
  exit 5
fi

log "Supabase local/project sync check"
if command -v supabase >/dev/null 2>&1; then
  run supabase status || true
  run supabase migration list || true
  if [[ "$SYNC_DB" == true ]]; then
    run supabase db push
  else
    echo "Database push skipped. Use --sync-db only after reviewing pending migrations."
  fi
else
  echo "Supabase CLI is not installed in this shell. Install it or use the SQL block in docs/xdisputer-connection-validation.sql."
fi

log "Environment contract check"
node --input-type=module <<'NODE'
import { existsSync, readFileSync } from 'node:fs';

const candidates = ['.env.local', '.vercel/.env.production.local', '.env.example'];
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SITE_URL'];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  const missing = required.filter((key) => !new RegExp(`^${key}=`, 'm').test(text));
  console.log(`${file}: ${missing.length ? `missing ${missing.join(', ')}` : 'ok'}`);
}
NODE

if [[ "$VERIFY_BUILD" == true ]]; then
  log "Local verification"
  run npm run typecheck
  run npm run build
else
  log "Verification skipped"
  echo "Use --verify to run npm run typecheck and npm run build after sync."
fi

log "Expected active state"
echo "Repo is on main, dependencies are installed, Vercel production env is pulled, and Supabase linkage/migrations were inspected."
echo "Next: run SQL validation in docs/xdisputer-connection-validation.sql, then npm run xdisputer:guard before shipping."
