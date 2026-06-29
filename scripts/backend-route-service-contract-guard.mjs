#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };

const notificationService = read('src/features/notifications/notification-api-service.ts');
const notificationReadRoute = read('app/api/notifications/read/route.ts');
const managerDecisionService = read('src/features/manager-output-activity/manager-output-decision-service.ts');
const managerDecisionRoute = read('app/api/manager-output-decision/route.ts');
const accountProfileRoute = read('app/api/account/profile/route.ts');

must(notificationService, 'loadNotificationsForCurrentUser', 'notification API service must expose loadNotificationsForCurrentUser');
must(notificationService, 'markNotificationsReadForCurrentUser', 'notification API service must expose markNotificationsReadForCurrentUser');
must(notificationReadRoute, 'markNotificationsReadForCurrentUser', 'notification read route must delegate to notification API service');
must(managerDecisionService, 'applyManagerOutputDecision', 'manager output decision service must exist');
must(managerDecisionRoute, 'applyManagerOutputDecision', 'manager output decision route must delegate to service');
must(accountProfileRoute, 'saveCurrentAccountProfile', 'account profile route must delegate to saveCurrentAccountProfile service');

if (failures.length) {
  console.error(`backend-route-service-contract-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('backend-route-service-contract-guard: ok');
