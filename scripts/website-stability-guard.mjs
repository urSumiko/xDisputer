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
function must(source, marker, message) { if (!source.includes(marker)) failures.push(message); }
function mustNot(source, marker, message) { if (source.includes(marker)) failures.push(message); }
function before(source, left, right, message) { const a = source.indexOf(left); const b = source.indexOf(right); if (a < 0 || b < 0 || a >= b) failures.push(message); }
function walk(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) { if (!excluded.has(entry)) walk(absolute, output); continue; }
    if (textExtensions.has(path.extname(entry))) output.push(path.relative(root, absolute).replaceAll('\\', '/'));
  }
  return output;
}
function allSources() { return ['app', 'components', 'src', 'lib'].flatMap((dir) => walk(path.join(root, dir))).filter((name) => !name.endsWith('.md')); }
function hasPermanentRefreshLoop(source) { return /setInterval\s*\([\s\S]{0,240}router\.refresh\s*\(/m.test(source) || (/setInterval\s*\([\s\S]{0,240}refresh\s*\(/m.test(source) && source.includes("from 'next/navigation'")); }
function hasScopedObserver(pathname, source) {
  if (source.includes('requestAnimationFrame') && (source.includes('addedNodes') || source.includes('attributeFilter'))) return true;
  if (pathname === 'components/PacketInsertViewer.tsx') return source.includes('rootRef.current') && source.includes('attributeFilter');
  if (pathname === 'components/PacketMapPreviewController.tsx') return source.includes('.simple-editor-visual-host') && source.includes('.simple-editor-body');
  return false;
}

const files = Object.fromEntries([
  'docs/website-stability-cleanup-canvas.md',
  'docs/responsive-layout-stability-canvas.md',
  'app/layout.tsx',
  'package.json',
  'scripts/guard-bundle-runner.mjs',
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
must(files['docs/responsive-layout-stability-canvas.md'], 'Responsive Layout and Stability Canvas', 'responsive canvas must exist');
must(files['package.json'], 'website-stability:guard', 'package.json must expose website-stability:guard');
must(files['scripts/guard-bundle-runner.mjs'], 'scripts/website-stability-guard.mjs', 'ui-source bundle must run website-stability guard');
before(files['app/layout.tsx'], './final-responsive-integrity.css', './responsive-layout-stability-system.css', 'responsive stability system must load after final responsive integrity');
before(files['app/layout.tsx'], './responsive-layout-stability-system.css', './stable-ui-primitives.css', 'responsive stability system must load before stable primitives/final feature layers');
before(files['app/layout.tsx'], './supporting-documents-wide-stage.css', './supporting-documents-runtime-wide-fix.css', 'runtime Supporting Documents wide fix must load after wide stage');

must(files['app/responsive-layout-stability-system.css'], '--responsive-layout-stability-system: coded', 'responsive stability CSS must expose coded contract marker');
must(files['app/responsive-layout-stability-system.css'], 'overflow-x: clip', 'responsive stability CSS must prevent horizontal overflow');
must(files['components/ClientOutputLimitBoundary.tsx'], 'removeChannel(channel)', 'ClientOutputLimitBoundary must clean only its own channel');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'useSyncExternalStore', 'notification hook must own one external store');
must(files['src/features/notifications/useOwnedNotifications.ts'], 'removeChannel(owned)', 'notification hook must remove only its own channel');
must(files['components/notifications/OwnedNotificationDock.tsx'], 'useOwnedNotifications', 'notification dock must use owned notification hook');
must(files['components/notifications/OutputActivityUnreadBadgeMount.tsx'], 'useOwnedNotifications', 'Output Activity badge must consume owned notification hook');
must(files['components/notifications/OutputActivityRealtimeRefreshMount.tsx'], 'removeChannel(channel)', 'Output Activity refresh bridge must clean only its own channel');
must(files['components/console/AutoRouteRefresh.tsx'], 'xdisputer:notifications-refreshed', 'AutoRouteRefresh must be event-driven');
mustNot(files['components/console/AutoRouteRefresh.tsx'], 'setInterval', 'AutoRouteRefresh must not permanently poll RSC pages');
must(files['components/TemplateProgressiveWorkspace.tsx'], 'compact-command-header', 'template workflow must use compact command header class');
must(files['components/TemplateProgressiveWorkspace.tsx'], 'Use for Source Data', 'template handoff button must use short stable copy');
must(files['app/workflow-header-slim.css'], '-webkit-line-clamp', 'workflow header CSS must clamp long descriptions');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'grid-template-areas: "documents page controls"', 'runtime Supporting Documents layout must use wide three-area grid');
must(files['app/supporting-documents-runtime-wide-fix.css'], 'overflow-x: clip', 'runtime Supporting Documents layout must prevent horizontal overflow');

for (const pathname of allSources()) {
  const source = readFileSync(path.join(root, pathname), 'utf8');
  if (source.includes('removeAllChannels')) failures.push(`forbidden removeAllChannels in ${pathname}`);
  if (hasPermanentRefreshLoop(source)) failures.push(`forbidden permanent route refresh interval in ${pathname}`);
  if (/\.from\('notifications'\)\.insert/.test(source) && !pathname.endsWith('bell-notification-repair-service.ts') && !pathname.includes('notification-write-service')) failures.push(`manual notification insert outside approved services: ${pathname}`);
  if (source.includes('MutationObserver') && !hasScopedObserver(pathname, source)) failures.push(`MutationObserver must be frame-bounded and scoped: ${pathname}`);
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
