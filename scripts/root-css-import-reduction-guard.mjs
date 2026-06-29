#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');
const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };
const mustNot = (source, text, label) => { if (source.includes(text)) failures.push(label); };

const layout = read('app/layout.tsx');
const foundation = read('app/root-css-workspace-foundation.css');
const pipeline = read('app/root-css-template-pipeline.css');
const client = read('app/root-css-client-portal.css');
const consoleShell = read('app/root-css-console-shell.css');
const contracts = read('app/root-css-contracts.css');

const bundleImports = [
  "import './root-css-workspace-foundation.css';",
  "import './root-css-template-pipeline.css';",
  "import './root-css-client-portal.css';",
  "import './root-css-console-shell.css';",
  "import './root-css-contracts.css';"
];

for (const marker of bundleImports) must(layout, marker, 'layout must import bundle ' + marker);
mustNot(layout, "import './workspace-light.css';", 'layout must not import workspace-light directly');
mustNot(layout, "import './client-account-popover-ratio.css';", 'layout must not import client account CSS directly');
must(foundation, "@import './globals.css';", 'foundation bundle must include globals');
must(pipeline, "@import './template-flow.css';", 'pipeline bundle must include template flow');
must(client, "@import './client-operations.css';", 'client bundle must include client operations');
must(contracts, "@import './ui-layout-contracts.css';", 'contracts bundle must include layout contracts');

const explicitRailOrder = layout.includes("import './account-menu-ratio-system.css';") &&
  layout.includes("import './final-console-account-rail.css';") &&
  layout.includes("import './console-debug-overlay.css';");
const bundledRailOrder = consoleShell.includes("@import './final-console-account-rail.css';");

if (!explicitRailOrder && !bundledRailOrder) {
  failures.push('account rail CSS must be imported by explicit root order or console shell bundle');
}

if (failures.length) {
  console.error('root-css-import-reduction-guard failed: ' + failures.length + ' check(s).');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('root-css-import-reduction-guard: ok');
