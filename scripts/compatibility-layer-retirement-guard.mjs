#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };

const notificationService = read('lib/notifications/notification-service.ts');
const notificationWriteService = read('lib/notifications/notification-write-service.ts');
const accountRail = read('src/features/account-rail/account-rail-contract.ts');
const ownedDock = read('components/notifications/OwnedNotificationDock.tsx');

mustNot(notificationService, 'missingOptionalColumn', 'notification service must not keep optional column compatibility fallback');
mustNot(notificationService, 'missingRoleColumn', 'notification service must not keep role column compatibility fallback');
mustNot(notificationWriteService, 'attempts = [', 'notification write service must not keep compatibility insert attempts');
must(accountRail, 'OwnedNotificationDock.tsx', 'account rail contract must point to owned notification dock');
must(ownedDock, 'data-notification-dock-owner="true"', 'owned notification dock must own its style contract');

if (failures.length) {
  console.error(`compatibility-layer-retirement-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('compatibility-layer-retirement-guard: ok');
