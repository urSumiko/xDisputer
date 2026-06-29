#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const excluded = new Set(['.git', '.next', '.xdisputer-cache', 'node_modules', 'coverage', 'dist', 'build']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.md', '.sql']);

function read(name) {
  const full = path.join(root, name);
  if (!existsSync(full)) {
    failures.push(`missing required file: ${name}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function must(source, marker, message) {
  if (!source.includes(marker)) failures.push(message);
}

function mustNot(source, marker, message) {
  if (source.includes(marker)) failures.push(message);
}

function before(source, left, right, message) {
  const a = source.indexOf(left);
  const b = source.indexOf(right);
  if (a < 0 || b < 0 || a >= b) failures.push(message);
}

function walk(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (!excluded.has(entry)) walk(absolute, output);
      continue;
    }
    if (textExtensions.has(path.extname(entry))) output.push(path.relative(root, absolute).replaceAll('\\', '/'));
  }
  return output;
}

function allSources() {
  return ['app', 'components', 'src', 'lib'].flatMap((dir) => walk(path.join(root, dir))).filter((name) => !name.endsWith('.md'));
}

function hasPermanentRefreshLoop(source) {
  return /setInterval\s*\([\s\S]{0,240}router\.refresh\s*\(/m.test(source)
    || (/setInterval\s*\([\s\S]{0,240}refresh\s*\(/m.test(source) && source.includes("from 'next/navigation'"));
}

const files = Object.fromEntries([
  'docs/website-stability-cleanup-canvas.md',
  'docs/responsive-layout-stability-canvas.md',
  'app/layout.tsx',
  'app/admin/page.tsx',
  'package.json',
  'scripts/guard-bundle-runner.mjs',
  'components/stability/StableCard.tsx',
  'components/stability/StableCommandHeader.tsx',
  'components/stability/StableEmptyState.tsx',
  'components/stability/StableActionRow.tsx',
  'components/stability/PageStateBoundary.tsx',
  'components/stability/index.ts',
  'components/ClientOutputLimitBoundary.tsx',
  'app/api/debug/notification-state/route.ts',
  'src/features/notifications/useOwnedNotifications.ts',
  'components/notifications/OwnedNotificationDock.tsx',
  'components/notifications/OutputActivityUnreadBadgeMount.tsx',
  'components/notifications/OutputActivityRealtimeRefreshMount.tsx',
  'components/console/AutoRouteRefresh.tsx',
  'components/manager/ManagerConsoleRealtimeRefreshMount.tsx',
  'lib/notifications/notification-service.ts',
  'src/features/notifications/notification-api-service.ts',
  'src/features/notifications/bell-notification-repair-service.ts',
  'app/admin/output-activity-v2/page.tsx',
  'app/api/manager/output-activity/route.ts',
  'app/api/manager/output-activity/clear/route.ts',
  'src/features/manager-output-activity/manager-output-clear-service.ts',
  'components/SupportingDocumentsSetup.tsx',
  'components/TemplateProgressiveWorkspace.tsx',
  'app/stable-ui-primitives.css',
  'app/responsive-layout-stability-system.css',
  'app/workflow-header-slim.css',
  'app/supporting-documents-layout-polish.css',
  'app/supporting-documents-wide-stage.css',
  'app/supporting-documents-runtime-wide-fix.css'
].map((name) => [name, read(name)]));

must(files['docs/website-stability-cleanup-canvas.md'], 'Architecture rule: one owner per state', 'stability canvas must document one-owner state rule');
must(files['docs/website-stability-cleanup-canvas.md'], 'scripts/website-stability-guard.mjs', 'stability canvas must name the guard');
must(files['docs/responsive-layout-stability-canvas.md'], 'Responsive Layout and Stability Canvas', 'responsive canvas must exist');
must(files['docs/responsive-layout-stability-canvas.md'], 'app/responsive-layout-stability-system.css', 'responsive canvas must point to the coded global CSS owner');
must(files['docs/responsive-layout-stability-canvas.md'], 'Center page fills the available middle column', 'responsive canvas must document center-priority layout');
must(files['docs/responsive-layout-stability-canvas.md'], 'ENTITLEMENT_FETCH_TIMEOUT_MS', 'responsive canvas must document entitlement timeout');
must(files['package.json'], 'website-stability:guard', 'package.json must expose website-stability:guard');
must(files['scripts/guard-bundle-runner.mjs'], 'scripts/website-stability-guard.mjs', 'ui-source bundle must run website-stability guard');
before(files['app/layout.tsx'], './final-responsive-integrity.css', './responsive-layout-stability-system.css', 'responsive stability system must load after final responsive integrity');
before(files['app/layout.tsx'], './responsive-layout-stability-system.css', './stable-ui-primitives.css', 'responsive stability system must load before stable primitives/final feature layers');
before(files['app/layout.tsx'], './stable-ui-primitives.css', './workflow-header-slim.css', 'stable primitive CSS must load before final workflow layers');
before(files['app/layout.tsx'], './workflow-header-slim.css', './supporting-documents-layout-polish.css', 'workflow header slim must load before Supporting Documents polish');
before(files['app/layout.tsx'], './supporting-documents-layout-polish.css', './supporting-documents-wide-stage.css', 'wide Supporting Documents stage must load last');
before(files['app/layout.tsx'], './supporting-documents-wide-stage.css', './supporting-documents-runtime-wide-fix.css', 'runtime Supporting Documents wide fix must load after wide stage');

must(files['app/responsive-layout-stability-system.css'], '--responsive-layout-stability-system: coded', 'responsive stability CSS must expose coded contract marker');
must(files['app/responsive-layout-stability-system.css'], 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', 'responsive stability CSS must code auto-fit card grids');
must(files['app/responsive-layout-stability-system.css'], '.client-output-limit-checking', 'responsive stability CSS must stabilize entitlement loading screen layout');
must(files['app/responsive-layout-stability-system.css'], "[role='dialog']", 'responsive stability CSS must bound modal layouts');
must(files['app/responsive-layout-stability-system.css'], 'prefers-reduced-motion: reduce', 'responsive stability CSS must respect reduced motion');
must(files['app/responsive-layout-stability-system.css'], 'overflow-x: clip', 'responsive stability CSS must prevent horizontal overflow');

must(files['components/stability/StableCard.tsx'], 'stable-card', 'StableCard must provide stable-card shell');
must(files['components/stability/StableCommandHeader.tsx'], 'stable-command-header', 'StableCommandHeader must provide stable command shell');
must(files['components/stability/StableEmptyState.tsx'], 'stable-empty-state', 'StableEmptyState must provide stable empty shell');
must(files['components/stability/StableActionRow.tsx'], 'stable-action-row', 'StableActionRow must provide stable action row');
must(files['components/stability/PageStateBoundary.tsx'], 'data-page-state', 'PageStateBoundary must expose stable page state');
must(files['app/stable-ui-primitives.css'], 'Stable UI primitives', 'stable UI primitive CSS must declare ownership');
must(files['app/stable-ui-primitives.css'], 'stable-skeleton-card', 'stable UI CSS must include skeleton shell');

must(files['components/ClientOutputLimitBoundary.tsx'], "type EntitlementState = 'checking'", 'ClientOutputLimitBoundary must include checking state');
must(files['components/ClientOutputLimitBoundary.tsx'], 'PageStateBoundary', 'ClientOutputLimitBoundary must use PageStateBoundary');
must(files['components/ClientOutputLimitBoundary.tsx'], 'data-output-entitlement-state="checking"', 'ClientOutputLimitBoundary must not render workspace before entitlement check');
must(files['components/ClientOutputLimitBoundary.tsx'], 'removeChannel(channel)', 'ClientOutputLimitBoundary must clean only its own channel');
must(files['components/ClientOutputLimitBoundary.tsx'], 'entitlementRef', 'ClientOutputLimitBoundary must preserve the last known entitlement during transient refresh errors');
must(files['components/ClientOutputLimitBoundary.tsx'], 'markUnavailableIfCold', 'ClientOutputLimitBoundary must only show unavailable before a stable entitlement exists');
must(files['components/ClientOutputLimitBoundary.tsx'], 'ENTITLEMENT_FETCH_TIMEOUT_MS = 8000', 'ClientOutputLimitBoundary must timeout cold entitlement checks');
must(files['components/ClientOutputLimitBoundary.tsx'], 'AbortController', 'ClientOutputLimitBoundary must abort stuck entitlement fetches');
must(files['components/ClientOutputLimitBoundary.tsx'], "status === 'SUBSCRIBED'", 'ClientOutputLimitBoundary must not refresh on every realtime status');

must(files['app/api/debug/notification-state/route.ts'], 'directNotificationCount', 'debug notification state endpoint must report direct notification count');
must(files['app/api/debug/notification-state/route.ts'], 'outputActivityFallbackCount', 'debug notification state endpoint must report fallback count');
must(files['app/api/debug/notification-state/route.ts'], 'visibleBellUnreadCount', 'debug endpoint must report visible bell unread count');
must(files['app/api/debug/notification-state/route.ts'], "Cache-Control", 'debug endpoint must be no-store');

must(files['src/features/notifications/useOwnedNotifications.ts'], 'useSyncExternalStore', 'notification hook must own one external store');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'onAuthStateChange', 'notification hook must reset on auth changes');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'removeChannel(owned)', 'notification hook must remove only its own channel');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'manager_disputer_output_approvals', 'notification hook must listen to Output Activity');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'xdisputer-notification-state-v2', 'notification local state must be versioned and user scoped');
must(files['src/features/notifications/useOwnedNotifications.ts'], "${STORAGE_PREFIX}:${userId || 'anonymous'}", 'notification storage key must include current user id');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'clearLocalReadOnly', 'notification hook must clear virtual rows locally');
must(files['components/notifications/OwnedNotificationDock.tsx'], 'useOwnedNotifications', 'notification dock must use owned notification hook');
must(files['components/notifications/OwnedNotificationDock.tsx'], 'useRouter', 'notification dock must route through Next router');
must(files['components/notifications/OwnedNotificationDock.tsx'], 'notification-dock-detail-backdrop', 'notification dock must use detail flyover');
must(files['components/notifications/OutputActivityUnreadBadgeMount.tsx'], 'useOwnedNotifications', 'Output Activity badge must consume owned notification hook');
must(files['components/notifications/OutputActivityRealtimeRefreshMount.tsx'], 'removeChannel(channel)', 'Output Activity refresh bridge must clean only its own channel');
must(files['components/console/AutoRouteRefresh.tsx'], 'xdisputer:notifications-refreshed', 'AutoRouteRefresh must be event-driven');
mustNot(files['components/console/AutoRouteRefresh.tsx'], 'setInterval', 'AutoRouteRefresh must not permanently poll RSC pages');
must(files['app/admin/page.tsx'], '<ManagerConsoleRealtimeRefreshMount />', 'manager console must use the single manager route refresh owner');
mustNot(files['app/admin/page.tsx'], 'AutoRouteRefresh', 'manager console must not mount duplicate route refresh owners');
must(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], 'MANAGER_REFRESH_MIN_INTERVAL_MS = 8000', 'manager refresh owner must have a long stability throttle');
must(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], 'xdisputer:manager-console-refresh', 'manager refresh owner must use explicit manager refresh events');
mustNot(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], "window.addEventListener('focus'", 'manager refresh owner must not refresh RSC on window focus');
mustNot(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], "window.addEventListener('online'", 'manager refresh owner must not refresh RSC on online events');
mustNot(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], "document.addEventListener('visibilitychange'", 'manager refresh owner must not refresh RSC on visibility changes');
mustNot(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], "table: 'generation_runs'", 'manager refresh owner must not refresh all managers on every generation run');
mustNot(files['components/manager/ManagerConsoleRealtimeRefreshMount.tsx'], 'xdisputer:output-entitlement-refresh', 'manager refresh owner must not listen to client entitlement refresh spam');

must(files['src/features/notifications/notification-api-service.ts'], 'repairBellNotificationsForUser', 'notification API must repair bell rows before read');
must(files['lib/notifications/notification-service.ts'], 'outputActivityFallbackNotifications', 'notification service must bridge Output Activity fallback rows');
must(files['lib/notifications/notification-service.ts'], 'virtualManagerNotification', 'notification service must create manager virtual rows');
must(files['lib/notifications/notification-service.ts'], 'virtualClientNotification', 'notification service must create client virtual rows');
must(files['src/features/notifications/bell-notification-repair-service.ts'], 'hrefExists', 'bell repair must dedupe by href');

must(files['app/admin/output-activity-v2/page.tsx'], 'listManagerOutputApprovals(supabase, user.id, [], filter)', 'Output Activity page must read all manager rows');
must(files['app/api/manager/output-activity/route.ts'], 'listManagerOutputApprovals(supabase, user.id, [], filter)', 'Output Activity API must read all manager rows');
must(files['app/api/manager/output-activity/clear/route.ts'], 'clearManagerOutputHistory', 'Output Activity clear route must use service');
must(files['src/features/manager-output-activity/manager-output-clear-service.ts'], "row.is_per_output === true && row.status === 'pending'", 'clear service must preserve pending rows');

must(files['components/SupportingDocumentsSetup.tsx'], 'Supporting Documents ready for layout', 'Supporting Documents ready copy must replace Evidence wording');
must(files['components/SupportingDocumentsSetup.tsx'], 'supporting-documents-panel-v2', 'Supporting Documents setup must expose scoped hook classes');
must(files['app/supporting-documents-layout-polish.css'], "input[type='file']", 'Supporting Documents polish must hide native file input UI');
must(files['app/supporting-documents-wide-stage.css'], '--support-doc-page-max: 1120px', 'wide stage must keep expanded center white canvas');
must(files['app/supporting-documents-wide-stage.css'], '--support-doc-shell-max: 1920px', 'wide stage must allow wide shell');
must(files['app/supporting-documents-wide-stage.css'], 'prefers-reduced-motion', 'sticky-header animation must respect reduced motion');
must(files['app/supporting-documents-wide-stage.css'], 'grid-template-areas: "documents page controls"', 'Supporting Documents must use left-center-right grid');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'Layout contract: side panels are secondary; the center document canvas gets the maximum safe space first', 'runtime Supporting Documents fix must document center priority');
must(files['app/supporting-documents-runtime-wide-fix.css'], '--support-runtime-canvas-target: clamp(430px, 56vw, var(--support-runtime-page-max))', 'runtime Supporting Documents page must maximize center canvas target');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'min-height: clamp(520px, calc(100dvh - 230px), 980px)', 'runtime Supporting Documents frame must reserve vertical space for a large canvas');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'grid-template-areas: "documents page controls"', 'runtime Supporting Documents layout must use wide three-area grid');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'grid-template-areas: "documents" "page" "controls"', 'runtime Supporting Documents layout must stack on narrow screens');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'overflow-x: clip', 'runtime Supporting Documents layout must prevent horizontal overflow');

must(files['components/TemplateProgressiveWorkspace.tsx'], 'compact-command-header', 'template workflow must use compact command header class');
must(files['components/TemplateProgressiveWorkspace.tsx'], 'Use for Source Data', 'template handoff button must use short stable copy');
must(files['app/workflow-header-slim.css'], '-webkit-line-clamp', 'workflow header CSS must clamp long descriptions');

for (const pathname of allSources()) {
  const source = readFileSync(path.join(root, pathname), 'utf8');
  if (source.includes('removeAllChannels')) failures.push(`forbidden removeAllChannels in ${pathname}`);
  if (hasPermanentRefreshLoop(source)) failures.push(`forbidden permanent route refresh interval in ${pathname}`);
  if (/\.from\('notifications'\)\.insert/.test(source) && !pathname.endsWith('bell-notification-repair-service.ts') && !pathname.includes('notification-write-service')) failures.push(`manual notification insert outside approved services: ${pathname}`);
  if (source.includes('MutationObserver')) {
    const bounded = source.includes('requestAnimationFrame') && (source.includes('addedNodes') || source.includes('attributeFilter'));
    if (!bounded) failures.push(`MutationObserver must be frame-bounded and scoped: ${pathname}`);
  }
}

const notificationFetchers = allSources().filter((pathname) => {
  const source = readFileSync(path.join(root, pathname), 'utf8');
  return source.includes('/api/notifications') || source.includes('api/notifications');
});
for (const pathname of notificationFetchers) {
  const allowed = pathname === 'src/features/notifications/useOwnedNotifications.ts' || pathname.startsWith('app/api/notifications');
  if (!allowed) failures.push(`notification fetch must be owned by useOwnedNotifications/API only: ${pathname}`);
}

if (failures.length) {
  console.error(`website-stability-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('website-stability-guard: ok');
