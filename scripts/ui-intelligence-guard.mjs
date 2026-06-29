#!/usr/bin/env node
import { existsSync, statSync, readFileSync } from 'node:fs';

const contracts = [
  {
    id: 'console-shell',
    label: 'Console Shell',
    sourceFiles: ['components/console/ConsoleShell.tsx', 'app/final-console-account-rail.css', 'app/account-menu-ratio-system.css'],
    requiredMarkers: ['data-console-shell="true"', 'data-console-main="true"', 'data-console-header-grid="true"', 'data-console-layout-ratio="75/25"', 'data-console-mode-switch="sidebar-bottom"'],
    forbidden: ['ControlConsoleShell', 'className="admin-monitor-account"', '<ManagerAccountMenu', 'clamp(96px, 10vw, 128px)', 'grid-template-columns: minmax(0, 1fr) var(--account-dock-width) !important;\n    grid-template-rows: var(--account-dock-height) auto !important;']
  },
  {
    id: 'account-menu',
    label: 'Account Settings Rail',
    sourceFiles: ['components/console/AccountMenu.tsx', 'app/api/account/profile/route.ts', 'lib/saas/account-profile-settings.ts', 'app/final-console-account-rail.css', 'app/account-menu-ratio-system.css'],
    requiredMarkers: ['data-console-account-menu="true"', 'data-manager-account-anchor="header-ratio-grid"', 'data-manager-account-popover-align="same-rail"', 'manager-account-settings-form', 'saveCurrentAccountProfile', 'createSupabaseAdminClient', 'relativeRedirect', '--account-dock-width: minmax(220px, .86fr)'],
    forbidden: ['Manage accounts', 'System health', 'data-manager-canonical-switch="true"', '--account-dock-width: clamp(96px']
  },
  {
    id: 'account-profile-rpc',
    label: 'Account Profile Database RPC',
    sourceFiles: ['supabase/migrations/20260615103000_account_profile_settings_rpc.sql'],
    requiredMarkers: ['update_current_account_profile_v1', 'grant execute on function public.update_current_account_profile_v1(text) to authenticated', 'notify pgrst'],
    forbidden: []
  },
  {
    id: 'sidebar-switch-mode',
    label: 'Sidebar Switch Mode',
    sourceFiles: ['components/console/ConsoleShell.tsx', 'app/final-console-account-rail.css'],
    requiredMarkers: ['switchModeContract', 'data-manager-switch-visible-slot="sidebar-bottom"', 'consoleSwitchPulse', 'margin-top: auto !important'],
    forbidden: ['data-manager-switch-visible-slot="account-popover"']
  },
  {
    id: 'render-debugger',
    label: 'Render Debugger',
    sourceFiles: ['components/console/RenderDebugger.tsx', 'app/console-debug-overlay.css'],
    requiredMarkers: ['window.__xdisputerDebug', 'headerAccountWidthRatio', 'detectionMode', 'MutationObserver(sync)', 'document.styleSheets'],
    forbidden: []
  },
  {
    id: 'template-execution',
    label: 'Template Execution Contract',
    sourceFiles: ['components/ManagerTemplateWorkspaceClient.tsx', 'scripts/template-execution-guard.mjs'],
    requiredMarkers: ['ManagerTemplateWorkspaceClient', 'template'],
    forbidden: []
  },
  {
    id: 'manager-owned-docx-generation',
    label: 'Manager-Owned Dynamic DOCX Generation',
    sourceFiles: ['lib/ui-intelligence/manager-owned-docx-contract.ts', 'lib/manager-template-contract/template-runtime-contract.ts', 'lib/dynamic-template/render-orchestrator.ts', 'scripts/manager-owned-docx-guard.mjs'],
    forbiddenSourceFiles: ['lib/manager-template-contract/template-runtime-contract.ts', 'lib/dynamic-template/render-orchestrator.ts', 'scripts/manager-owned-docx-guard.mjs'],
    requiredMarkers: ['manager-owned-docx-generation', 'buildManagerOwnedTemplateRuntimeContract', 'routeManagerOwnedDocxGeneration', 'managerOwnedGenerationManifest', 'manager-owned-docx:guard'],
    forbidden: ['discard unknown manager custom text', 'rebuild entire DOCX from internal canonical body']
  }
];

const requiredFrameworkFiles = [
  'lib/ui-intelligence/types.ts',
  'lib/ui-intelligence/registry.ts',
  'lib/ui-intelligence/dynamic-template-anchor-contract.ts',
  'lib/ui-intelligence/manager-owned-docx-contract.ts',
  'lib/ui-intelligence/classifiers/global-custom-classifier.ts',
  'lib/ui-intelligence/inspectors/design-inspector.ts',
  'lib/ui-intelligence/inspectors/layout-inspector.ts',
  'lib/ui-intelligence/inspectors/ux-inspector.ts',
  'lib/ui-intelligence/inspectors/function-inspector.ts',
  'lib/ui-intelligence/trace/root-cause-tracer.ts',
  'lib/ui-intelligence/trace/dependency-graph.ts',
  'lib/ui-intelligence/propagation/change-propagation-engine.ts',
  'lib/ui-intelligence/reports/ui-intelligence-report.ts',
  'lib/ui-intelligence/index.ts',
  'scripts/ui-intelligence-report.mjs',
  'scripts/ui-intelligence-map.mjs'
];

const checks = [];
function read(path) {
  if (!existsSync(path)) return '';
  if (statSync(path).isDirectory()) return '';
  return readFileSync(path, 'utf8');
}
function check(ok, label, severity = 'error') { checks.push({ ok, label, severity }); }

requiredFrameworkFiles.forEach((path) => check(existsSync(path), `framework file exists: ${path}`, 'critical'));

contracts.forEach((contract) => {
  contract.sourceFiles.forEach((path) => check(existsSync(path), `${contract.label} source exists: ${path}`, 'critical'));
  const source = contract.sourceFiles.map(read).join('\n');
  const forbiddenSourceFiles = contract.forbiddenSourceFiles || contract.sourceFiles;
  const forbiddenSource = forbiddenSourceFiles.map(read).join('\n');
  contract.requiredMarkers.forEach((marker) => check(source.includes(marker), `${contract.label} contains required marker: ${marker}`, 'critical'));
  contract.forbidden.forEach((pattern) => check(!forbiddenSource.includes(pattern), `${contract.label} excludes forbidden pattern: ${pattern}`, 'critical'));
});

const ratioCss = read('app/account-menu-ratio-system.css');
check(!ratioCss.includes('--account-dock-width: clamp(96px'), 'ratio CSS never collapses tablet account rail to 96-128px', 'critical');
check(ratioCss.includes('--account-dock-width: minmax(220px, .86fr)'), 'ratio CSS keeps tablet account rail at minimum 220px', 'critical');
check(ratioCss.includes('grid-template-columns: minmax(0, 2.8fr) var(--account-dock-width)'), 'ratio CSS uses proportional tablet grid instead of compact icon rail', 'critical');

const accountProfileRoute = read('app/api/account/profile/route.ts');
check(accountProfileRoute.includes('relativeRedirect'), 'account settings redirect is relative and stays on the active browser origin', 'critical');
check(accountProfileRoute.includes("headers: { Location: location }"), 'account settings redirect writes relative Location header', 'critical');
check(!accountProfileRoute.includes('new URL(next, request.url)'), 'account settings redirect never builds Location from private request.url', 'critical');
check(!accountProfileRoute.includes('requestOrigin(request)'), 'account settings redirect does not use stale absolute-origin helper', 'critical');
check(accountProfileRoute.includes('saveCurrentAccountProfile'), 'account settings route uses resilient shared save service', 'critical');

const layout = read('app/layout.tsx');
const finalImportIndex = layout.indexOf("import './final-console-account-rail.css';");
const ratioImportIndex = layout.indexOf("import './account-menu-ratio-system.css';");
const debugImportIndex = layout.indexOf("import './console-debug-overlay.css';");
check(finalImportIndex >= 0, 'root layout imports final console account rail override', 'critical');
check(ratioImportIndex >= 0 && finalImportIndex > ratioImportIndex, 'final console account rail loads after ratio CSS', 'critical');
check(debugImportIndex >= 0 && finalImportIndex < debugImportIndex, 'final console account rail loads before debugger overlay', 'critical');

const adminLayout = read('app/admin/layout.tsx');
const masterLayout = read('app/master/layout.tsx');
check(!adminLayout.includes('ControlConsoleShell'), 'admin layout is not wrapped by legacy ControlConsoleShell', 'critical');
check(!masterLayout.includes('ControlConsoleShell'), 'master layout is not wrapped by legacy ControlConsoleShell', 'critical');
check(adminLayout.includes('return <>{children}</>'), 'admin layout is pass-through role gate', 'critical');
check(masterLayout.includes('return <>{children}</>'), 'master layout is pass-through role gate', 'critical');

const pkg = read('package.json');
check(pkg.includes('"ui-intelligence:guard"'), 'package exposes ui-intelligence:guard script', 'critical');
check(pkg.includes('"ui-intelligence:report"'), 'package exposes ui-intelligence:report script', 'critical');
check(pkg.includes('"ui-intelligence:map"'), 'package exposes ui-intelligence:map script', 'critical');
check(pkg.includes('"manager-owned-docx:guard"'), 'package exposes manager-owned-docx:guard script', 'critical');

checks.forEach((item) => console.log(`${item.ok ? '✅' : '❌'} ${item.label}`));
const failed = checks.filter((item) => !item.ok && item.severity === 'critical');
if (failed.length) {
  console.error(`\nUI intelligence guard failed: ${failed.length} critical check(s).`);
  process.exit(1);
}
console.log(`\nUI intelligence guard passed: ${checks.length} check(s).`);
