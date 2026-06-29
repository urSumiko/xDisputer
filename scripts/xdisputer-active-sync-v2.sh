#!/usr/bin/env bash
set -Eeuo pipefail

RESET_LOCAL=false
SYNC_DB=false
VERIFY=false
STRICT_ENV=false
SHIP=false

for arg in "$@"; do
  case "$arg" in
    --reset-local) RESET_LOCAL=true ;;
    --sync-db) SYNC_DB=true ;;
    --verify) VERIFY=true ;;
    --strict-env) STRICT_ENV=true ;;
    --ship) SHIP=true ;;
    -h|--help)
      cat <<'HELP'
xDisputer active sync v2

Commands:
  npm run active:sync -- --reset-local --verify
  npm run active:sync:db
  npm run active:sync -- --reset-local --sync-db --verify --strict-env --ship
HELP
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

INIT_ARGS=()
[[ "$RESET_LOCAL" == true ]] && INIT_ARGS+=(--reset-local)
[[ "$SYNC_DB" == true ]] && INIT_ARGS+=(--sync-db)
[[ "$VERIFY" == true ]] && INIT_ARGS+=(--verify)

echo "== xDisputer active sync v2 =="
echo "Root: $ROOT_DIR"
echo "Init args: ${INIT_ARGS[*]:-(none)}"

npm run init:connections -- "${INIT_ARGS[@]}"

if [[ "$STRICT_ENV" == true ]]; then
  npm run connections:doctor -- --strict-env
else
  npm run connections:doctor
fi

if [[ "$SHIP" == true ]]; then
  npm run xdisputer:guard
  git status --short
  if ! npm run vercel:status; then
    npm run vercel:direct
    npm run verify:production:wait
  fi
fi

echo "Expected active state: main is synced, Vercel env is pulled, Supabase migrations/RPCs are validated, and local build status is known."
