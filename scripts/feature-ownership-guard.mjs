#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };

const accountRail = read('src/features/account-rail/account-rail-contract.ts');
const consoleShell = read('src/features/console-shell/console-shell-contract.ts');
const outputActivity = read('src/features/manager-output-activity/output-activity-contract.ts');
const clientWorkspace = read('src/features/client-workspace/client-workspace-contract.ts');
const accountMenu = read('components/console/AccountMenu.tsx');
const generation = read('app/api/generation-runs/route.ts');
const decisionRoute = read('app/api/manager-output-decision/route.ts');
const decisionService = read('src/features/manager-output-activity/manager-output-decision-service.ts');
const repoAudit = read('scripts/repo-precision-audit.mjs');
const managerMasterGuard = read('scripts/manager-master-lightweight-ui-guard.mjs');
const canvas = read('docs/frontend-backend-organization-canvas.md');

must(accountRail, 'Account rail owns notification dock', 'account rail contract must own notification dock');
must(consoleShell, 'Provides sidebar, mode switch, header grid slot', 'console shell contract must be slot-only');
must(outputActivity, 'defaultRateAmount: 0', 'output activity contract must keep default rate zero');
must(clientWorkspace, 'clientWorkspaceOwnershipContract', 'client workspace ownership contract missing');
must(accountMenu, '<NotificationDock />', 'AccountMenu must mount NotificationDock');
must(generation, 'outputActivityContract.defaultRateAmount', 'generation route must use output activity contract default rate');
must(decisionRoute, 'applyManagerOutputDecision', 'manager decision route must delegate to manager output decision service');
must(decisionService, 'decisionStatus', 'manager decision service must centralize decision status');
must(repoAudit, 'NotificationDock should be owned by AccountMenu', 'repo precision audit must detect notification ownership drift');
must(managerMasterGuard, 'manager-master-lightweight-ui-guard', 'manager/master lightweight UI guard missing');
must(canvas, 'Request -> canvas -> owner file', 'organization canvas must define precision chain');
mustNot(decisionRoute, "action === 'confirm'", 'manager decision route must not inline confirm status logic');
mustNot(decisionRoute, "action === 'reject'", 'manager decision route must not inline reject status logic');
mustNot(decisionRoute, "action === 'paid'", 'manager decision route must not inline paid status logic');

if (failures.length) {
  console.error(`feature-ownership-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('feature-ownership-guard: ok');
