#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };

const canvas = read('docs/notification-ui-fbis-canvas.md');
const css = read('app/notification-account-rail.css');
const layout = read('app/layout.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');
const dock = read('components/notifications/OwnedNotificationDock.tsx');
const shell = read('components/console/ConsoleShell.tsx');
const service = read('lib/notifications/notification-service.ts');
const contract = read('src/features/notifications/notification-ownership-contract.ts');

must(canvas, 'Structure Isolation FBIS', 'notification canvas must document FBIS');
must(css, 'order: 1', 'notification bell must be ordered before avatar');
must(css, 'order: 2', 'avatar must be ordered after bell');
must(accountMenu, '<NotificationDock />', 'AccountMenu must own NotificationDock alias');
must(dock, 'data-notification-dock="true"', 'OwnedNotificationDock must keep marker');
must(dock, 'data-notification-dock-owner="true"', 'OwnedNotificationDock must own its style contract');
must(contract, "readEndpoint: '/api/notifications/read'", 'notification ownership contract must declare read endpoint');
must(service, ".select('id,title,body,href,severity,read_at,created_at')", 'notification service must use canonical schema columns');
mustNot(service, 'missingRoleColumn', 'notification service must not keep recipient_role compatibility fallback');
mustNot(service, 'missingOptionalColumn', 'notification service must not keep optional column compatibility fallback');
mustNot(shell, '<NotificationDock', 'ConsoleShell must not mount NotificationDock directly');
must(layout, "import './root-css-console-shell.css';", 'layout must keep console shell root bundle');

if (failures.length) {
  console.error(`notification-ui-frontend-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('notification-ui-frontend-guard: ok');
