import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`Missing ${path}`), '');
const has = (path, text, message) => { if (!read(path).includes(text)) failures.push(message); };
const not = (path, text, message) => { if (read(path).includes(text)) failures.push(message); };

has('app/layout.tsx', "import './unified-surface-contracts.css';", 'layout must import unified surface contracts');
has('app/layout.tsx', "import './ui-theme-triad.css';", 'layout must keep triad theme import');
has('app/layout.tsx', "import './instant-interaction-performance.css';", 'layout must keep instant interaction import');
has('app/layout.tsx', "import './ui-layout-contracts.css';", 'layout must keep final layout import');

const layout = read('app/layout.tsx');
const triad = layout.indexOf("import './ui-theme-triad.css';");
const surface = layout.indexOf("import './unified-surface-contracts.css';");
const instant = layout.indexOf("import './instant-interaction-performance.css';");
const layoutContract = layout.indexOf("import './ui-layout-contracts.css';");
if (!(triad >= 0 && surface > triad && instant > surface && layoutContract > instant)) failures.push('import order must be triad then surface then instant then layout');

has('app/unified-surface-contracts.css', '--x-unified-surface-contract: ready', 'surface readiness token missing');
has('app/unified-surface-contracts.css', '--x-shell-sidebar-width', 'client sidebar token missing');
has('app/unified-surface-contracts.css', '--x-console-sidebar-width', 'console sidebar token missing');
has('app/unified-surface-contracts.css', '--x-active-surface: client-aurora', 'client surface missing');
has('app/unified-surface-contracts.css', '--x-active-surface: manager-graphite', 'manager surface missing');
has('app/unified-surface-contracts.css', '--x-active-surface: master-executive', 'master surface missing');
has('app/unified-surface-contracts.css', '.app-shell > .sidebar', 'client sidebar behavior missing');
has('app/unified-surface-contracts.css', '.admin-monitor-sidebar.native-console-sidebar', 'console sidebar behavior missing');
has('app/unified-surface-contracts.css', '.admin-monitor-header', 'header behavior missing');
has('app/unified-surface-contracts.css', '.console-header-card', 'console header behavior missing');
has('app/unified-surface-contracts.css', '.directory-filter-form', 'filter behavior missing');
has('app/unified-surface-contracts.css', '.admin-monitor-table-wrap', 'table overflow behavior missing');
has('app/unified-surface-contracts.css', '.admin-status-badge', 'status badge behavior missing');
has('app/unified-surface-contracts.css', 'backdrop-filter: none', 'auth blur override missing');
has('app/unified-surface-contracts.css', '@media (max-width: 980px)', 'tablet behavior missing');
has('app/unified-surface-contracts.css', '@media (max-width: 760px)', 'mobile behavior missing');
has('components/console/ConsoleShell.tsx', 'data-console-role={role}', 'console role debug hook missing');
has('components/ConsoleNavLink.tsx', 'prefetch', 'console prefetch missing');
has('docs/unified-triad-surface-canvas.md', 'Unified Triad Surface Canvas', 'canvas document missing');
has('docs/unified-triad-surface-canvas.md', '5W + HOW', 'canvas 5W missing');
has('docs/unified-triad-surface-canvas.md', 'What should not happen', 'canvas safeguards missing');

not('app/unified-surface-contracts.css', 'transition-property: all', 'no transition all allowed');
not('app/unified-surface-contracts.css', 'filter: blur', 'no blur allowed');
not('app/unified-surface-contracts.css', 'min-width:1200px', 'no fixed desktop min width allowed');
not('app/unified-surface-contracts.css', 'width:1600px', 'no fixed wide width allowed');

if (failures.length) {
  console.error('Unified surface contract guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Unified surface contract guard passed.');
