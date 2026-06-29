#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();
const failures = [];

function read(path) {
  const full = join(root, path);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${path}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function must(path, text, message) {
  if (!read(path).includes(text)) failures.push(message);
}

function mustNot(path, text, message) {
  if (read(path).includes(text)) failures.push(message);
}

must('lib/ui-intelligence/theme-governance.ts', 'XDISPUTER_THEME_GOVERNANCE_CANVAS', 'Typed theme governance canvas export missing.');
must('lib/ui-intelligence/theme-governance.ts', 'classifyThemeGovernanceIssue', 'Theme issue classifier missing.');
must('lib/ui-intelligence/theme-governance.ts', 'themeGovernanceChecklist', 'Theme checklist helper missing.');
must('lib/ui-intelligence/theme-governance.ts', 'app/ui-theme-contracts.css', 'Visual issues must route to the theme owner file.');
must('lib/ui-intelligence/theme-governance.ts', 'app/unified-surface-contracts.css', 'Shared surface behavior must route to the unified surface owner file.');
must('lib/ui-intelligence/theme-governance.ts', 'app/native-client-console.css', 'Client shell sync issues must route to the native client console owner file.');
must('lib/ui-intelligence/theme-governance.ts', 'app/instant-interaction-performance.css', 'Interaction performance issues must route to the instant layer.');
must('lib/ui-intelligence/theme-governance.ts', 'app/ui-layout-contracts.css', 'Geometry issues must route to the layout owner file.');
must('lib/ui-intelligence/theme-governance.ts', 'Do not reintroduce client aurora, manager graphite, or master executive theme forks.', 'Native UI anti-pattern list missing triad retirement rule.');
must('lib/ui-intelligence/theme-governance.ts', 'Do not create different sidebar/header/card/chip behavior per role unless the function requires it.', 'Surface anti-pattern list missing.');
must('docs/ux-theme-governance-canvas.md', 'xDisputer Unified UX Theme Governance Canvas', 'Governance canvas document missing.');
must('docs/ux-theme-governance-canvas.md', '5W + HOW', 'Governance canvas must include 5W + HOW.');
must('docs/ux-theme-governance-canvas.md', 'What not to do', 'Governance canvas must include anti-patterns.');
must('docs/unified-triad-surface-canvas.md', 'Unified Native Surface Canvas', 'Unified surface canvas document missing native title.');
must('docs/unified-triad-surface-canvas.md', 'one native surface behavior', 'Unified surface workflow missing native surface language.');
must('docs/native-ui-unification-canvas.md', 'Native UI Unification Canvas', 'Native UI unification canvas missing.');
must('app/layout.tsx', 'data-theme-contract="xdisputer-unified"', 'Root theme contract missing.');
must('app/layout.tsx', 'data-ui-scope="global"', 'Root UI scope marker missing.');
must('app/root-css-contracts.css', "@import './unified-surface-contracts.css';", 'Root contracts bundle must keep unified surface import.');
must('app/root-css-client-portal.css', "@import './native-client-console.css';", 'Client portal bundle must import native client console alignment.');
must('app/ui-theme-contracts.css', '--x-theme-version', 'Theme version token missing.');
must('app/ui-theme-contracts.css', 'data-theme-surface="card"', 'Future card hook missing.');
must('app/ui-theme-contracts.css', 'data-theme-loading="skeleton"', 'Loading skeleton hook missing.');
must('app/unified-surface-contracts.css', '--x-unified-surface-contract: ready', 'Unified surface readiness token missing.');

mustNot('app/root-css-contracts.css', "@import './ui-theme-triad.css';", 'Triad theme bundle must stay retired from root contracts.');
mustNot('app/root-css-console-shell.css', "@import './obsidian-console.css';", 'Legacy obsidian console theme must stay retired.');
mustNot('app/root-css-console-shell.css', "@import './xdisputer-shell-compact.css';", 'Legacy compact shell theme must stay retired.');

if (failures.length) {
  console.error('Theme governance contract guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}

console.log('Theme governance contract guard passed.');
