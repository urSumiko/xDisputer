#!/usr/bin/env bash
set -Eeuo pipefail

# xDisputer active reset + sync runner
# Safe by default:
#   - stashes local changes before syncing
#   - never discards uncommitted work unless RESET_UNCOMMITTED=1 is explicitly set
#   - keeps the project bound to GitHub Codespaces + Supabase/local validation only
#
# Usage:
#   bash scripts/xdisputer-active-reset-sync.sh
#   RESET_UNCOMMITTED=1 bash scripts/xdisputer-active-reset-sync.sh
#   SUPABASE_PUSH=1 bash scripts/xdisputer-active-reset-sync.sh
#   RESET_UNCOMMITTED=1 SUPABASE_PUSH=1 bash scripts/xdisputer-active-reset-sync.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REQUIRED_REMOTE_PATTERN='Arisu-art/xDisputer(?:\.git)?$'
EXPECTED_BRANCH='main'
RESET_UNCOMMITTED="${RESET_UNCOMMITTED:-0}"
SUPABASE_PUSH="${SUPABASE_PUSH:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"

log() {
  printf '\n[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

run() {
  printf '+ %q' "$1"
  shift || true
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
  "$@"
}

need_command git
need_command npm

log 'xDisputer active reset + sync started'
log "Repository root: $ROOT"

if [[ ! -d .git ]]; then
  fail 'This command must be run from inside the xDisputer Git repository.'
fi

remote_url="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$remote_url" ]]; then
  fail 'Git remote origin is missing. Reconnect origin to Arisu-art/xDisputer before syncing.'
fi

if [[ ! "$remote_url" =~ $REQUIRED_REMOTE_PATTERN ]]; then
  fail "Refusing to sync unexpected remote: $remote_url"
fi

log "Git remote verified: $remote_url"

current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$current_branch" ]]; then
  fail 'Detached HEAD detected. Checkout main before running this script.'
fi

if [[ "$current_branch" != "$EXPECTED_BRANCH" ]]; then
  log "Switching from branch '$current_branch' to '$EXPECTED_BRANCH'"
  git fetch origin "$EXPECTED_BRANCH" --prune
  git checkout "$EXPECTED_BRANCH"
fi

if [[ -n "$(git status --short)" ]]; then
  log 'Local modifications detected:'
  git status --short

  if [[ "$RESET_UNCOMMITTED" == '1' ]]; then
    log 'RESET_UNCOMMITTED=1 set. Discarding uncommitted changes and local generated caches.'
    git restore --source=HEAD --staged --worktree .
    git clean -fd -- .next .turbo node_modules/.cache .local-backups
  else
    stash_name="xdisputer-active-reset-sync auto stash $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    log "Stashing local modifications as: $stash_name"
    git stash push -u -m "$stash_name"
  fi
else
  log 'No local modifications detected.'
fi

log 'Fetching and rebasing latest main'
git fetch origin "$EXPECTED_BRANCH" --prune
git pull --rebase origin "$EXPECTED_BRANCH"

log 'Installing dependencies from package-lock.json'
npm ci

log 'Running Supabase/env connection doctor'
npm run connections:doctor

if [[ "$SUPABASE_PUSH" == '1' ]]; then
  need_command supabase
  log 'SUPABASE_PUSH=1 set. Checking Supabase status and applying pending migrations.'
  supabase status
  supabase migration list
  supabase db push
  npm run connections:doctor
else
  log 'SUPABASE_PUSH not set. Skipping database push. Run with SUPABASE_PUSH=1 only after confirming the linked Supabase target.'
fi

log 'Running TypeScript validation'
npm run typecheck

if [[ "$SKIP_BUILD" == '1' ]]; then
  log 'SKIP_BUILD=1 set. Skipping production build.'
else
  log 'Running production build validation'
  npm run build
fi

log 'Running full xDisputer guard'
npm run xdisputer:guard

log 'Active reset + sync completed successfully.'
log 'Expected state: main is current, dependencies are clean, Supabase/env contracts pass, typecheck/build/guard pass.'

if git stash list | grep -q 'xdisputer-active-reset-sync auto stash'; then
  log 'A safety stash exists. Inspect it with: git stash list'
fi
