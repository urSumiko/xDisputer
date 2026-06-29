#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', '.next', '.next-quarantine', 'node_modules', '.codespace-sync', 'coverage', 'dist']);
const TARGET_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.sql', '.md']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const relative = path.slice(ROOT.length + 1).replaceAll('\\', '/');
    if (SKIP_DIRS.has(entry) || relative.startsWith('.next-quarantine/')) continue;
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, files);
    else if (TARGET_EXT.has(path.slice(path.lastIndexOf('.')))) files.push(relative);
  }
  return files;
}

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function finding(severity, path, message) {
  return { severity, path, message };
}

const files = walk(ROOT);
const findings = [];
const roadmap = files.includes('docs/roadmaps/repo-rearchitecture-checklist.md')
  ? read('docs/roadmaps/repo-rearchitecture-checklist.md')
  : '';
const hasRootCssRoadmap = roadmap.includes('Phase 7 — root CSS import reduction');
const hasNotificationsSchemaFollowup = files.includes('supabase/migrations/20260620123000_notifications_recipient_role_safe_schema.sql');

for (const file of files) {
  const source = read(file);
  if (/\.tsx?$/.test(file) && source.includes(".from('notifications')") && source.includes('.eq(') && source.indexOf('.eq(') < source.indexOf('.select(')) {
    findings.push(finding('critical', file, 'Supabase query appears to filter before select; use from().select().eq().order().limit().'));
  }
  if (file.startsWith('app/') && file.endsWith('.css') && source.includes('position: fixed') && !source.includes('data-') && !source.includes('contract')) {
    findings.push(finding('warning', file, 'Fixed-position CSS should declare a data/contract owner marker.'));
  }
  if (file.endsWith('.tsx') && source.includes('<NotificationDock') && file !== 'components/console/AccountMenu.tsx') {
    findings.push(finding('warning', file, 'NotificationDock should be owned by AccountMenu/account rail only.'));
  }
  if (file.endsWith('.sql') && (source.includes('create table') || source.includes('alter table')) && !source.includes('notify pgrst')) {
    if (file === 'supabase/schema.sql') continue;
    if (file === 'supabase/migrations/20260617133000_create_notifications.sql' && hasNotificationsSchemaFollowup) continue;
    findings.push(finding('warning', file, 'Schema-changing SQL should include notify pgrst schema reload.'));
  }
}

const rootCss = files.filter((file) => file.startsWith('app/') && file.endsWith('.css')).length;
if (rootCss > 60 && !hasRootCssRoadmap) {
  findings.push(finding('warning', 'app/*.css', `High root CSS count (${rootCss}). Prefer feature-owned CSS or component-contained geometry for new work.`));
}

console.log('Repo precision audit');
console.log(`Scanned files: ${files.length}`);
console.log(`Findings: ${findings.length}`);
for (const item of findings) console.log(`${item.severity.toUpperCase()} ${item.path} - ${item.message}`);

if (findings.some((item) => item.severity === 'critical')) process.exit(1);
