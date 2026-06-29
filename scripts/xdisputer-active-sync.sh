#!/usr/bin/env bash
set -Eeuo pipefail

# xDisputer active sync runner.
# Purpose:
#   - bind every local/Codespace run to Arisu-art/xDisputer main
#   - reset or stash local modifications intentionally
#   - verify Supabase/connector contracts before build
#   - keep database push explicit

RESET_LOCAL=false
STASH_LOCAL=false
SYNC_DB=false
VERIFY=false
STRICT_ENV=false
SHIP=false

print_help() {
  cat <<'HELP'
xDisputer active sync

Recommended:
  npm run active:sync -- --reset-local --verify
  npm run active:sync:db
  npm run active:sync -- --reset-local --sync-db --verify --strict-env

Options:
  --reset-local  Discard tracked local modifications and clean known generated caches before pulling main.
  --stash-local  Stash local modifications before pulling main.
  --sync-db      Run Supabase migration status and `supabase db push`.
  --verify       Run the full xDisputer guard after sync.
  --strict-env   Fail when local runtime env files are missing required public keys.
  --ship         Run deployment scripts only if they exist in package.json.
  -h, --help     Show this help text.
HELP
}

for arg in "$@"; do
  case "$arg" in
    --reset-local) RESET_LOCAL=true ;;
    --stash-local) STASH_LOCAL=true ;;
    --sync-db) SYNC_DB=true ;;
    --verify) VERIFY=true ;;
    --strict-env) STRICT_ENV=true ;;
    --ship) SHIP=true ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $arg" >&2
      print_help >&2
      exit 2
      ;;
  esac
done

if [[ "$RESET_LOCAL" == true && "$STASH_LOCAL" == true ]]; then
  echo "ERROR: Use either --reset-local or --stash-local, not both." >&2
  exit 2
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

EXPECTED_REMOTE_KEY='github.com/arisu-art/xdisputer'
EXPECTED_BRANCH='main'

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

has_npm_script() {
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)" "$1" >/dev/null 2>&1
}

normalize_remote_url() {
  local value="$1"

  value="${value%/}"
  value="${value%.git}"
  value="${value#https://}"
  value="${value#http://}"
  value="${value#ssh://}"
  value="${value#git://}"
  value="${value#git@}"
  value="${value#*@}"
  value="${value/:/\/}"
  value="${value%/}"

  printf '%s' "$value" | tr '[:upper:]' '[:lower:]'
}

need_command git
need_command npm
need_command tr

log "xDisputer active sync started"
log "Root: $ROOT_DIR"

if [[ ! -d .git ]]; then
  fail "This command must be run from inside the xDisputer Git repository."
fi

remote_url="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$remote_url" ]]; then
  fail "Git remote origin is missing. Reconnect origin to https://github.com/Arisu-art/xDisputer.git"
fi

remote_key="$(normalize_remote_url "$remote_url")"
if [[ "$remote_key" != "$EXPECTED_REMOTE_KEY" ]]; then
  fail "Refusing to sync unexpected remote: $remote_url. Expected Arisu-art/xDisputer from github.com."
fi
log "Git remote verified: $remote_url"

current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$current_branch" ]]; then
  fail "Detached HEAD detected. Checkout main before running active sync."
fi

if [[ "$current_branch" != "$EXPECTED_BRANCH" ]]; then
  log "Switching from '$current_branch' to '$EXPECTED_BRANCH'"
  git fetch origin "$EXPECTED_BRANCH" --prune
  git checkout "$EXPECTED_BRANCH"
fi

if [[ -n "$(git status --short)" ]]; then
  log "Local modifications detected:"
  git status --short

  if [[ "$RESET_LOCAL" == true ]]; then
    log "Resetting tracked local modifications and known generated caches."
    git restore --source=HEAD --staged --worktree .
    git clean -fd -- .next .turbo node_modules/.cache .local-backups
  elif [[ "$STASH_LOCAL" == true ]]; then
    stash_name="xdisputer-active-sync auto stash $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    log "Stashing local modifications as: $stash_name"
    git stash push -u -m "$stash_name"
  else
    fail "Local modifications exist. Re-run with --stash-local to preserve them or --reset-local to discard them."
  fi
else
  log "No local modifications detected."
fi

log "Fetching and rebasing latest main"
git fetch origin "$EXPECTED_BRANCH" --prune
git pull --rebase origin "$EXPECTED_BRANCH"

log "Installing locked dependencies"
npm ci

log "Running connection inheritance and environment doctor"
if [[ "$STRICT_ENV" == true ]]; then
  npm run connections:doctor -- --strict-env
else
  npm run connections:doctor
fi

if [[ "$SYNC_DB" == true ]]; then
  need_command supabase
  log "Checking Supabase project link and migration status"
  supabase status
  supabase migration list

  log "Applying pending Supabase migrations"
  supabase db push

  log "Re-checking connection contracts after database push"
  if [[ "$STRICT_ENV" == true ]]; then
    npm run connections:doctor -- --strict-env
  else
    npm run connections:doctor
  fi
else
  log "Database push skipped. Add --sync-db only after confirming the linked Supabase target."
fi

if [[ "$VERIFY" == true ]]; then
  log "Running full xDisputer guard"
  npm run xdisputer:guard
else
  log "Build guard skipped. Add --verify to run the full xDisputer guard."
fi

if [[ "$SHIP" == true ]]; then
  log "Deployment request received"
  if has_npm_script vercel:status && has_npm_script vercel:direct && has_npm_script verify:production:wait; then
    npm run vercel:status || {
      npm run vercel:direct
      npm run verify:production:wait
    }
  else
    fail "Deployment scripts are not wired in package.json; deployment remains paused/out of scope."
  fi
fi

log "Active sync completed."
log "Expected state: main is current, dependencies are locked, connection inheritance passes, optional Supabase migrations are applied, and verification status is known."

if git stash list | grep -q 'xdisputer-active-sync auto stash'; then
  log "A safety stash exists. Inspect it with: git stash list"
fi
