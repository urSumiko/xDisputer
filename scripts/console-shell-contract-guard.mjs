#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const tag = '<' + 'Console' + 'Shell';
const wrapperTag = '<' + 'Manager' + 'Console' + 'Shell';
const sidebarMarkup = '<aside className="admin-monitor-sidebar';
const mainMarkup = '<section className="admin-monitor-main';

function read(path) {
  if (!existsSync(path)) {
    failures.push(`missing ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function must(source, term, message) {
  if (!source.includes(term)) failures.push(message);
}

function mustNot(source, term, message) {
  if (source.includes(term)) failures.push(message);
}

function pageUsesShell(label, source, wrapperSource) {
  const direct = source.includes(tag);
  const throughWrapper = source.includes(wrapperTag) && wrapperSource.includes(tag);
  if (!direct && !throughWrapper) failures.push(`${label} must use the canonical console shell runtime path`);
  mustNot(source, sidebarMarkup, `${label} must not own sidebar markup`);
  mustNot(source, mainMarkup, `${label} must not own main markup`);
  mustNot(source, 'className="admin-monitor-account"', `${label} must not render legacy account footer`);
}

const shell = read('components/console/ConsoleShell.tsx');
const wrapper = read('components/ManagerConsoleShell.tsx');
const admin = read('app/admin/page.tsx');
const master = read('app/master/MasterConsoleHome.tsx');
const access = read('app/admin/access/page.tsx');
const clients = read('app/admin/clients/page.tsx');
const menu = read('components/console/AccountMenu.tsx');
const layout = read('app/layout.tsx');
const debuggerMount = read('components/console/RenderDebuggerMount.tsx');
const phase14 = read('scripts/phase14-local-safety-check.mjs');

must(shell, 'data-console-shell="true"', 'shell marker missing');
must(shell, 'data-console-sidebar="true"', 'sidebar marker missing');
must(shell, 'data-console-main="true"', 'main marker missing');
must(shell, 'data-console-layout-ratio="75/25"', 'ratio marker missing');
must(shell, '<AccountMenu', 'account menu placement missing');
must(shell, 'switchModeContract', 'switch mode contract missing');
must(shell, 'data-console-mode-switch="sidebar-bottom"', 'bottom switch missing');
mustNot(shell, wrapperTag, 'canonical shell must not mount wrapper');

must(wrapper, tag, 'manager wrapper must render canonical shell');
must(wrapper, 'switchTarget={targetFor(mode, role)}', 'manager wrapper must forward switch target');
must(wrapper, 'activeNavUsesConsoleLink', 'manager wrapper must use canonical nav links');

pageUsesShell('/admin', admin, wrapper);
pageUsesShell('/master', master, wrapper);
pageUsesShell('/admin/access', access, wrapper);
pageUsesShell('/admin/clients', clients, wrapper);

must(menu, 'data-console-account-menu="true"', 'account menu marker missing');
must(menu, 'data-manager-account-anchor="header-ratio-grid"', 'account anchor marker missing');
must(menu, 'manager-account-settings-form', 'account settings form missing');
must(layout, '<RenderDebuggerMount />', 'lazy runtime debugger mount missing');
must(debuggerMount, "dynamic(() => import('./RenderDebugger')", 'RenderDebugger must load through dynamic import');
must(debuggerMount, 'ssr: false', 'RenderDebugger mount must stay client-only');
must(phase14, 'verification-only mode', 'phase14 verification marker missing');
mustNot(phase14, 'runSelfHealingScript(', 'phase14 must not rewrite source');

if (failures.length) {
  console.error(`Console shell contract guard failed: ${failures.length} check(s) failed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Console shell contract guard passed.');
