#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function source(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return readFileSync(path, 'utf8');
}

if (existsSync('scripts/apply-manager-visible-switch-wiring.mjs')) {
  execSync('node scripts/apply-manager-visible-switch-wiring.mjs', { stdio: 'inherit' });
}

const css = source('app/manager-switch-visible.css');
const layout = source('app/layout.tsx');
const admin = source('app/admin/page.tsx');
const shell = source('components/ManagerConsoleShell.tsx');

const checks = [
  [admin.includes("{ href: '/manager-workspace', label: 'Switch mode', kind: 'workspace-switch' as const }"), 'admin nav keeps /manager-workspace switch item'],
  [shell.includes('data-manager-canonical-switch="true"'), 'shared shell renders canonical switch marker'],
  [shell.includes('data-manager-shell-nav="true"'), 'shared shell renders stable nav selector'],
  [css.includes('a.manager-workspace-nav-switch[data-manager-canonical-switch="true"]'), 'visibility CSS targets canonical switch only'],
  [css.includes('grid-column: 1 / -1 !important;'), 'visibility CSS gives switch full responsive row'],
  [css.includes('overflow: visible !important;'), 'visibility CSS prevents clipping'],
  [layout.includes("import './manager-switch-visible.css';"), 'layout imports visibility CSS']
];

for (const [ok, label] of checks) console.log(`${ok ? 'OK' : 'FAIL'}: ${label}`);
const failed = checks.filter(([ok]) => !ok);
if (failed.length) throw new Error(`Manager switch CSS guard failed: ${failed.length} check(s).`);
console.log(`Manager switch CSS guard passed: ${checks.length} check(s).`);
