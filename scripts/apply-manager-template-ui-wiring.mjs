#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function writeIfChanged(path, before, after) {
  if (before === after) {
    console.log(`Manager template UI wiring already present: ${path}`);
    return;
  }
  writeFileSync(path, after);
  console.log(`Applied manager template UI wiring: ${path}`);
}

function ensureImport(source, anchor, importLine) {
  if (source.includes(importLine)) return source;
  return source.replace(anchor, `${anchor}\n${importLine}`);
}

function normalizeReadOnlyReason(source) {
  const line = '  const readOnlyReason = managerTemplateLockMessage(managerTemplateScope);';
  const cleaned = source.replace(/^\s*const readOnlyReason = managerTemplateLockMessage\(managerTemplateScope\);\n/gm, '');
  if (!cleaned.includes("  const late = slots.find((slot) => slot.type === 'LATE_PAYMENT');\n")) return source;
  return cleaned.replace(
    "  const late = slots.find((slot) => slot.type === 'LATE_PAYMENT');\n",
    `  const late = slots.find((slot) => slot.type === 'LATE_PAYMENT');\n${line}\n`
  );
}

function normalizePolicyPanel(source) {
  const panel = '      <div className="panel template-manager-policy-inline"><p className="eyebrow">Template authority</p><strong>{canManageTemplates ? \'Manager edit mode\' : \'Read-only client mode\'}</strong><p>{canManageTemplates ? \'Changes here update the manager default templates used by assigned clients.\' : readOnlyReason}</p></div>\n';
  const cleaned = source.replace(/^\s*<div className="panel template-manager-policy-inline"><p className="eyebrow">Template authority<\/p><strong>\{canManageTemplates \? 'Manager edit mode' : 'Read-only client mode'\}<\/strong><p>\{canManageTemplates \? 'Changes here update the manager default templates used by assigned clients\.' : readOnlyReason\}<\/p><\/div>\n/gm, '');
  const anchor = "    <section className={`template-studio template-studio-operational progressive-surface focused-template-configurator ${embedded ? 'embedded-template-configurator' : ''}`}>\n";
  if (!cleaned.includes(anchor)) return source;
  return cleaned.replace(anchor, `${anchor}${panel}`);
}

function normalizeManagerProps(source) {
  source = source.replace(/(?:\s+canManageTemplates\?: boolean;\n\s+managerTemplateScope\?: ManagerTemplateScopeUi \| null;\n\s+managedExhibits\?: TemplateExhibits;\n)+/g, '\n  canManageTemplates?: boolean;\n  managerTemplateScope?: ManagerTemplateScopeUi | null;\n  managedExhibits?: TemplateExhibits;\n');
  source = source.replace(/(?:\s+canManageTemplates = false,\n\s+managerTemplateScope = null,\n\s+managedExhibits,\n)+/g, '\n  canManageTemplates = false,\n  managerTemplateScope = null,\n  managedExhibits,\n');
  return source;
}

function normalizeReadOnlyGuards(source) {
  source = source.replace(/(?:\s*if \(!canManageTemplates\) \{ onMessage\(readOnlyReason\); return; \}\n)+\s*try \{/g, '\n    if (!canManageTemplates) { onMessage(readOnlyReason); return; }\n    try {');
  return source;
}

function patchConfigurator() {
  const path = 'components/TemplatePacketConfigurator.tsx';
  if (!existsSync(path)) return;
  const before = readFileSync(path, 'utf8');
  let source = before;

  source = ensureImport(source, "import type { LetterType } from '../lib/letter-engine';", "import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';");

  source = source.replace(
    "  embedded?: boolean;\n  onUploadLetter:",
    "  embedded?: boolean;\n  canManageTemplates?: boolean;\n  managerTemplateScope?: ManagerTemplateScopeUi | null;\n  managedExhibits?: TemplateExhibits;\n  onUploadLetter:"
  );

  if (!source.includes('function hasManagedExhibits(')) {
    source = source.replace(
      "function Tag({ children }: { children: ReactNode }) {\n  return <span className=\"template-info-tag\">{children}</span>;\n}\n\nfunction mappingMeta",
      "function Tag({ children }: { children: ReactNode }) {\n  return <span className=\"template-info-tag\">{children}</span>;\n}\n\nfunction hasManagedExhibits(values?: TemplateExhibits) {\n  return Boolean(values && Object.values(values).some(Boolean));\n}\n\nfunction versionLabel(value?: number | null) {\n  return typeof value === 'number' ? `v${value}` : 'active';\n}\n\nfunction managerTemplateLockMessage(scope: ManagerTemplateScopeUi | null | undefined) {\n  if (scope?.readOnlyForRequester) return 'Template uploads are locked for clients. Your assigned manager controls the active default template.';\n  return 'Template controls are unavailable until the manager template policy finishes loading.';\n}\n\nfunction mappingMeta"
    );
  }

  source = source.replace(
    "  embedded = false,\n  onUploadLetter,",
    "  embedded = false,\n  canManageTemplates = false,\n  managerTemplateScope = null,\n  managedExhibits,\n  onUploadLetter,"
  );

  source = normalizeManagerProps(source);
  source = normalizeReadOnlyReason(source);

  source = source.replace(
    "  useEffect(() => {\n    let cancelled = false;\n    setActiveNode(null);\n\n    void recoverTemplateExhibitsFromFiles(round)",
    "  useEffect(() => {\n    let cancelled = false;\n    setActiveNode(null);\n\n    if (hasManagedExhibits(managedExhibits)) {\n      setExhibits(managedExhibits!);\n      onExhibitsChange(managedExhibits!);\n      return () => { cancelled = true; };\n    }\n\n    if (!canManageTemplates) {\n      const empty: TemplateExhibits = { FCRA: null, AFFIDAVIT: null, ATTACHMENT: null, FTC: null };\n      setExhibits(empty);\n      onExhibitsChange(empty);\n      return () => { cancelled = true; };\n    }\n\n    void recoverTemplateExhibitsFromFiles(round)"
  );

  source = source.replace("  }, [round]);", "  }, [round, canManageTemplates, managedExhibits]);");

  source = source.replace(
    "  async function uploadLetter(slot: LetterReference, file: File) {\n    try {",
    "  async function uploadLetter(slot: LetterReference, file: File) {\n    if (!canManageTemplates) { onMessage(readOnlyReason); return; }\n    try {"
  );

  source = source.replace(
    "  async function removeLetter(slot: LetterReference) {\n    try {",
    "  async function removeLetter(slot: LetterReference) {\n    if (!canManageTemplates) { onMessage(readOnlyReason); return; }\n    try {"
  );

  source = source.replace(
    "  async function uploadExhibit(kind: ExhibitKind, file: File) {\n    try {",
    "  async function uploadExhibit(kind: ExhibitKind, file: File) {\n    if (!canManageTemplates) { onMessage(readOnlyReason); return; }\n    try {"
  );

  source = source.replace(
    "  async function removeExhibit(kind: ExhibitKind) {\n    try {",
    "  async function removeExhibit(kind: ExhibitKind) {\n    if (!canManageTemplates) { onMessage(readOnlyReason); return; }\n    try {"
  );

  source = normalizeReadOnlyGuards(source);

  source = source.replace(
    "  function LetterActions({ slot, node }: { slot: LetterReference; node: NodeId }) {\n    const active = activeNode === node;",
    "  function LetterActions({ slot, node }: { slot: LetterReference; node: NodeId }) {\n    if (!canManageTemplates) return <div className=\"contextual-actions studio-actions readonly-template-actions\"><span className=\"packet-status neutral\">Manager controlled</span></div>;\n    const active = activeNode === node;"
  );

  source = source.replace(
    "  function ExhibitActions({ kind }: { kind: ExhibitKind }) {\n    const active = activeNode === kind;",
    "  function ExhibitActions({ kind }: { kind: ExhibitKind }) {\n    if (!canManageTemplates) return <div className=\"contextual-actions studio-actions readonly-template-actions\"><span className=\"packet-status neutral\">Manager controlled</span></div>;\n    const active = activeNode === kind;"
  );

  source = normalizePolicyPanel(source);

  source = source.replace(/Cloud saved/g, 'Manager default');
  source = source.replace(/Upload the required/g, 'Manager must upload the required');
  source = source.replace(/Upload when/g, 'Manager uploads when');

  writeIfChanged(path, before, source);
}

function patchWorkspace() {
  const path = 'components/LetterGeneratorWorkspaceV2.tsx';
  if (!existsSync(path)) return;
  const before = readFileSync(path, 'utf8');
  let source = before;

  source = ensureImport(source, "import { buildGenerationManifest, generationManifestText, normalizeGeneratedOutputForManifest, type GenerationManifest } from '../lib/generation-manifest';", "import type { ManagerTemplateScopeUi } from '../lib/manager-template-ui';");

  if (!source.includes('const [managerTemplateScope, setManagerTemplateScope]')) {
    source = source.replace(
      "  const [registryAssets, setRegistryAssets] = useState<RegistryTemplateAsset[]>([]);",
      "  const [registryAssets, setRegistryAssets] = useState<RegistryTemplateAsset[]>([]);\n  const [managerTemplateScope, setManagerTemplateScope] = useState<ManagerTemplateScopeUi | null>(null);"
    );
  }

  source = source.replace(
    "        if (!cancelled) setRegistryAssets(Array.isArray(payload.assets) ? payload.assets : []);",
    "        if (!cancelled) {\n          setRegistryAssets(Array.isArray(payload.assets) ? payload.assets : []);\n          setManagerTemplateScope(payload.managerTemplateScope || null);\n        }"
  );

  source = source.replace(
    "        if (!cancelled) setRegistryAssets([]);",
    "        if (!cancelled) {\n          setRegistryAssets([]);\n          setManagerTemplateScope(null);\n        }"
  );

  source = source.replace(/source: 'SUPABASE_TEMPLATE_ASSET'/g, "source: 'MANAGER_TEMPLATE_ASSET'");
  source = source.replace(
    "  const missingLetters = Array.from(new Set(routes.map((route) => route.type))).filter((type) => !refs.find((item) => item.type === type)?.file);",
    "  const missingLetters = Array.from(new Set(routes.map((route) => route.type))).filter((type) => !effectiveRefs.find((item) => item.type === type)?.file);"
  );

  source = source.replace(
    "  function refBlob(type: LetterType) { const slot = refs.find((item) => item.type === type); return slot ? readReferenceFile(slot.id) : Promise.resolve(null); }",
    "  function refBlob(type: LetterType) { if (!managerTemplateScope?.canManageTemplates) return Promise.resolve(null); const slot = refs.find((item) => item.type === type); return slot ? readReferenceFile(slot.id) : Promise.resolve(null); }"
  );

  source = source.replace(
    "  function exhibitBlob(kind: ExhibitKind) { return readTemplateExhibit(round, kind); }",
    "  function exhibitBlob(kind: ExhibitKind) { return managerTemplateScope?.canManageTemplates ? readTemplateExhibit(round, kind) : Promise.resolve(null); }"
  );

  source = source.replace(
    "      const persistedManifest = buildGenerationManifest({\n        round,\n        parsed,\n        routes,\n        references: refs,\n        templates,",
    "      const persistedManifest = buildGenerationManifest({\n        round,\n        parsed,\n        routes,\n        references: effectiveRefs,\n        templates: effectiveTemplates,"
  );

  source = source.replace(
    "<TemplateProgressiveWorkspace round={round} slots={refs} supportingReady={evidence.supporting.length > 0}",
    "<TemplateProgressiveWorkspace round={round} slots={effectiveRefs} supportingReady={evidence.supporting.length > 0} managerTemplateScope={managerTemplateScope} managedExhibits={effectiveTemplates}"
  );

  writeIfChanged(path, before, source);
}

patchConfigurator();
patchWorkspace();
