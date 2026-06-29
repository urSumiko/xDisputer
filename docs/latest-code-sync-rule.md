# Latest code sync rule

_Last updated: 2026-06-15_

This repo must treat latest-code sync as part of every UI/runtime fix.

## Rule

Before claiming a UI change is fixed, verify that the running environment is using the newest `main` commit that contains the change.

## Required proof after each patch

1. Report the latest commit SHA.
2. Give terminal commands to pull latest `main`.
3. Run dependency install, connection doctor, typecheck, and build.
4. Run local preview.
5. Tell the user which route to open in Codespaces preview.
6. Provide a grep command for a unique marker added by the patch.
7. If the visible website does not change, diagnose sync/build/runtime staleness first before changing more UI code.

## Standard terminal sequence

```bash
git fetch origin main --prune
git checkout main
git pull --rebase origin main
git log -1 --oneline
npm ci
npm run connections:doctor
npm run typecheck
npm run build
npm run dev
```

## Expected behavior

The latest local preview must show the newest commit before visual verification is trusted.
