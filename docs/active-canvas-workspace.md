# Active Canvas Workspace

_Last updated: 2026-06-17 Asia/Tokyo_

## Scope

Dedicated planning and execution canvas for the active `Arisu-art/xDisputer` repo workstream.

## Active connections

| Tool | Status | Notes |
| --- | --- | --- |
| GitHub | Connected | Repo confirmed as `Arisu-art/xDisputer`, default branch `main`, write access available. |
| Context7 | Connected | Used for current Supabase and Next.js documentation lookup before implementation. |
| Supabase | Repo-wired | App scripts include `connections:doctor`, `supabase:doctor`, and `active:sync:db`; project-specific SQL changes require selecting a project ID before execution. |
| Figma | Available | No node-specific Figma URL was supplied for design-to-code mapping in this pass. |

## Coded in this pass

| Item | Status | Files |
| --- | --- | --- |
| Template provenance workspace guard | Coded | `scripts/template-provenance-workspace-guard.mjs` |
| Template contract roadmap status | Coded | `docs/template-contract-activation-roadmap.md` |
| Pending provenance patch closeout | Coded | `docs/template-contract-pending-local-patches.md` |
| Dedicated canvas tracker | Coded | `docs/active-canvas-workspace.md` |

## Not coded in this pass

| Item | Reason |
| --- | --- |
| `package.json` script wiring | GitHub connector safety check blocked the direct `package.json` update. Use the command below locally, then run guards. |
| Supabase atomic activation RPC | Optional hardening item; no explicit project ID was selected for database migration execution in this pass. |
| Figma Code Connect mapping | Requires a concrete Figma file key and node ID. |

## Local package script patch

Run this from the repo root to wire the committed guard into the existing guard chain:

```bash
node <<'NODE'
const fs = require('fs');
const file = 'package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.scripts['template-provenance:guard'] = 'node scripts/template-provenance-workspace-guard.mjs';
pkg.scripts['template-workspace:guard'] = pkg.scripts['template-workspace:guard'].includes('template-provenance:guard')
  ? pkg.scripts['template-workspace:guard']
  : `${pkg.scripts['template-workspace:guard']} && npm run template-provenance:guard`;
fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
NODE
```

## Verification commands

```bash
npm run template-provenance:guard
npm run typecheck
npm run build
npm run xdisputer:guard
```

## SQL sync check

Use this read-only SQL in Supabase SQL Editor after selecting the active project:

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'template_assets',
    'generation_runs',
    'deployment_requests'
  )
order by table_name;
```

## Expected result

Generated browser ZIP packages and persisted generation runs should include template provenance in `generation-manifest.json`, including asset IDs, version numbers, content hashes, validation status, and template source proof for effective Supabase-backed templates.
