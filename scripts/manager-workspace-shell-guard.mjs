#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const checks = [];
function read(path) { const ok = existsSync(path); checks.push({ ok, label: `file exists: ${path}` }); return ok ? readFileSync(path, 'utf8') : ''; }
function has(source, term, label) { checks.push({ ok: source.includes(term), label }); }
function notHas(source, term, label) { checks.push({ ok: !source.includes(term), label }); }
function count(source, term, expected, label) { const actual = source.split(term).length - 1; checks.push({ ok: actual === expected, label: `${label} (${actual}/${expected})` }); }

const page = read('app/manager-workspace/page.tsx');
const shell = read('components/ManagerConsoleShell.tsx');
const client = read('components/ManagerTemplateWorkspaceClient.tsx');
const progressive = read('components/TemplateProgressiveWorkspace.tsx');
const packet = read('components/TemplatePacketConfigurator.tsx');

count(page, '<ManagerConsoleShell', 1, '/manager-workspace has one ManagerConsoleShell owner');
has(page, 'mode="workspace"', '/manager-workspace uses workspace shell mode');
has(page, "session.isMaster ? '/master' : '/admin'", '/manager-workspace keeps role-aware switch target');
has(page, "kind: 'workspace-switch' as const", '/manager-workspace passes one canonical switch item');
notHas(page, '<ManagerWorkspaceSwitch', '/manager-workspace page does not render ad hoc switch');
notHas(page, 'Assigned clients', '/manager-workspace sidebar removed assigned clients');
notHas(page, 'Client workspace view', '/manager-workspace sidebar removed client workspace view');
has(page, 'Packet setup', '/manager-workspace sidebar has packet setup function');
has(page, 'Upload defaults', '/manager-workspace sidebar has upload defaults function');
has(page, 'Template health', '/manager-workspace sidebar has template health function');

count(shell, '<aside className="admin-monitor-sidebar native-console-sidebar">', 1, 'shared shell owns exactly one sidebar element');
count(shell, 'data-manager-canonical-switch="true"', 1, 'shared shell owns exactly one canonical switch marker');
has(shell, '<WorkspaceSwitchAnchor href={accountSwitchTarget}', 'shared shell places switch in account block before sign out');
has(shell, 'navItems.filter((item) => item.kind !== \'workspace-switch\')', 'shared shell keeps switch out of main nav');
has(shell, 'data-manager-shell-nav="true"', 'shared shell owns stable sidebar nav');

notHas(client, 'ManagerConsoleShell', 'manager workspace client does not nest shell');
notHas(client, '<aside', 'manager workspace client does not render sidebar');
notHas(client, '<nav', 'manager workspace client does not render navigation panel');
notHas(client, 'admin-monitor-header native-command-hero', 'manager workspace client does not render duplicate full hero header');
has(client, 'data-manager-workspace-body-shell="compact"', 'manager workspace client uses compact body shell');
has(client, 'compact-workspace-command', 'manager workspace client has compact status command');

notHas(progressive, '<aside', 'progressive workspace does not render sidebar');
notHas(packet, '<aside', 'packet configurator does not render sidebar');
notHas(packet, '<nav', 'packet configurator does not render navigation panel');

checks.forEach((check) => console.log(`${check.ok ? '✅' : '❌'} ${check.label}`));
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\nManager workspace shell guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nManager workspace shell guard passed: ${checks.length} check(s).`);
