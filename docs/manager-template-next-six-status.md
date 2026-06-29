# Manager Template Next-Six Status

Status: coded.

## Completed items

1. Template authority model
   - `lib/manager-template-authority.ts` defines `MANAGER_EDIT`, `CLIENT_READONLY`, and `POLICY_LOADING`.

2. Unified UI copy
   - `lib/manager-template-ui.ts`, `TemplateProgressiveWorkspace`, and `TemplatePacketConfigurator` now route manager/client wording through the authority model.

3. Quality and provenance summaries
   - Packet cards show manager default status, version, quality warning state, and content-hash context where available.

4. Immediate state refresh
   - `scripts/apply-manager-template-workspace-state-wiring.mjs` wires `ManagerTemplateWorkspaceClient` to refetch active manager assets after letter or exhibit mutations.

5. Manager library status panel
   - `components/ManagerTemplateLibraryStatus.tsx` summarizes active templates, letter/exhibit counts, latest version, validation warnings, and storage proof.

6. Authority guard
   - `scripts/manager-template-authority-guard.mjs` verifies backend template ownership is reflected in UI, UX, state refresh, and generation source wiring.

## Expected UI output

`/manager-workspace` should show manager authority copy, active template summary metrics, quality/provenance details in packet cards, and upload/remove actions should refresh the active manager library immediately.

## Local verification

Run:

```bash
node scripts/manager-template-authority-guard.mjs
node scripts/manager-local-dev-ready-guard.mjs
npm run typecheck
npm run build
```
