#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const has = (path, text, message) => { if (!read(path).includes(text)) failures.push(message); };
const not = (path, text, message) => { if (read(path).includes(text)) failures.push(message); };

has('app/root-css-contracts.css', "@import './ui-theme-contracts.css';", 'root contracts must keep unified theme contracts');
has('app/root-css-contracts.css', "@import './unified-surface-contracts.css';", 'root contracts must keep unified surface contracts');
not('app/root-css-contracts.css', "@import './ui-theme-triad.css';", 'triad theme must stay retired from root contracts');
not('app/root-css-console-shell.css', "@import './obsidian-console.css';", 'obsidian shell theme must stay retired');
not('app/root-css-console-shell.css', "@import './xdisputer-shell-compact.css';", 'compact shell theme must stay retired');
has('lib/ui-intelligence/theme-governance.ts', 'Do not reintroduce client aurora, manager graphite, or master executive theme forks.', 'theme governance must record triad retirement');
has('docs/unified-triad-surface-canvas.md', 'Unified Native Surface Canvas', 'native surface canvas must replace triad canvas');

if (failures.length) {
  console.error('Triad theme retirement guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Triad theme retirement guard passed.');
