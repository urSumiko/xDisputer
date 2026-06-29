#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');
const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };
const mustNot = (source, text, label) => { if (source.includes(text)) failures.push(label); };

const roadmap = read('docs/roadmaps/repo-rearchitecture-checklist.md');
const cleanup = read('scripts/finalize-retired-surface-cleanup.mjs');
const proxy = read('proxy.ts');
const layout = read('app/layout.tsx');
const phase7 = read('scripts/root-css-import-reduction-guard.mjs');
const ownership = read('src/features/notifications/notification-ownership-contract.ts');
const ownedDock = read('components/notifications/OwnedNotificationDock.tsx');
const notificationApiService = read('src/features/notifications/notification-api-service.ts');
const notificationReadRoute = read('app/api/notifications/read/route.ts');
const notificationListRoute = read('app/api/notifications/route.ts');
const managerDecisionService = read('src/features/manager-output-activity/manager-output-decision-service.ts');
const managerDecisionRoute = read('app/api/manager-output-decision/route.ts');
const notificationService = read('lib/notifications/notification-service.ts');
const notificationWriteService = read('lib/notifications/notification-write-service.ts');
const compatibilityGuard = read('scripts/compatibility-layer-retirement-guard.mjs');

must(roadmap, '- [x] Phase 7 — root CSS import reduction', 'missing phase 7 status');
must(roadmap, '- [x] Phase 8 — notification ownership isolation', 'missing phase 8 status');
must(roadmap, '- [x] Phase 9 — backend route/service contract audit', 'missing phase 9 status');
must(roadmap, '- [x] Phase 10 — delete temporary compatibility layers after verification', 'missing phase 10 status');
must(cleanup, 'verifyOnly', 'cleanup entrypoint must support verify mode');
must(proxy, 'export async function proxy', 'proxy must stay active');
must(layout, "import './root-css-workspace-foundation.css';", 'layout must use workspace foundation bundle');
must(layout, "import './root-css-contracts.css';", 'layout must use contracts bundle');
must(phase7, 'root-css-import-reduction-guard: ok', 'phase 7 guard must exist');
must(ownership, 'ownerStyleHost', 'notification ownership contract must point to owned style host');
must(ownedDock, 'data-notification-dock-owner="true"', 'owned dock must own its style contract');
must(notificationApiService, 'loadNotificationsForCurrentUser', 'notification API service must exist');
must(notificationReadRoute, 'markNotificationsReadForCurrentUser', 'notification read route must delegate to service');
must(notificationListRoute, 'loadNotificationsForCurrentUser', 'notification list route must delegate to service');
must(managerDecisionService, 'applyManagerOutputDecision', 'manager decision service must exist');
must(managerDecisionRoute, 'applyManagerOutputDecision', 'manager decision route must delegate to service');
mustNot(notificationService, 'missingOptionalColumn', 'notification service must not keep optional fallback');
mustNot(notificationService, 'missingRoleColumn', 'notification service must not keep role fallback');
mustNot(notificationWriteService, 'attempts = [', 'notification write service must not keep compatibility attempts');
must(compatibilityGuard, 'compatibility-layer-retirement-guard: ok', 'compatibility retirement guard must exist');

if (failures.length) {
  console.error('repo-rearchitecture-roadmap-guard failed: ' + failures.length + ' check(s).');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('repo-rearchitecture-roadmap-guard: ok');
