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

must('app/layout.tsx', "import './ui-theme-contracts.css';", 'Root layout must import unified theme contracts.');
must('app/layout.tsx', 'data-theme-contract="xdisputer-unified"', 'Root body must declare the xDisputer unified theme contract.');
must('app/layout.tsx', 'data-ui-scope="global"', 'Root body must declare global UI scope for debugging.');
must('app/layout.tsx', 'data-ui-quality="production"', 'Root body must declare production UI quality mode.');
must('app/layout.tsx', 'data-motion-contract="safe"', 'Root body must declare safe motion contract.');
must('app/layout.tsx', "import './ui-layout-contracts.css';", 'Root layout must keep final layout contracts.');

const layout = read('app/layout.tsx');
if (layout.includes("import './ui-theme-contracts.css';") && layout.includes("import './ui-layout-contracts.css';") && layout.indexOf("import './ui-theme-contracts.css';") > layout.indexOf("import './ui-layout-contracts.css';")) {
  failures.push('ui-theme-contracts.css must import before ui-layout-contracts.css so geometry remains the final owner.');
}

must('app/ui-theme-contracts.css', '--x-theme-contract: ready', 'Theme readiness token missing.');
must('app/ui-theme-contracts.css', '--x-theme-version', 'Theme version marker missing.');
must('app/ui-theme-contracts.css', '--x-color-bg', 'Theme background token missing.');
must('app/ui-theme-contracts.css', '--x-color-surface', 'Theme surface token missing.');
must('app/ui-theme-contracts.css', '--x-color-primary', 'Theme primary token missing.');
must('app/ui-theme-contracts.css', '--x-radius-lg', 'Theme radius token missing.');
must('app/ui-theme-contracts.css', '--x-space-4', 'Theme spacing token missing.');
must('app/ui-theme-contracts.css', '--x-transition-fast', 'Theme transition token missing.');
must('app/ui-theme-contracts.css', 'transition-property: background-color, border-color, box-shadow, color, opacity, transform', 'Theme transitions must stay targeted and safe.');
must('app/ui-theme-contracts.css', 'body[data-theme-contract="xdisputer-unified"] .panel', 'Unified panel surface selector missing.');
must('app/ui-theme-contracts.css', 'body[data-theme-contract="xdisputer-unified"] .action-button', 'Unified primary action selector missing.');
must('app/ui-theme-contracts.css', 'body[data-theme-contract="xdisputer-unified"] .secondary-button', 'Unified secondary action selector missing.');
must('app/ui-theme-contracts.css', 'body[data-theme-contract="xdisputer-unified"] input', 'Unified form control selector missing.');
must('app/ui-theme-contracts.css', 'data-theme-surface="card"', 'Future card customization data hook missing.');
must('app/ui-theme-contracts.css', 'data-theme-action="primary"', 'Future primary action customization data hook missing.');
must('app/ui-theme-contracts.css', 'data-theme-custom="client"', 'Client custom theme hook missing.');
must('app/ui-theme-contracts.css', 'data-theme-custom="manager"', 'Manager custom theme hook missing.');
must('app/ui-theme-contracts.css', 'data-theme-custom="master"', 'Master custom theme hook missing.');
must('app/ui-theme-contracts.css', 'data-theme-custom="auth"', 'Auth custom theme hook missing.');
must('app/ui-theme-contracts.css', '@media (prefers-reduced-motion: reduce)', 'Reduced-motion safety rule missing.');
must('app/ui-theme-contracts.css', '@keyframes xdisputerThemeSkeleton', 'Skeleton loading feedback rule missing.');

must('app/ui-layout-contracts.css', '[data-layout-contract="supporting-documents-editor"]', 'Layout contract must remain present.');
must('app/ui-layout-contracts.css', '[data-layout-contract="command-header"]', 'Command header layout contract must remain present.');

must('docs/ux-theme-governance-canvas.md', 'xDisputer Unified UX Theme Governance Canvas', 'Theme governance canvas document missing or wrong title.');
must('docs/ux-theme-governance-canvas.md', '5W + HOW', 'Theme governance document must include 5W + HOW implementation model.');
must('docs/ux-theme-governance-canvas.md', 'What not to do', 'Theme governance document must define anti-patterns.');

mustNot('app/ui-theme-contracts.css', 'filter: blur(20px)', 'Theme contract must not add heavy blur effects.');
mustNot('app/ui-theme-contracts.css', 'backdrop-filter', 'Theme contract must not rely on expensive backdrop-filter.');
mustNot('app/ui-theme-contracts.css', 'transition-property: all', 'Theme contract must not transition all properties.');
mustNot('app/ui-theme-contracts.css', 'animation: xdisputerThemeSkeleton .2s', 'Skeleton animation must not be overly aggressive.');

if (failures.length) {
  console.error('Theme consistency guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}

console.log('Theme consistency guard passed.');
