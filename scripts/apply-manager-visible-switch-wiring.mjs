#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const layoutPath = 'app/layout.tsx';
const cssPath = 'app/manager-switch-visible.css';

if (!existsSync(layoutPath)) throw new Error('Missing app/layout.tsx');
if (!existsSync(cssPath)) throw new Error('Missing app/manager-switch-visible.css');

const before = readFileSync(layoutPath, 'utf8');
let source = before;
const importLine = "import './manager-switch-visible.css';";
const anchor = "import './professional-console-layout.css';";

if (!source.includes(importLine)) {
  if (!source.includes(anchor)) throw new Error('Missing professional console layout import anchor.');
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

if (!source.includes(importLine)) throw new Error('Manager switch visibility stylesheet was not imported.');

if (source !== before) {
  writeFileSync(layoutPath, source);
  console.log('Applied manager visible switch stylesheet import.');
} else {
  console.log('Manager visible switch stylesheet import already present.');
}
