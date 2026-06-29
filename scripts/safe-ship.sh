#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/xDisputer

echo "== xDisputer safe ship =="

# 1. Remove local/generated noise that commonly blocks rebase.
git restore -- next-env.d.ts tsconfig.tsbuildinfo 2>/dev/null || true
rm -rf .local-backups .next

# 2. Keep generated build files ignored going forward.
touch .gitignore
grep -qxF "tsconfig.tsbuildinfo" .gitignore || echo "tsconfig.tsbuildinfo" >> .gitignore
grep -qxF ".local-backups/" .gitignore || echo ".local-backups/" >> .gitignore
grep -qxF ".next/" .gitignore || echo ".next/" >> .gitignore

stage_sources() {
  git add \
    app \
    components \
    lib \
    scripts \
    supabase \
    docs \
    middleware.ts \
    next.config.mjs \
    package.json \
    package-lock.json \
    .env.example \
    .gitignore 2>/dev/null || true
}

# 3. Stage only real source/config files.
stage_sources

# 4. Show staged work.
echo
echo "== Staged changes =="
git diff --cached --name-status || true

# 5. Run quality guard.
echo
echo "== Quality check =="
if npm run | grep -q "xdisputer:guard"; then
  npm run xdisputer:guard
else
  npm run typecheck
  npm run build
fi

# 6. Restage source files because prebuild/pretypecheck repair scripts may have normalized source.
stage_sources

# 7. Commit only when staged changes exist.
echo
echo "== Commit =="
if git diff --cached --quiet; then
  echo "No real source changes staged. Nothing to commit."
else
  git commit -m "${1:-chore: safe production update}"
fi

# 8. Pull/rebase after working tree is clean.
echo
echo "== Pull rebase =="
git restore -- next-env.d.ts tsconfig.tsbuildinfo 2>/dev/null || true
git pull --rebase origin main

# 9. Push.
echo
echo "== Push =="
git push origin main

# 10. Wait until Vercel production reports the same commit as local HEAD.
echo
echo "== Production verification =="
if npm run | grep -q "verify:production:wait"; then
  npm run verify:production:wait
else
  npm run verify:production
fi

echo
echo "✅ Safe ship complete and production commit verified."
