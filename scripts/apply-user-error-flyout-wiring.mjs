#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const workspacePath = 'components/LetterGeneratorWorkspaceV2.tsx';
const activeErrorStateLine = "  const [activeError, setActiveError] = useState<UserFacingError | null>(null);";
const generateClearLine = '    setActiveError(null);';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) return source;
  console.log(`Applied user-error flyout wiring: ${label}`);
  return source.replace(from, to);
}

function ensureImport(source, anchor, importLine, label) {
  const escaped = importLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicatePattern = new RegExp(`${escaped}\\n`, 'g');
  let next = source.replace(duplicatePattern, '');

  if (next !== source) {
    console.log(`Normalized user-error flyout wiring: ${label} import duplicates`);
  }

  if (!next.includes(anchor)) return source;
  return replaceOnce(next, anchor, `${anchor}\n${importLine}`, label);
}

function normalizeActiveErrorState(source) {
  const statePattern = /^\s*const \[activeError, setActiveError\] = useState<UserFacingError \| null>\(null\);\n/gm;
  const withoutDuplicates = source.replace(statePattern, '');

  if (!withoutDuplicates.includes("  const [statusTone, setStatusTone] = useState<StatusTone>('info');\n")) {
    return source;
  }

  const next = withoutDuplicates.replace(
    "  const [statusTone, setStatusTone] = useState<StatusTone>('info');\n",
    `  const [statusTone, setStatusTone] = useState<StatusTone>('info');\n${activeErrorStateLine}\n`
  );

  if (next !== source) console.log('Normalized user-error flyout wiring: active error state');
  return next;
}

function normalizeGenerateClear(source) {
  const generateStart = "  async function generate() {\n    setGenerateAttempted(true);\n";
  const index = source.indexOf(generateStart);
  if (index < 0) return source;

  const afterStart = index + generateStart.length;
  const before = source.slice(0, afterStart);
  const after = source.slice(afterStart);
  const cleanedAfter = after.replace(/^(?:\s*setActiveError\(null\);\n)+/, '');
  const next = `${before}${generateClearLine}\n${cleanedAfter}`;

  if (next !== source) console.log('Normalized user-error flyout wiring: generate error reset');
  return next;
}

function ensureReportFunction(source) {
  return replaceOnce(
    source,
    "  function report(message: string, tone: StatusTone = 'info') { setStatus(message); setStatusTone(tone); }\n",
    "  function report(message: string, tone: StatusTone = 'info') {\n    setStatus(message);\n    setStatusTone(tone);\n    if (tone === 'error') {\n      setActiveError(explainWebsiteError(message, { operation: 'Workspace action', round, panel }));\n    } else if (tone === 'success') {\n      setActiveError(null);\n    }\n  }\n",
    'error-aware report function'
  );
}

function ensureFragmentAndFlyout(source) {
  let next = source;

  next = replaceOnce(
    next,
    "  return <main className=\"app-shell\">",
    "  return <><main className=\"app-shell\">",
    'fragment wrapper start'
  );

  const flyoutMount = '<UserErrorFlyout issue={activeError} onClose={() => setActiveError(null)} onNavigate={(target) => { setPanel(target); setActiveError(null); }} />';
  const mountPattern = /<UserErrorFlyout issue=\{activeError\}[\s\S]*?\/>(?:<\/>)?/g;
  next = next.replace(mountPattern, '');

  if (next.includes('</section></main>;\n}')) {
    next = replaceOnce(
      next,
      "</section></main>;\n}",
      `</section></main>${flyoutMount}</>;\n}`,
      'flyout render mount'
    );
  } else if (next.includes('</section></main></>;\n}')) {
    next = replaceOnce(
      next,
      "</section></main></>;\n}",
      `</section></main>${flyoutMount}</>;\n}`,
      'flyout render mount'
    );
  }

  return next;
}

function main() {
  if (!existsSync(workspacePath)) {
    console.log('User-error flyout wiring skipped: workspace file not found.');
    return;
  }

  let source = readFileSync(workspacePath, 'utf8');
  const before = source;

  source = ensureImport(
    source,
    "import TemplateProgressiveWorkspace from './TemplateProgressiveWorkspace';",
    "import UserErrorFlyout from './UserErrorFlyout';",
    'component import'
  );

  source = ensureImport(
    source,
    "import { buildGenerationManifest, generationManifestText, normalizeGeneratedOutputForManifest, type GenerationManifest } from '../lib/generation-manifest';",
    "import { explainWebsiteError, type UserFacingError } from '../lib/user-facing-error';",
    'error classifier import'
  );

  source = normalizeActiveErrorState(source);
  source = ensureReportFunction(source);
  source = normalizeGenerateClear(source);
  source = ensureFragmentAndFlyout(source);

  if (source !== before) {
    writeFileSync(workspacePath, source);
    console.log('User-error flyout wiring complete.');
  } else {
    console.log('User-error flyout wiring already present.');
  }
}

main();
