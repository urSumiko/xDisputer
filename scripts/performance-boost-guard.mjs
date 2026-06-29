#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };
const mustPass = (condition, label) => { if (!condition) failures.push(label); };

const debuggerMount = read('components/console/RenderDebuggerMount.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');
const shell = read('components/console/ConsoleShell.tsx');
const notifications = read('lib/notifications/notification-service.ts');
const notificationDock = read('components/notifications/OwnedNotificationDock.tsx');
const notificationHook = read('src/features/notifications/useOwnedNotifications.ts');
const notificationContract = read('src/features/notifications/notification-ownership-contract.ts');
const dashboard = read('components/DashboardOperationsWorkspace.tsx');
const boundary = read('components/ClientOutputLimitBoundary.tsx');
const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');
const outputRoute = read('app/api/generation-runs/route.ts');
const perfContract = read('src/features/performance/performance-contract.ts');
const canvas = read('docs/performance-boost-canvas.md');
const repoAudit = read('scripts/repo-precision-audit.mjs');
const retiredDynamicChip = 'OutputLimit' + 'ResetChip';
const retiredStaticChip = 'Static' + 'Entitlement' + 'Chip';
const retiredChipClass = 'output-limit' + '-reset-chip';

function hasStrictCanonicalNotificationProjection(source) {
  const hasCanonicalProjection = source.includes(".select('id,title,body,href,severity,read_at,created_at')");
  const hasNoWildcardNotificationSelect = !/\.from\('notifications'\)[\s\S]{0,240}\.select\(['"]\*['"]\)/.test(source);
  const keepsSelectBeforeFilters = source.includes(".select('id,title,body,href,severity,read_at,created_at')") && source.indexOf(".select('id,title,body,href,severity,read_at,created_at')") < source.indexOf('.eq(input.column, input.value)');
  const hasNoOptionalProjectionFallback = !source.includes('fallbackSelect') && !source.includes('MinimalNotificationRow') && !source.includes('missingOptionalColumn');

  return hasCanonicalProjection && hasNoWildcardNotificationSelect && keepsSelectBeforeFilters && hasNoOptionalProjectionFallback;
}

must(debuggerMount, "dynamic(() => import('./RenderDebugger')", 'debugger must stay dynamically imported');
must(debuggerMount, 'NEXT_PUBLIC_XDISPUTER_DEBUG_PANEL', 'debugger must require explicit env flag');
mustNot(debuggerMount, "process.env.NODE_ENV !== 'production') return true", 'debugger must not auto-enable in development');
must(accountMenu, '<NotificationDock />', 'account rail must own notification dock');
mustNot(shell, '<NotificationDock', 'console shell must not mount notification dock directly');
mustPass(hasStrictCanonicalNotificationProjection(notifications), 'notification queries must select explicit columns');
must(notifications, '.limit(', 'notification queries must limit rows');
must(notificationContract, 'pollIntervalMs: 120_000', 'notification polling contract must be throttled to 120 seconds');
must(notificationDock, 'useOwnedNotifications', 'notification dock must use shared owned-notification hook');
must(notificationHook, 'notificationOwnershipContract.pollIntervalMs', 'owned notification hook must read throttled polling from ownership contract');
must(notificationHook, 'useSyncExternalStore', 'owned notification hook must avoid duplicate component fetch loops');
mustNot(dashboard, retiredStaticChip, 'dashboard must not keep retired static entitlement chip');
mustNot(dashboard, retiredChipClass, 'dashboard must not keep retired entitlement chip classes');
mustNot(boundary, 'window.setInterval', 'output limit boundary must not run interval polling');
must(workspace, "import('jszip')", 'workspace archive builder must lazy-load JSZip');
mustNot(workspace, "import JSZip from 'jszip'", 'workspace must not statically import JSZip');
mustNot(workspace, retiredDynamicChip, 'workspace header must not import retired entitlement chip');
must(outputRoute, 'syncGeneratedOutputEverywhere', 'generation route must use one canonical output sync helper');
must(outputRoute, "rpc('sync_generation_output_activity_v1'", 'generation route must delegate output activity to canonical DB sync RPC');
must(perfContract, 'heavy-client-bundle-risk', 'performance contract must track heavy client bundle risk');
must(canvas, 'Performance Boost Canvas', 'performance canvas missing');
must(repoAudit, 'Supabase query appears to filter before select', 'repo audit must detect Supabase query order risk');

if (failures.length) {
  console.error(`performance-boost-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('performance-boost-guard: ok');
