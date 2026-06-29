# Phase 11 — Multi-Tenant Access Framework Roadmap

## Objective

Move xDisputer from a flat role-based account model to a workspace-scoped permission and assignment framework for multi-client, multi-manager, and multi-master operations.

## Critical Problems Addressed

1. No true tenant boundary for future multi-organization usage.
2. Master role is too global without workspace-scoped permissions.
3. Client-to-manager assignment lacks a durable assignment ledger and transfer history.

## Phase 11A — Workspace + Membership Tables

- [x] Add `workspaces` table.
- [x] Add `workspace_members` table.
- [x] Add `workspace_invites` table.
- [x] Add default workspace bootstrap RPC.
- [x] Add default membership backfill helper.
- [x] Keep current `profiles.manager_id` compatibility pointer.
- [x] Run Supabase SQL in production.
- [x] Verify default workspace created.
- [x] Verify all existing profiles backfilled into workspace members.

## Phase 11B — Central Access Policy RPCs

- [x] Add `access_get_actor_context(...)`.
- [x] Add `access_can_manage_account(...)`.
- [x] Add `access_workspace_account_directory(...)`.
- [x] Add actor workspace role helper.
- [x] Add TypeScript helper `lib/saas/workspace-access.ts`.
- [x] Verify master context resolves as platform master.
- [x] Verify manager context resolves only within assigned workspace.
- [x] Verify client cannot load workspace directory.

## Phase 11C — Client Assignment Ledger

- [x] Add `client_manager_assignments` table.
- [x] Add `client_assignment_events` table.
- [x] Add one-active-primary-assignment partial unique index.
- [x] Add `access_workspace_assign_client(...)`.
- [x] Add `access_workspace_approve_client(...)`.
- [x] Add `access_workspace_transfer_client(...)`.
- [x] Add `access_workspace_revoke_client_assignment(...)`.
- [x] Backfill existing `profiles.manager_id` relationships into assignment ledger.
- [x] Verify assignment events are written.
- [ ] Verify transferred clients create old transferred assignment and new active assignment.

## Phase 11D — Control Adoption

- [x] Add idempotent RPC `access_11d_migrate_profile_manager_assignments()`.
- [x] Preserve `profiles.manager_id` as compatibility pointer.
- [x] Add manager control RPC `access_workspace_manager_control_v1(...)`.
- [x] Add master control RPC `access_workspace_master_control_v1(...)`.
- [x] Route `/api/control/profile` through workspace-ledger controls first, with legacy RPC fallback during rollout.
- [x] Run Phase 11D control-adoption SQL in production.
- [ ] Verify approve/reject/disable/reactivate write assignment events.

## Phase 11E — Workspace-Scoped Reads

- [x] Add `access_workspace_account_summary_v1(...)`.
- [x] Add `access_workspace_account_directory_v1(...)`.
- [x] Update `lib/saas/account-directory.ts` to use workspace-scoped RPCs.
- [x] Update `/master/accounts` copy and navigation for workspace-scoped directory.
- [x] Update `/admin/access` copy and navigation for workspace-scoped manager client directory.
- [x] Add workspace-ledger-first account controls for Phase 11D adoption.
- [ ] Verify `/master/accounts` shows workspace-scoped users after deploy.
- [ ] Verify `/admin/access` shows only manager-owned workspace clients after deploy.

## Phase 11F — Next UI Enhancements

- [ ] Add master transfer-client UI using `access_workspace_transfer_client(...)`.
- [ ] Add revoke assignment UI using `access_workspace_revoke_client_assignment(...)`.
- [ ] Add manager workspace-scoped assignment history view.
- [ ] Add confirmation screen for sensitive master actions.

## Deployment Checklist

- [x] Run Phase 11D control-adoption SQL in Supabase SQL Editor.
- [ ] Run `git pull` in Codespaces.
- [ ] Run `npm run xdisputer:guard`.
- [ ] Deploy with `./scripts/safe-ship.sh "feat: route controls through workspace ledger"`.
- [ ] Open `/master/workspaces`.
- [ ] Open `/master/accounts`.
- [ ] Open `/admin/access`.
- [ ] Approve/reject/reactivate one test client and verify assignment event.
- [ ] Confirm generated output remains unaffected.

## Non-Negotiable Rules

- No quota enforcement.
- No output limit enforcement.
- No generated document rendering changes.
- No destructive migration.
- Workspace framework is additive first, then progressively adopted.
