#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

MODE="stash"
VERIFY=false

for arg in "$@"; do
  case "$arg" in
    --stash) MODE="stash" ;;
    --hard) MODE="hard" ;;
    --verify) VERIFY=true ;;
    -h|--help)
      cat <<'HELP'
xDisputer local sync recovery

Use when git pull/rebase is blocked by local staged/uncommitted files.

Modes:
  --stash   Preserve local changes in git stash, then fast-forward main. Default.
  --hard    Create a patch backup, reset local main exactly to origin/main, and remove common accidental root artifacts.
  --verify  Run npm ci and npm run connections:doctor after recovery.

Examples:
  bash scripts/recover-local-sync-blockers.sh --stash --verify
  bash scripts/recover-local-sync-blockers.sh --hard --verify
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

log "Repository check"
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
printf 'Root:   %s\n' "$ROOT_DIR"
printf 'Remote: %s\n' "${REMOTE_URL:-missing}"

if [[ -z "$REMOTE_URL" ]] || [[ ! "$REMOTE_URL" =~ Arisu-art/xDisputer(.git)?$ ]]; then
  echo "Expected origin to be Arisu-art/xDisputer. Refusing to recover the wrong repository." >&2
  exit 3
fi

log "Current local state"
git status --short || true

run git fetch origin main --prune

if [[ "$MODE" == "stash" ]]; then
  if [[ -n "$(git status --short)" ]]; then
    run git stash push -u -m "xdisputer local sync recovery $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  else
    echo "No local changes to stash."
  fi
  run git checkout main
  run git pull --ff-only origin main
else
  BACKUP_DIR=".local-backups/sync-recovery-$(date -u +%Y%m%dT%H%M%SZ)"
  run mkdir -p "$BACKUP_DIR"
  git diff > "$BACKUP_DIR/worktree.patch" || true
  git diff --cached > "$BACKUP_DIR/index.patch" || true
  git status --short > "$BACKUP_DIR/status.txt" || true
  echo "Backup written to $BACKUP_DIR"

  run git checkout main
  run git reset --hard origin/main

  # Remove common accidental root artifacts shown by Codespaces after malformed terminal commands.
  rm -f FETCH_HEAD letter-generator@1.0.0 next node tsc
fi

log "Post-recovery state"
git status --short || true

echo
if [[ "$VERIFY" == true ]]; then
  run npm ci
  run npm run connections:doctor
fi

echo "Recovery complete. If --stash was used, inspect saved work with: git stash list"
