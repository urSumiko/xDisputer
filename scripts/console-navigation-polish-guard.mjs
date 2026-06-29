#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) {
  if (!existsSync(path)) {
    failures.push(`missing ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}
function must(source, marker, label) {
  if (!source.includes(marker)) failures.push(label);
}
function mustNot(source, marker, label) {
  if (source.includes(marker)) failures.push(label);
}

const layout = read('app/layout.tsx');
const css = read('app/console-navigation-polish.css');
const shell = read('components/console/ConsoleShell.tsx');
const client = read('components/LetterGeneratorWorkspaceV2.tsx');
const accountMenu = read('components/console/AccountMenu.tsx');

must(layout, "import './console-navigation-polish.css';", 'root layout must load global console navigation polish CSS');
must(css, '--console-navigation-polish-contract: unified-sidebar-icons-spacing-motion', 'console navigation polish contract marker missing');
must(css, '--console-single-header-contract: console-header-is-main', 'single sticky header contract marker missing');
must(css, '--console-main-header-height: clamp(88px, 6.6vw, 104px)', 'shared sticky header height token missing');
must(css, '--console-nav-icon-size: 34px', 'navigation icon size token missing');
must(css, '--console-nav-transition: 180ms cubic-bezier(.2, .8, .2, 1)', 'smooth navigation transition token missing');
must(css, '.admin-monitor-page[data-console-shell="true"] .admin-monitor-sidebar nav a::before', 'manager/master sidebar links must receive icon slots');
must(css, '.app-shell[data-client-console-shell="true"] .sidebar nav button::before', 'client sidebar buttons must receive icon slots');
must(css, '.app-shell[data-client-console-shell="true"] .sidebar nav button:nth-child(3)::before', 'client Source Data nav icon slot missing');
must(css, '.admin-monitor-page[data-console-shell="true"] .admin-monitor-sidebar nav a[href*="access"]::before', 'manager access-control nav icon slot missing');
must(css, 'transition: transform var(--console-nav-transition)', 'nav items must use smooth transform transitions');
must(css, 'border-radius: var(--console-nav-item-radius)', 'nav items must use rounded corners');
must(css, 'grid-template-rows: var(--console-main-header-height) auto !important', 'console grid must reserve a single sticky header row');
must(css, 'display: none !important', 'duplicate top-level console headers must be retired by CSS contract');
must(css, 'grid-column: 1 / -1 !important', 'content below sticky header must span the console grid');
must(css, 'row-gap: var(--console-header-content-gap)', 'console header grid must reserve content gap');
must(shell, 'className="admin-monitor-sidebar native-console-sidebar"', 'manager/master shell must use canonical sidebar class');
must(shell, 'data-console-sidebar="true"', 'manager/master sidebar marker missing');
must(client, 'className="app-shell"', 'client shell class missing');
must(client, '<aside className="sidebar">', 'client sidebar class missing');
must(accountMenu, 'data-manager-account-layout="compact-sticky-bell-avatar-row"', 'account menu must use compact sticky bell/avatar layout marker');
mustNot(accountMenu, '<style data-account-rail-contract="true">', 'AccountMenu must not inject inline account rail CSS after global CSS');
mustNot(accountMenu, '--account-dock-height: clamp(136px', 'AccountMenu must not force tall account rail height');

if (failures.length) {
  console.error(`console-navigation-polish-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('console-navigation-polish-guard: ok');
