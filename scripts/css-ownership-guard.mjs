#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');
const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };
const mustNot = (source, text, label) => { if (source.includes(text)) failures.push(label); };

const ownership = read('src/features/client-workspace/client-css-ownership.ts');
const clientAccount = read('app/client-account-popover-ratio.css');
const clientLayout = read('app/client-workspace-layout-lock.css');
const accountRatio = read('app/account-menu-ratio-system.css');
const layout = read('app/layout.tsx');
const consoleBundle = read('app/root-css-console-shell.css');
const contractsBundle = read('app/root-css-contracts.css');
const retiredA = 'output-limit' + '-reset-chip';
const retiredB = 'output-limit' + '-chip-main';
const retiredC = 'performance-static' + '-entitlement-chip';

must(ownership, 'clientCssOwners', 'client CSS ownership manifest missing');
must(ownership, 'app/client-account-popover-ratio.css', 'client account CSS owner missing');
must(ownership, 'app/client-workspace-layout-lock.css', 'client layout CSS owner missing');
must(ownership, 'app/account-menu-ratio-system.css', 'shared account ratio CSS owner missing');
must(clientAccount, '--client-account-popover-contract: canonical-console-account-dock', 'client account CSS must own canonical dock contract');
must(clientLayout, '--client-workspace-content-max', 'client layout CSS must own content max token');
must(clientLayout, '.dashboard-command-card', 'client layout CSS must own dashboard geometry');
must(accountRatio, 'data-manager-account-anchor="header-ratio-grid"', 'shared account ratio CSS must own header-ratio-grid dock');

const clientAccountImported = layout.includes("import './client-account-popover-ratio.css';") || consoleBundle.includes("@import './client-account-popover-ratio.css';");
const clientLayoutImported = layout.includes("import './client-workspace-layout-lock.css';") || contractsBundle.includes("@import './client-workspace-layout-lock.css';");

if (!clientAccountImported) failures.push('root layout must import client account owner CSS');
if (!clientLayoutImported) failures.push('root layout must import client layout owner CSS');

mustNot(clientAccount, retiredA, 'client account CSS must not keep retired chip selector');
mustNot(clientAccount, retiredB, 'client account CSS must not keep retired chip internals');
mustNot(clientAccount, retiredC, 'client account CSS must not keep retired static chip selector');
mustNot(clientLayout, retiredA, 'client layout CSS must not keep retired chip selector');
mustNot(clientLayout, retiredB, 'client layout CSS must not keep retired chip internals');
mustNot(clientLayout, retiredC, 'client layout CSS must not keep retired static chip selector');

if (failures.length) {
  console.error('css-ownership-guard failed: ' + failures.length + ' check(s).');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('css-ownership-guard: ok');
