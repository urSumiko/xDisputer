# xDisputer root-cause error ledger

_Last updated: 2026-06-14_

Use this ledger before patching. The rule is: identify the first failing layer, apply the narrowest durable fix, then verify with the matching command.

## E001 — Missing `workflowFramework` export

**Observed error**

```text
Export workflowFramework was not found in module lib/workflow-framework.ts
```

**Root cause**

A component imported a named workflow contract that was not exported or was removed during refactor.

**Current expected state**

`lib/workflow-framework.ts` exports `workflowFramework`, `packetWorkflows`, `packetOrderText`, and `exhibitKindsForPacket`.

**Correct fix pattern**

- Keep packet order inside `lib/generation-contract.ts` and project it through `lib/workflow-framework.ts`.
- Do not redeclare packet order separately inside UI components.
- If a component needs framework metadata, import from `lib/workflow-framework.ts` only.

**Verification**

```bash
npm run typecheck
npm run build
```

## E002 — Missing `activeExhibitKinds` export

**Observed error**

```text
Export activeExhibitKinds does not exist
```

**Root cause**

The active API changed to `exhibitKindsForPacket(type)`, but stale imports still referenced an older export name.

**Correct fix pattern**

- Replace stale imports of `activeExhibitKinds` with `exhibitKindsForPacket`.
- Preserve packet type awareness; do not hardcode a single exhibit list for every letter type.

**Verification**

```bash
grep -R "activeExhibitKinds" -n app components lib || true
npm run typecheck
```

## E003 — Supabase RPC schema cache miss

**Observed error**

```text
Could not find the function public.access_workspace_account_summary_v1(workspace_id_input) in the schema cache
```

**Root cause**

The app expected the Phase 11E read RPCs, but the Supabase schema cache or database migration state did not expose the expected signature.

**Correct fix pattern**

- Apply the Phase 11E RPC cache repair migration.
- Reload PostgREST schema after function creation.
- Validate function signatures with SQL before changing UI code.

**Verification**

```sql
select
  to_regprocedure('public.access_workspace_account_summary_v1(uuid)') as account_summary_rpc,
  to_regprocedure('public.access_workspace_account_directory_v1(uuid,text,text,integer,integer)') as account_directory_rpc,
  to_regprocedure('public.access_workspace_attention_queue_v1(uuid,integer)') as attention_queue_rpc;

notify pgrst, 'reload schema';
```

## E004 — Codespaces heredoc stuck at `>` prompt

**Observed error**

```text
Shell remains at a continuation prompt after a pasted script.
```

**Root cause**

A heredoc terminator was not pasted exactly, so Bash waited for more input.

**Correct fix pattern**

- Prefer committed scripts over large pasted heredocs.
- If stuck, press `Ctrl+C`, then run a repository script such as `npm run init:connections`.
- Keep terminal commands short and idempotent.

**Recovery**

```bash
# Press Ctrl+C first if the terminal is stuck at >
git status --short
npm run init:connections -- --reset-local --verify
```

## E005 — Hosted preview redirects to localhost

**Observed error**

```text
ERR_CONNECTION_REFUSED
```

**Root cause**

A hosted Codespaces/Vercel request used a local `NEXT_PUBLIC_SITE_URL`, so browser redirects were sent to the user's own machine.

**Correct fix pattern**

- Use request host detection for hosted requests.
- Only use `NEXT_PUBLIC_SITE_URL` when it is compatible with the request environment.

**Verification**

```bash
npm run typecheck
npm run build
```

## E006 — Vercel status missing on commit

**Observed error**

```text
No Vercel status found on this commit.
```

**Root cause**

GitHub status for the commit did not include a Vercel status. Possible causes are disabled Git auto-deploy, delayed status creation, wrong project binding, or repository connection drift.

**Correct fix pattern**

- First verify GitHub remote and active branch.
- Pull Vercel production environment with the CLI.
- Use direct production sync only when Git auto-deploy is unavailable or delayed.

**Verification**

```bash
npm run vercel:status
npm run vercel:direct
```

## E007 — Client/manager output cap accidentally reintroduced

**Observed issue**

UI or server code adds manager/client generation caps, client output limits, generation-count restrictions, or usage-cap blocked messaging.

**Root cause**

Old SaaS usage-cap assumptions were mixed into the current no-output-limit product rule.

**Correct fix pattern**

- Remove output-limit enforcement from client and manager generation paths.
- Keep operational throttling internal only if required for infrastructure protection, and never render it as a client/account usage-cap state unless explicitly requested.
- Search before shipping.

**Verification**

```bash
grep -R "generation limit\|output limit\|usage-cap\|usage cap\|cap blocked" -n app components lib scripts docs || true
npm run typecheck
npm run build
```

## E008 — Local index blocks active sync and hides new npm scripts

**Observed error**

```text
error: cannot pull with rebase: Your index contains uncommitted changes.
error: Please commit or stash them.
npm error Missing script: "active:sync"
```

**Root cause**

The local Codespace had staged or uncommitted files before pulling `origin/main`. Because the pull/rebase stopped, the local `package.json` stayed behind the remote commit that added `active:sync`. Accidental root artifacts such as `FETCH_HEAD`, `next`, `node`, `tsc`, or `letter-generator@1.0.0` can also appear when a malformed terminal command writes command/package names into the repository root.

**Correct fix pattern**

- Do not run `npm install` or `npm run active:sync` until the local tree is reconciled with `origin/main`.
- Preserve local work with stash mode, or reset generated/noise changes with hard mode only after creating a patch backup.
- Pull `origin/main` using fast-forward after the index is clean.
- Run `npm ci`, not `npm install`, after the repository is current.

**Recovery**

```bash
# Preserve local changes and then sync.
git fetch origin main --prune
git stash push -u -m "manual recovery before active sync"
git checkout main
git pull --ff-only origin main
npm ci
npm run connections:doctor
npm run active:sync -- --reset-local --verify
```

```bash
# Reset local noise after patch backup.
mkdir -p .local-backups/manual-sync-recovery
git diff > .local-backups/manual-sync-recovery/worktree.patch || true
git diff --cached > .local-backups/manual-sync-recovery/index.patch || true
git fetch origin main --prune
git checkout main
git reset --hard origin/main
rm -f FETCH_HEAD letter-generator@1.0.0 next node tsc
npm ci
npm run connections:doctor
npm run active:sync -- --reset-local --verify
```

**Verification**

```bash
git status --short
npm run | grep -E "active:sync|connections:doctor"
npm run connections:doctor
```
