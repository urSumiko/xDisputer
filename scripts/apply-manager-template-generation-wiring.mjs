#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const path = 'components/LetterGeneratorWorkspaceV2.tsx';
if (!existsSync(path)) process.exit(0);

const before = readFileSync(path, 'utf8');
let source = before;
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function ensureImport(anchor, line) {
  if (source.includes(line)) return;
  if (!source.includes(anchor)) {
    fail(`Missing import anchor: ${anchor}`);
    return;
  }
  source = source.replace(anchor, `${anchor}\n${line}`);
}

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) {
    fail(`Missing replacement anchor for ${label}`);
    return;
  }
  source = source.replace(search, replacement);
}

function replaceRegexRequired(pattern, replacement, label, alreadyPresent) {
  if (alreadyPresent && source.includes(alreadyPresent)) return;
  if (pattern.test(source)) {
    source = source.replace(pattern, replacement);
    return;
  }
  fail(`Missing regex anchor for ${label}`);
}

function normalizeDuplicateState() {
  source = source.replace(/(?:\s*const \[managerTemplateScope, setManagerTemplateScope\] = useState<ManagerTemplateScopeUi \| null>\(null\);\n){2,}/g, '  const [managerTemplateScope, setManagerTemplateScope] = useState<ManagerTemplateScopeUi | null>(null);\n');
}

function replaceFunctionBodyRequired(name, signaturePattern, replacement, label) {
  if (source.includes(replacement)) return;
  const singleLine = new RegExp(`  function ${name}\\(${signaturePattern}\\) \\{[^\\n]*\\}\\n`, 'm');
  if (singleLine.test(source)) {
    source = source.replace(singleLine, `${replacement}\n`);
    return;
  }
  fail(`Missing function anchor for ${label}`);
}

ensureImport(
  "import { buildGenerationManifest, generationManifestText, normalizeGeneratedOutputForManifest, type GenerationManifest } from '../lib/generation-manifest';",
  "import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';"
);
ensureImport(
  "import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';",
  "import { canUseLocalTemplateFallback, resolveManagerTemplateFile, type ManagerTemplateFileAsset } from '../lib/manager-template-file-resolver';"
);

replaceRequired(
  "  const [registryAssets, setRegistryAssets] = useState<RegistryTemplateAsset[]>([]);",
  "  const [registryAssets, setRegistryAssets] = useState<RegistryTemplateAsset[]>([]);\n  const [managerTemplateScope, setManagerTemplateScope] = useState<ManagerTemplateScopeUi | null>(null);",
  'managerTemplateScope state'
);
normalizeDuplicateState();

replaceRequired(
  "        if (!cancelled) setRegistryAssets(Array.isArray(payload.assets) ? payload.assets : []);",
  "        if (!cancelled) {\n          setRegistryAssets(Array.isArray(payload.assets) ? payload.assets : []);\n          setManagerTemplateScope(payload.managerTemplateScope || null);\n        }",
  'registry payload manager scope capture'
);
replaceRequired(
  "        if (!cancelled) setRegistryAssets([]);",
  "        if (!cancelled) {\n          setRegistryAssets([]);\n          setManagerTemplateScope(null);\n        }",
  'registry failure manager scope reset'
);

source = source.replace(/source: 'SUPABASE_TEMPLATE_ASSET'/g, "source: 'MANAGER_TEMPLATE_ASSET'");
replaceRequired(
  "  const missingLetters = Array.from(new Set(routes.map((route) => route.type))).filter((type) => !refs.find((item) => item.type === type)?.file);",
  "  const missingLetters = Array.from(new Set(routes.map((route) => route.type))).filter((type) => !effectiveRefs.find((item) => item.type === type)?.file);",
  'missingLetters effectiveRefs'
);

replaceFunctionBodyRequired(
  'refBlob',
  'type: LetterType',
  "  function refBlob(type: LetterType) { if (!canUseLocalTemplateFallback(managerTemplateScope || undefined)) return Promise.resolve(null); const slot = refs.find((item) => item.type === type); return slot ? readReferenceFile(slot.id) : Promise.resolve(null); }",
  'refBlob local fallback gating'
);
replaceFunctionBodyRequired(
  'exhibitBlob',
  'kind: ExhibitKind',
  "  function exhibitBlob(kind: ExhibitKind) { return canUseLocalTemplateFallback(managerTemplateScope || undefined) ? readTemplateExhibit(round, kind) : Promise.resolve(null); }",
  'exhibitBlob local fallback gating'
);
replaceRegexRequired(
  /  async function assetBlob\(kind: ExhibitKind\) \{[\s\S]*?\n  \}\n  async function letterBlob/m,
  "  async function assetBlob(kind: ExhibitKind) {\n    return resolveManagerTemplateFile({ round, assets: registryAssets as ManagerTemplateFileAsset[], exhibitKind: kind, localBlob: await exhibitBlob(kind), allowLocalFallback: canUseLocalTemplateFallback(managerTemplateScope || undefined) });\n  }\n  async function letterBlob",
  'assetBlob manager resolver',
  'resolveManagerTemplateFile({ round, assets: registryAssets as ManagerTemplateFileAsset[], exhibitKind: kind'
);
replaceRegexRequired(
  /  async function letterBlob\(type: LetterType\) \{[\s\S]*?\n  \}\n  async function affidavit/m,
  "  async function letterBlob(type: LetterType) {\n    return resolveManagerTemplateFile({ round, assets: registryAssets as ManagerTemplateFileAsset[], letterType: type, localBlob: await refBlob(type), allowLocalFallback: canUseLocalTemplateFallback(managerTemplateScope || undefined) });\n  }\n  async function affidavit",
  'letterBlob manager resolver',
  'resolveManagerTemplateFile({ round, assets: registryAssets as ManagerTemplateFileAsset[], letterType: type'
);
replaceRequired(
  "        references: refs,\n        templates,",
  "        references: effectiveRefs,\n        templates: effectiveTemplates,",
  'generation manifest effective template inputs'
);
replaceRequired(
  "<TemplateProgressiveWorkspace round={round} slots={refs} supportingReady={evidence.supporting.length > 0}",
  "<TemplateProgressiveWorkspace round={round} slots={effectiveRefs} supportingReady={evidence.supporting.length > 0} managerTemplateScope={managerTemplateScope} managedExhibits={effectiveTemplates}",
  'TemplateProgressiveWorkspace manager props'
);

assert(source.includes("import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';"), 'manager scope import not present after wiring');
assert(source.includes("import { canUseLocalTemplateFallback, resolveManagerTemplateFile, type ManagerTemplateFileAsset } from '../lib/manager-template-file-resolver';"), 'manager resolver import not present after wiring');
assert(source.includes('const [managerTemplateScope, setManagerTemplateScope] = useState<ManagerTemplateScopeUi | null>(null);'), 'managerTemplateScope state not present after wiring');
assert(source.includes('setManagerTemplateScope(payload.managerTemplateScope || null);'), 'manager scope payload capture not present after wiring');
assert(source.includes("source: 'MANAGER_TEMPLATE_ASSET'"), 'manager template source not present after wiring');
assert(!source.includes("source: 'SUPABASE_TEMPLATE_ASSET'"), 'old SUPABASE_TEMPLATE_ASSET source remains after wiring');
assert(source.includes('!effectiveRefs.find((item) => item.type === type)?.file'), 'missingLetters still does not use effectiveRefs');
assert(source.includes('resolveManagerTemplateFile({ round, assets: registryAssets as ManagerTemplateFileAsset[]'), 'manager resolver call not present after wiring');
assert(source.includes('managerTemplateScope={managerTemplateScope} managedExhibits={effectiveTemplates}'), 'TemplateProgressiveWorkspace manager props not present after wiring');

if (failures.length) {
  console.error('\nManager template generation wiring failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

if (source !== before) {
  writeFileSync(path, source);
  console.log('Applied manager template generation wiring.');
} else {
  console.log('Manager template generation wiring already present.');
}
