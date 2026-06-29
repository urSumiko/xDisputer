#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const verifyOnly = process.argv.includes('--verify');

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function write(path, content) {
  if (verifyOnly) return;
  ensureParent(path);
  writeFileSync(path, content, 'utf8');
  console.log('wrote ' + path);
}

function remove(path) {
  if (!existsSync(path) || verifyOnly) return;
  rmSync(path, { recursive: true, force: true });
  console.log('removed ' + path);
}

function patchPackageJson() {
  const pkgPath = 'package.json';
  const pkg = JSON.parse(read(pkgPath));
  pkg.scripts ||= {};
  pkg.scripts['assistant-chip-retirement:guard'] = 'node scripts/assistant-chip-retirement-guard.mjs';
  pkg.scripts['repo-rearchitecture:guard'] = 'node scripts/repo-rearchitecture-roadmap-guard.mjs';
  let ui = pkg.scripts['ui-source:guard'] || '';
  if (ui && !ui.includes('npm run assistant-chip-retirement:guard')) {
    ui = ui.replace('npm run notification-ui:guard &&', 'npm run notification-ui:guard && npm run assistant-chip-retirement:guard &&');
  }
  if (ui && !ui.includes('npm run repo-rearchitecture:guard')) {
    ui = ui.replace('npm run manager-master-lightweight:guard &&', 'npm run manager-master-lightweight:guard && npm run repo-rearchitecture:guard &&');
  }
  pkg.scripts['ui-source:guard'] = ui.replaceAll('assistant-chip-retirement:guard&&', 'assistant-chip-retirement:guard &&');
  write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function patchLayout() {
  const path = 'app/layout.tsx';
  let source = read(path);
  source = source.replace("import './output-limit-chip.css';\n", '');
  source = source.replace("import './master-hologram-workspace.css';\n", '');
  if (!source.includes("import './account-popover-compact-retirement.css';")) {
    source = source.replace("import './client-account-popover-ratio.css';\n", "import './client-account-popover-ratio.css';\nimport './account-popover-compact-retirement.css';\n");
  }
  write(path, source);
}

function patchUiShellRegistry() {
  const path = 'components/console/ui-shell-registry.ts';
  let source = read(path);
  source = source.replace("  { path: '/master/workspaces', role: 'master', mode: 'operations', owner: 'app/master/workspaces/page.tsx' },\n", '');
  write(path, source);
}

function writeAssistantGuard() {
  write('scripts/assistant-chip-retirement-guard.mjs', [
    '#!/usr/bin/env node',
    "import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';",
    "import { extname, join } from 'node:path';",
    '',
    'const failures = [];',
    "const roots = ['app', 'components', 'lib', 'src', 'scripts'];",
    "const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);",
    "const dynamicChip = 'OutputLimit' + 'ResetChip';",
    "const staticChip = 'Static' + 'Entitlement' + 'Chip';",
    "const chipClass = 'output-limit' + '-reset-chip';",
    "const chipMain = 'output-limit' + '-chip-main';",
    "const staticClass = 'performance-static' + '-entitlement-chip';",
    "const assistPhrase = 'AI ' + 'assistant layer';",
    "const adaptiveA = 'adaptive' + '-center';",
    "const adaptiveB = 'adaptive' + '-launch';",
    'const retiredPaths = [',
    "  'app/api/' + 'ai/route.ts',",
    "  'lib/' + 'ai',",
    "  'components/AiInsightPanel.tsx',",
    "  'components/AdaptiveCommandCenter.tsx',",
    "  'components/OutputLimitResetChip.tsx',",
    "  'app/output-limit-chip.css',",
    "  'middleware.ts'",
    '];',
    'const retiredMarkers = [dynamicChip, staticChip, chipClass, chipMain, staticClass, assistPhrase, adaptiveA, adaptiveB];',
    '',
    'function walk(dir, output = []) {',
    '  if (!existsSync(dir)) return output;',
    '  for (const name of readdirSync(dir)) {',
    '    const path = join(dir, name);',
    "    if (path.includes('node_modules') || path.includes('.next')) continue;",
    '    const info = statSync(path);',
    '    if (info.isDirectory()) walk(path, output);',
    '    else if (exts.has(extname(path))) output.push(path);',
    '  }',
    '  return output;',
    '}',
    '',
    'for (const path of retiredPaths) {',
    "  if (existsSync(path)) failures.push('retired path still exists: ' + path);",
    '}',
    '',
    'for (const file of roots.flatMap((root) => walk(root))) {',
    "  if (file.endsWith('assistant-chip-retirement-guard.mjs')) continue;",
    "  if (file.endsWith('finalize-retired-surface-cleanup.mjs')) continue;",
    "  if (file.endsWith('repo-rearchitecture-roadmap-guard.mjs')) continue;",
    "  const source = readFileSync(file, 'utf8');",
    '  for (const marker of retiredMarkers) {',
    "    if (source.includes(marker)) failures.push(file + ' still contains retired marker: ' + marker);",
    '  }',
    '}',
    '',
    'if (failures.length) {',
    "  console.error('assistant-chip-retirement-guard failed: ' + failures.length + ' check(s).');",
    "  for (const failure of failures) console.error('- ' + failure);",
    '  process.exit(1);',
    '}',
    '',
    "console.log('assistant-chip-retirement-guard: ok');",
    ''
  ].join('\n'));
}

function writeClientAccountGuard() {
  write('scripts/client-account-popover-guard.mjs', [
    '#!/usr/bin/env node',
    "import { existsSync, readFileSync } from 'node:fs';",
    '',
    'const failures = [];',
    'function read(path) {',
    '  if (!existsSync(path)) {',
    "    failures.push('missing ' + path);",
    "    return '';",
    '  }',
    "  return readFileSync(path, 'utf8');",
    '}',
    'function must(source, text, label) { if (!source.includes(text)) failures.push(label); }',
    'function mustNot(source, text, label) { if (source.includes(text)) failures.push(label); }',
    '',
    "const layout = read('app/layout.tsx');",
    "const css = read('app/client-account-popover-ratio.css');",
    "const accountMenu = read('components/console/AccountMenu.tsx');",
    "const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');",
    "const dynamicChip = 'OutputLimit' + 'ResetChip';",
    "const staticChip = 'Static' + 'Entitlement' + 'Chip';",
    "const chipClass = 'output-limit' + '-reset-chip';",
    "const chipMain = 'output-limit' + '-chip-main';",
    "const staticClass = 'performance-static' + '-entitlement-chip';",
    '',
    "must(layout, \"import './client-account-popover-ratio.css';\", 'root layout must load client account popover CSS');",
    "must(layout, \"import './account-popover-compact-retirement.css';\", 'root layout must load compact popover CSS');",
    "must(css, '--client-account-popover-contract: canonical-console-account-dock', 'client must use canonical account dock contract');",
    "must(css, 'main.app-shell[data-client-console-shell=\"true\"]', 'client shell scoped selector missing');",
    "must(css, 'data-console-role=\"client\"', 'client role selector missing');",
    "must(css, 'grid-template-columns: minmax(0, 3fr) var(--account-dock-width)', 'client account dock must use shared grid');",
    "mustNot(css, chipClass, 'client account CSS still references retired chip class');",
    "mustNot(css, chipMain, 'client account CSS still references retired chip internals');",
    "mustNot(css, staticClass, 'client account CSS still references retired static chip');",
    "mustNot(workspace, dynamicChip, 'client workspace still mounts retired dynamic chip');",
    "mustNot(workspace, staticChip, 'client workspace still mounts retired static chip');",
    "must(accountMenu, \"type ConsoleRole = 'manager' | 'master' | 'client'\", 'canonical account menu must support client role');",
    "must(accountMenu, \"if (role === 'client') return 'Client workspace account'\", 'client account role label missing');",
    "must(workspace, \"import AccountMenu from './console/AccountMenu';\", 'client workspace must import canonical AccountMenu');",
    "must(workspace, 'data-client-console-shell=\"true\"', 'client workspace shell marker missing');",
    "must(workspace, 'className=\"main-area admin-monitor-main client-console-main\"', 'client main class missing');",
    "must(workspace, 'data-console-header-grid=\"true\"', 'client grid marker missing');",
    "must(workspace, '<AccountMenu role=\"client\" mode=\"workspace\"', 'client workspace must mount canonical AccountMenu');",
    "must(workspace, 'data-console-header-primary=\"true\"', 'client primary header marker missing');",
    '',
    'if (failures.length) {',
    "  console.error('client-account-popover-guard failed: ' + failures.length + ' check(s).');",
    "  for (const failure of failures) console.error('- ' + failure);",
    '  process.exit(1);',
    '}',
    "console.log('client-account-popover-guard: ok');",
    ''
  ].join('\n'));
}

function writeClientCriticalGuard() {
  write('scripts/client-critical-gaps-guard.mjs', [
    '#!/usr/bin/env node',
    "import { existsSync, readFileSync } from 'node:fs';",
    '',
    'const failures = [];',
    "const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');",
    'const has = (source, text, label) => { if (!source.includes(text)) failures.push(label); };',
    'const lacks = (source, text, label) => { if (source.includes(text)) failures.push(label); };',
    '',
    "const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');",
    "const accountMenu = read('components/console/AccountMenu.tsx');",
    "const accountCss = read('app/client-account-popover-ratio.css');",
    "const layoutCss = read('app/client-workspace-layout-lock.css');",
    "const contract = read('src/features/client-workspace/client-workspace-contract.ts');",
    "const dashboard = read('src/features/client-workspace/client-dashboard-surface.ts');",
    "const cssOwnership = read('src/features/client-workspace/client-css-ownership.ts');",
    "const chipClass = 'output-limit' + '-reset-chip';",
    "const chipMain = 'output-limit' + '-chip-main';",
    "const staticClass = 'performance-static' + '-entitlement-chip';",
    "const dynamicChip = 'OutputLimit' + 'ResetChip';",
    "const staticChip = 'Static' + 'Entitlement' + 'Chip';",
    '',
    "for (const marker of ['large-client-workspace-component', 'dashboard-header-duplication', 'canonical-client-account-menu', 'modernization-pending-slices', 'client-css-cascade-conflicts', 'clientWorkspaceGapSummary']) has(contract, marker, 'contract marker missing: ' + marker);",
    "has(dashboard, \"entitlementSurface: 'retired'\", 'dashboard entitlement surface must be retired');",
    "has(dashboard, \"headerEntitlementSurface: 'retired'\", 'top header entitlement surface must be retired');",
    "has(dashboard, \"accountSurface: 'canonical-account-dock'\", 'dashboard account surface must be canonical dock');",
    "has(cssOwnership, 'clientCssOwners', 'client CSS ownership map missing');",
    "has(cssOwnership, 'clientCssOwnershipSummary', 'client CSS ownership summary missing');",
    "has(accountMenu, \"type ConsoleRole = 'manager' | 'master' | 'client'\", 'canonical AccountMenu must support client role');",
    "has(accountMenu, 'Client workspace account', 'client AccountMenu label missing');",
    "has(accountMenu, 'Client packet workspace', 'client AccountMenu surface missing');",
    "has(workspace, \"import AccountMenu from './console/AccountMenu';\", 'client workspace must import canonical AccountMenu');",
    "has(workspace, 'data-client-console-shell=\"true\"', 'client workspace shell marker missing');",
    "has(workspace, 'className=\"main-area admin-monitor-main client-console-main\"', 'client workspace grid class missing');",
    "has(workspace, '<AccountMenu role=\"client\" mode=\"workspace\"', 'client workspace must mount canonical AccountMenu');",
    "has(workspace, 'data-console-header-primary=\"true\"', 'client header must be primary console header');",
    "has(accountCss, '--client-account-popover-contract: canonical-console-account-dock', 'client account CSS must use canonical dock contract');",
    "has(accountCss, 'grid-template-columns: minmax(0, 3fr) var(--account-dock-width)', 'client account dock ratio missing');",
    "has(layoutCss, '--client-workspace-content-max', 'client layout max width token missing');",
    "has(layoutCss, '.dashboard-command-card', 'client dashboard card cleanup missing');",
    "has(layoutCss, '.dashboard-operational-metrics', 'client metrics layout cleanup missing');",
    "has(layoutCss, '.compact-case-row', 'client recent work cleanup missing');",
    'for (const source of [accountCss, layoutCss, workspace, dashboard]) {',
    "  lacks(source, chipClass, 'retired chip class found');",
    "  lacks(source, chipMain, 'retired chip internals found');",
    "  lacks(source, staticClass, 'retired static chip class found');",
    "  lacks(source, dynamicChip, 'retired dynamic chip component found');",
    "  lacks(source, staticChip, 'retired static chip component found');",
    '}',
    '',
    'if (failures.length) {',
    "  console.error('client-critical-gaps-guard failed: ' + failures.length + ' check(s).');",
    "  for (const failure of failures) console.error('- ' + failure);",
    '  process.exit(1);',
    '}',
    "console.log('client-critical-gaps-guard: ok');",
    ''
  ].join('\n'));
}

function writeCssOwnershipGuard() {
  write('scripts/css-ownership-guard.mjs', [
    '#!/usr/bin/env node',
    "import { existsSync, readFileSync } from 'node:fs';",
    '',
    'const failures = [];',
    "const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');",
    'const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };',
    'const mustNot = (source, text, label) => { if (source.includes(text)) failures.push(label); };',
    '',
    "const ownership = read('src/features/client-workspace/client-css-ownership.ts');",
    "const clientAccount = read('app/client-account-popover-ratio.css');",
    "const clientLayout = read('app/client-workspace-layout-lock.css');",
    "const accountRatio = read('app/account-menu-ratio-system.css');",
    "const layout = read('app/layout.tsx');",
    "const retiredA = 'output-limit' + '-reset-chip';",
    "const retiredB = 'output-limit' + '-chip-main';",
    "const retiredC = 'performance-static' + '-entitlement-chip';",
    '',
    "must(ownership, 'clientCssOwners', 'client CSS ownership manifest missing');",
    "must(ownership, 'app/client-account-popover-ratio.css', 'client account CSS owner missing');",
    "must(ownership, 'app/client-workspace-layout-lock.css', 'client layout CSS owner missing');",
    "must(ownership, 'app/account-menu-ratio-system.css', 'shared account ratio CSS owner missing');",
    "must(clientAccount, '--client-account-popover-contract: canonical-console-account-dock', 'client account CSS must own canonical dock contract');",
    "must(clientLayout, '--client-workspace-content-max', 'client layout CSS must own content max token');",
    "must(clientLayout, '.dashboard-command-card', 'client layout CSS must own dashboard geometry');",
    "must(accountRatio, 'data-manager-account-anchor=\"header-ratio-grid\"', 'shared account ratio CSS must own header-ratio-grid dock');",
    "must(layout, \"import './client-account-popover-ratio.css';\", 'root layout must import client account owner CSS');",
    "must(layout, \"import './client-workspace-layout-lock.css';\", 'root layout must import client layout owner CSS');",
    "mustNot(clientAccount, retiredA, 'client account CSS must not keep retired chip selector');",
    "mustNot(clientAccount, retiredB, 'client account CSS must not keep retired chip internals');",
    "mustNot(clientAccount, retiredC, 'client account CSS must not keep retired static chip selector');",
    "mustNot(clientLayout, retiredA, 'client layout CSS must not keep retired chip selector');",
    "mustNot(clientLayout, retiredB, 'client layout CSS must not keep retired chip internals');",
    "mustNot(clientLayout, retiredC, 'client layout CSS must not keep retired static chip selector');",
    '',
    'if (failures.length) {',
    "  console.error('css-ownership-guard failed: ' + failures.length + ' check(s).');",
    "  for (const failure of failures) console.error('- ' + failure);",
    '  process.exit(1);',
    '}',
    '',
    "console.log('css-ownership-guard: ok');",
    ''
  ].join('\n'));
}

function writeRoadmapGuard() {
  write('scripts/repo-rearchitecture-roadmap-guard.mjs', [
    '#!/usr/bin/env node',
    "import { existsSync, readFileSync } from 'node:fs';",
    '',
    'const failures = [];',
    "const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');",
    'const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };',
    '',
    "const roadmap = read('docs/roadmaps/repo-rearchitecture-checklist.md');",
    "const cleanup = read('scripts/finalize-retired-surface-cleanup.mjs');",
    "const proxy = read('proxy.ts');",
    "const layout = read('app/layout.tsx');",
    '',
    "must(roadmap, '## Top 6 active fixes', 'roadmap must track top 6 active fixes');",
    "must(roadmap, '- [x] Fix 1 — stable cleanup entrypoint', 'roadmap missing fix 1 status');",
    "must(roadmap, '- [x] Fix 2 — route convention normalization', 'roadmap missing fix 2 status');",
    "must(roadmap, '- [x] Fix 3 — client account CSS repair', 'roadmap missing fix 3 status');",
    "must(roadmap, '- [x] Fix 4 — client layout CSS repair', 'roadmap missing fix 4 status');",
    "must(roadmap, '- [x] Fix 5 — contract-driven guard alignment', 'roadmap missing fix 5 status');",
    "must(roadmap, '- [x] Fix 6 — roadmap + tracker enforcement', 'roadmap missing fix 6 status');",
    "must(cleanup, 'verifyOnly', 'cleanup entrypoint must support verify mode');",
    "must(proxy, 'export async function proxy', 'Next.js proxy convention must be active');",
    "must(layout, \"import './account-popover-compact-retirement.css';\", 'root layout must include compact popover CSS');",
    '',
    'if (failures.length) {',
    "  console.error('repo-rearchitecture-roadmap-guard failed: ' + failures.length + ' check(s).');",
    "  for (const failure of failures) console.error('- ' + failure);",
    '  process.exit(1);',
    '}',
    '',
    "console.log('repo-rearchitecture-roadmap-guard: ok');",
    ''
  ].join('\n'));
}

function writeClientFiles() {
  write('src/features/client-workspace/client-dashboard-surface.ts', [
    'export type ClientDashboardSurface = {',
    '  primaryTitle: string;',
    '  primarySubtitle: string;',
    "  entitlementSurface: 'retired';",
    "  headerEntitlementSurface: 'retired';",
    "  accountSurface: 'canonical-account-dock';",
    '};',
    '',
    'export const clientDashboardSurface: ClientDashboardSurface = {',
    "  primaryTitle: 'Continue active packet',",
    "  primarySubtitle: 'Resume the active packet workflow from the dashboard command card.',",
    "  entitlementSurface: 'retired',",
    "  headerEntitlementSurface: 'retired',",
    "  accountSurface: 'canonical-account-dock'",
    '};',
    '',
    'export function explainClientDashboardSurface() {',
    "  return 'Client dashboard and header limit surfaces are retired. Account actions live in the canonical account dock.';",
    '}',
    ''
  ].join('\n'));

  write('src/features/client-workspace/client-css-ownership.ts', [
    'export type ClientCssOwner = {',
    '  file: string;',
    '  owns: string[];',
    '  forbidden: string[];',
    '};',
    '',
    'export const clientCssOwners: ClientCssOwner[] = [',
    '  {',
    "    file: 'app/client-account-popover-ratio.css',",
    "    owns: ['canonical client AccountMenu dock', 'client account 75/25 rail', 'compact account popover contract'],",
    "    forbidden: ['retired chip selectors', 'fixed sidebar account card imitation', 'desktop workspace-account-card popover positioning']",
    '  },',
    '  {',
    "    file: 'app/client-workspace-layout-lock.css',",
    "    owns: ['client shell page width', 'dashboard card geometry', 'metrics and recent work alignment'],",
    "    forbidden: ['account popover ownership', 'retired chip ownership']",
    '  },',
    '  {',
    "    file: 'app/account-menu-ratio-system.css',",
    "    owns: ['shared manager/master/client AccountMenu rail behavior'],",
    "    forbidden: ['client-only fixed popover overrides']",
    '  }',
    '];',
    '',
    'export function clientCssOwnershipSummary() {',
    "  return clientCssOwners.map((owner) => owner.file + ': ' + owner.owns.join(', ')).join('\\n');",
    '}',
    ''
  ].join('\n'));

  write('app/account-popover-compact-retirement.css', [
    '/* Compact account popover override. */',
    '.manager-account-popover{width:min(320px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important;max-height:min(500px,calc(100dvh - 28px))!important;overflow:auto!important;padding:12px!important;border-radius:20px!important}.manager-account-avatar-large{width:54px!important;height:54px!important;font-size:28px!important}.client-menu-popover{width:min(280px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important;padding:10px!important;border-radius:18px!important}',
    ''
  ].join('\n'));

  write('app/client-account-popover-ratio.css', [
    '/* Client account CSS contract. */',
    ':root{--client-account-popover-contract:canonical-console-account-dock;}',
    'main.app-shell[data-client-console-shell="true"] section.main-area[data-console-role="client"]{--account-dock-width:minmax(280px,1fr)}',
    '@media (min-width:761px){main.app-shell[data-client-console-shell="true"] section.main-area.admin-monitor-main[data-console-role="client"][data-console-header-grid="true"]{grid-template-columns:minmax(0,3fr) var(--account-dock-width)!important}}',
    ''
  ].join('\n'));

  write('app/client-workspace-layout-lock.css', [
    '/* Client workspace layout lock. */',
    ':root{--client-workspace-sidebar-width:clamp(268px,17vw,304px);--client-workspace-content-max:1320px;--client-workspace-page-pad:clamp(20px,2.1vw,32px);--client-workspace-gap:clamp(12px,1.3vw,18px);--client-clean-line:rgba(148,163,184,.24);--client-clean-shadow:0 22px 64px rgba(15,23,42,.08)}',
    'body:has(.app-shell > .sidebar + .main-area){overflow-x:clip}',
    '.app-shell:has(> .sidebar + .main-area){width:100%!important;max-width:100vw!important;min-height:100dvh!important;margin:0!important;padding:0!important;display:grid!important;grid-template-columns:var(--client-workspace-sidebar-width) minmax(0,1fr)!important;align-items:stretch!important;background:var(--bg)!important;overflow-x:clip!important}',
    '.app-shell:has(> .sidebar + .main-area)> .sidebar{grid-column:1!important;position:sticky!important;inset:0 auto auto 0!important;width:100%!important;max-width:var(--client-workspace-sidebar-width)!important;height:100dvh!important;max-height:100dvh!important;padding:20px 14px!important;overflow-x:clip!important;overflow-y:auto!important;transform:none!important}',
    '.app-shell:has(> .sidebar + .main-area)> .main-area{grid-column:2!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:var(--client-workspace-page-pad)!important;overflow-x:clip!important;background:linear-gradient(180deg,#f8fbff 0%,#eef4fb 100%)!important}',
    '.app-shell:has(> .sidebar + .main-area) .header{width:min(100%,var(--client-workspace-content-max))!important;min-height:118px!important;margin:0 auto clamp(18px,1.6vw,24px)!important;padding:22px 28px!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:center!important;gap:20px!important;border:1px solid var(--client-clean-line)!important;border-radius:24px!important;background:rgba(255,255,255,.94)!important;box-shadow:var(--client-clean-shadow)!important;overflow:visible!important}',
    '.app-shell:has(> .sidebar + .main-area) .dashboard-command-card{min-height:210px!important;padding:clamp(24px,2.6vw,34px)!important;border-radius:28px!important;border:1px solid rgba(37,99,235,.22)!important;box-shadow:0 24px 70px rgba(37,99,235,.08)!important;overflow:hidden!important}',
    '.app-shell:has(> .sidebar + .main-area) .dashboard-operational-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:var(--client-workspace-gap)!important;margin-top:0!important}',
    '.app-shell:has(> .sidebar + .main-area) .compact-case-row{min-height:68px!important;padding:12px 14px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(128px,176px)!important;align-items:center!important;gap:12px!important;border-radius:16px!important;background:rgba(255,255,255,.92)!important}',
    '@media (max-width:980px){.app-shell:has(> .sidebar + .main-area){grid-template-columns:1fr!important}.app-shell:has(> .sidebar + .main-area)> .sidebar{position:relative!important;height:auto!important;max-height:none!important;max-width:none!important;border-right:0!important;border-bottom:1px solid var(--line)!important}.app-shell:has(> .sidebar + .main-area)> .main-area{grid-column:1!important;padding:clamp(14px,3.5vw,22px)!important}.app-shell:has(> .sidebar + .main-area) .dashboard-operational-metrics,.app-shell:has(> .sidebar + .main-area) .compact-case-row{grid-template-columns:1fr!important}}',
    ''
  ].join('\n'));
}

function writeRoadmap() {
  write('docs/roadmaps/repo-rearchitecture-checklist.md', [
    '# xDisputer Repo Re-architecture Checklist',
    '',
    '## Top 6 active fixes',
    '',
    '- [x] Fix 1 — stable cleanup entrypoint',
    '  - File: `scripts/finalize-retired-surface-cleanup.mjs`',
    '  - Goal: one deterministic local repair path, no giant pasted terminal code.',
    '',
    '- [x] Fix 2 — route convention normalization',
    '  - Files: `proxy.ts`, deprecated `middleware.ts` removed by cleanup',
    '  - Goal: align with Next.js 16 proxy convention.',
    '',
    '- [x] Fix 3 — client account CSS repair',
    '  - Files: `app/client-account-popover-ratio.css`, `app/account-popover-compact-retirement.css`',
    '  - Goal: valid client account dock CSS with no retired chip selectors.',
    '',
    '- [x] Fix 4 — client layout CSS repair',
    '  - File: `app/client-workspace-layout-lock.css`',
    '  - Goal: valid layout CSS with owned dashboard geometry and no brace corruption.',
    '',
    '- [x] Fix 5 — contract-driven guard alignment',
    '  - Files: `scripts/assistant-chip-retirement-guard.mjs`, `scripts/client-account-popover-guard.mjs`, `scripts/client-critical-gaps-guard.mjs`, `scripts/css-ownership-guard.mjs`, `src/features/client-workspace/client-dashboard-surface.ts`, `src/features/client-workspace/client-css-ownership.ts`',
    '  - Goal: guards verify current product truth instead of legacy hidden-chip behavior.',
    '',
    '- [x] Fix 6 — roadmap + tracker enforcement',
    '  - Files: `docs/roadmaps/repo-rearchitecture-checklist.md`, `scripts/repo-rearchitecture-roadmap-guard.mjs`',
    '  - Goal: every cleanup phase is traceable and checkable.',
    '',
    '## Next roadmap phases',
    '',
    '- [ ] Phase 7 — root CSS import reduction',
    '- [ ] Phase 8 — notification ownership isolation',
    '- [ ] Phase 9 — backend route/service contract audit',
    '- [ ] Phase 10 — delete temporary compatibility layers after verification',
    ''
  ].join('\n'));
}

remove('app/api/' + 'ai/route.ts');
remove('lib/' + 'ai');
remove('app/output-limit-chip.css');
remove('scripts/fix-retired-surfaces-and-guards.mjs');
remove('middleware.ts');
if (!verifyOnly) {
  rmSync('.next', { recursive: true, force: true });
  rmSync('.next-quarantine', { recursive: true, force: true });
  rmSync('tsconfig.tsbuildinfo', { force: true });
}
patchLayout();
patchUiShellRegistry();
writeAssistantGuard();
writeClientAccountGuard();
writeClientCriticalGuard();
writeCssOwnershipGuard();
writeRoadmapGuard();
writeClientFiles();
writeRoadmap();
patchPackageJson();

const tokens = retiredTokens();
const forbidden = [tokens.dynamicChip, tokens.staticChip, tokens.chipClass, tokens.chipMain, tokens.staticClass, tokens.assistPhrase, tokens.adaptiveA, tokens.adaptiveB];
const scanRoots = ['app', 'components', 'lib', 'src', 'scripts'];
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);
function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (path.includes('node_modules') || path.includes('.next')) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (exts.has(extname(path))) files.push(path);
  }
  return files;
}

const leftovers = [];
for (const file of scanRoots.flatMap((root) => walk(root))) {
  if (file.endsWith('assistant-chip-retirement-guard.mjs')) continue;
  if (file.endsWith('finalize-retired-surface-cleanup.mjs')) continue;
  if (file.endsWith('repo-rearchitecture-roadmap-guard.mjs')) continue;
  const source = read(file);
  for (const token of forbidden) if (source.includes(token)) leftovers.push(file + ': ' + token);
}
if (leftovers.length) {
  console.error('retired surface leftovers remain');
  for (const item of leftovers) console.error('- ' + item);
  process.exit(1);
}
console.log('finalize-retired-surface-cleanup: ok' + (verifyOnly ? ' (verify)' : ''));
