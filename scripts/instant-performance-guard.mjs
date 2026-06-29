import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`Missing ${path}`), '');
const has = (path, text, message) => { if (!read(path).includes(text)) failures.push(message); };
const not = (path, text, message) => { if (read(path).includes(text)) failures.push(message); };

has('app/layout.tsx', "import './instant-interaction-performance.css';", 'layout must import instant performance layer');
has('app/instant-interaction-performance.css', '--x-instant-performance: ready', 'instant performance readiness token missing');
has('app/instant-interaction-performance.css', 'transition-property: none', 'static transition reset missing');
has('app/instant-interaction-performance.css', 'transition-property: transform, background-color, border-color, color, opacity', 'compositor-friendly transition list missing');
has('app/instant-interaction-performance.css', 'translate3d(0, var(--x-float-y), 0)', 'global float transform missing');
has('app/instant-interaction-performance.css', '.admin-monitor-page .admin-monitor-card', 'manager/master dense card optimization missing');
has('app/instant-interaction-performance.css', 'xInstantShellReady', 'short shell ready animation missing');
has('app/instant-interaction-performance.css', '.console-instant-loading', 'console instant loading shell styles missing');
has('app/instant-interaction-performance.css', '.console-loading-card', 'console loading card styles missing');
has('app/instant-interaction-performance.css', 'prefers-reduced-motion', 'reduced-motion safety missing');
has('app/instant-interaction-performance.css', 'update: slow', 'slow-update safety missing');
has('app/instant-interaction-performance.css', 'min-width: 0 !important', 'overflow containment missing');
has('components/console/ConsoleInstantLoading.tsx', 'data-console-instant-loading', 'shared console loading component missing instant marker');
has('app/admin/loading.tsx', 'ConsoleInstantLoading', 'manager route loading must use instant loading shell');
has('app/admin/access/loading.tsx', 'ConsoleInstantLoading', 'manager access loading must use instant loading shell');
has('app/admin/reports/loading.tsx', 'ConsoleInstantLoading', 'manager reports loading must use instant loading shell');
has('app/admin/audit/loading.tsx', 'ConsoleInstantLoading', 'manager audit loading must use instant loading shell');
has('app/admin/lifecycle/loading.tsx', 'ConsoleInstantLoading', 'manager lifecycle loading must use instant loading shell');
has('app/admin/exceptions/loading.tsx', 'ConsoleInstantLoading', 'manager exceptions loading must use instant loading shell');
has('app/master/loading.tsx', 'ConsoleInstantLoading', 'master route loading must use instant loading shell');
has('app/master/accounts/loading.tsx', 'ConsoleInstantLoading', 'master accounts loading must use instant loading shell');
has('app/master/reports/loading.tsx', 'ConsoleInstantLoading', 'master reports loading must use instant loading shell');
has('app/master/audit/loading.tsx', 'ConsoleInstantLoading', 'master audit loading must use instant loading shell');
has('app/master/workspaces/loading.tsx', 'ConsoleInstantLoading', 'master workspaces loading must use instant loading shell');
has('app/master/system/loading.tsx', 'ConsoleInstantLoading', 'master health loading must use instant loading shell');
has('app/ui-theme-triad.css', 'xTriadSurfaceEnter', 'triad theme should remain present');
not('app/instant-interaction-performance.css', 'transition-property: all', 'instant layer must not transition all properties');
not('app/instant-interaction-performance.css', 'filter: blur', 'instant layer must not add blur');
not('app/instant-interaction-performance.css', 'transition-property: transform, background-color, border-color, box-shadow', 'instant layer must not animate box-shadow');

if (failures.length) {
  console.error('Instant performance guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Instant performance guard passed.');
