import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => {
  const path = resolve(root, file);
  if (!existsSync(path)) return '';
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
};
const has = (file, needle) => read(file).includes(needle);
const lines = (file) => read(file).split(/\r?\n/).length;
const count = (file, regex) => (read(file).match(regex) || []).length;

const packageJson = (() => { try { return JSON.parse(read('package.json') || '{}'); } catch { return {}; } })();
const scripts = packageJson.scripts || {};

function signal(id, area, status, severity, evidence, files, score) {
  return { id, area, status, severity, evidence, files, score };
}

function relevant(id) {
  const groups = {
    templates: [
      ['fetchManagerTemplateFile', 'Downloads the latest active manager template file without depending on browser storage.'],
      ['addOrderedPacketFolders', 'Builds the ordered ZIP and now checks manager cloud exhibits before local fallback.'],
      ['readTemplateAssetsForRequest', 'Lists active manager templates for the selected round.']
    ],
    render: [
      ['assertTemplateRenderProof', 'Blocks unresolved placeholders and missing rendered client/template content.'],
      ['renderWithBestTemplateEngine', 'Routes dynamic and legacy rendering through the same proof gate.'],
      ['validateTemplateContentPreserved', 'Protects legal/body template content from accidental deletion.']
    ],
    pdf: [
      ['pdfConversionPolicy', 'Shows whether PDF output is deterministic/server-required.'],
      ['assembleFinalPdfWithRanges', 'Merges PDF parts and records packet page ranges.'],
      ['convertDocxWithServer', 'Uses the server converter before any browser fallback.']
    ],
    notifications: [
      ['useOwnedNotifications', 'Controls notification refresh, realtime, polling, read, and clear behavior.'],
      ['uniqueNotifications', 'Prevents duplicate notification records from showing twice.'],
      ['sync_output_activity_decision_notification_v1', 'Syncs manager approve/return decisions to Disputer notifications.']
    ],
    workspace: [
      ['executeTemplateGeneration', 'Keeps generation orchestration separate from UI behavior.'],
      ['evaluateGenerationPreflight', 'Blocks Generate until templates/source/evidence are ready.'],
      ['buildGenerationManifest', 'Records output proof, routes, and generated document metadata.']
    ],
    repo: [
      ['build realtime recommendations', 'Runs this scanner against latest repo files.'],
      ['repo:verify', 'Runs contract summary, guards, typecheck, and build.'],
      ['contracts:summary', 'Confirms repository contract files exist and are readable.']
    ]
  };
  return (groups[id] || groups.repo).map(([name, purpose]) => ({ name, purpose }));
}

const cssImports = count('app/layout.tsx', /import\s+['"].+?\.css['"]/g);
const notificationComplexity = count('src/features/notifications/useOwnedNotifications.ts', /setInterval|setTimeout|poll|warmup|realtime/gi);
const workspaceLines = lines('components/LetterGeneratorWorkspaceV2.tsx');

const cloudTemplatesReady = has('lib/ordered-packet-archive.ts', 'fetchManagerTemplateFile') && has('lib/manager-template-file-resolver.ts', "cache: 'no-store'") && has('app/api/template-assets/file/route.ts', 'no-store, no-cache');
const renderProofReady = has('lib/template-execution/dynamic-template-engine.ts', 'assertTemplateRenderProof') && has('lib/template-execution/render-proof-gate.ts', 'unresolvedRequiredPlaceholders');
const pdfPolicyReady = has('lib/final-pdf-packet.ts', 'pdfConversionPolicy') && has('lib/pdf-conversion-policy.ts', 'SERVER_REQUIRED');
const repoRecommendExists = Boolean(scripts['repo:recommend']);

const signals = [
  signal('templates', 'Templates / packet generation', cloudTemplatesReady ? 'healthy' : 'critical', cloudTemplatesReady ? 'P2' : 'P0', cloudTemplatesReady ? 'Manager cloud templates are used before local browser fallback.' : 'Packet generation may still depend on local browser templates.', ['lib/ordered-packet-archive.ts', 'lib/manager-template-file-resolver.ts', 'app/api/template-assets/file/route.ts'], cloudTemplatesReady ? 52 : 100),
  signal('render', 'Template rendering', renderProofReady ? 'healthy' : 'critical', renderProofReady ? 'P1' : 'P0', renderProofReady ? 'Render proof gate is wired into dynamic and fallback generation.' : 'Render proof gate is missing or not wired.', ['lib/template-execution/render-proof-gate.ts', 'lib/template-execution/dynamic-template-engine.ts'], renderProofReady ? 64 : 96),
  signal('pdf', 'Merged PDF', pdfPolicyReady ? 'healthy' : 'warning', pdfPolicyReady ? 'P1' : 'P0', pdfPolicyReady ? 'Deterministic PDF policy is present.' : 'PDF conversion may rely on weaker browser fallback.', ['lib/final-pdf-packet.ts', 'lib/pdf-conversion-policy.ts'], pdfPolicyReady ? 62 : 92),
  signal('notifications', 'Notifications', notificationComplexity > 10 ? 'warning' : 'opportunity', notificationComplexity > 10 ? 'P1' : 'P2', `Notification logic has ${notificationComplexity} realtime/poll/timer indicators.`, ['src/features/notifications/useOwnedNotifications.ts', 'lib/notifications/notification-service.ts'], notificationComplexity > 10 ? 86 : 56),
  signal('workspace', 'Workspace architecture', workspaceLines > 150 ? 'warning' : 'opportunity', workspaceLines > 150 ? 'P1' : 'P2', `LetterGeneratorWorkspaceV2 has ${workspaceLines} lines and still owns many workflows.`, ['components/LetterGeneratorWorkspaceV2.tsx'], workspaceLines > 150 ? 82 : 48),
  signal('css', 'UI / CSS ownership', cssImports > 35 ? 'warning' : 'opportunity', cssImports > 35 ? 'P1' : 'P2', `Root layout imports ${cssImports} global CSS files.`, ['app/layout.tsx', 'lib/repository-contract-map.ts'], cssImports > 35 ? 78 : 50),
  signal('repo', 'Repo operations', repoRecommendExists ? 'healthy' : 'warning', repoRecommendExists ? 'P2' : 'P1', repoRecommendExists ? 'Realtime recommendation command exists.' : 'Realtime recommendation command should be added to package.json.', ['package.json', 'scripts/repo-realtime-recommendations.mjs'], repoRecommendExists ? 40 : 75)
].sort((a, b) => b.score - a.score);

const actionCatalog = {
  templates: ['Add/verify manager Template Health before Generate', 'This prevents new computers from failing when local browser storage is empty.', 'Avoids failed ZIP rebuilds and repeated template fetch attempts.'],
  render: ['Expand render proof regression tests for all template families', 'Bad DOCX output must fail before ZIP/PDF packaging.', 'Saves time by stopping invalid generation early.'],
  pdf: ['Verify deterministic server PDF conversion', 'Merged PDFs should match editable DOCX packets.', 'Reduces browser canvas memory spikes during packet merge.'],
  notifications: ['Simplify notification source of truth', 'DB notification rows should be the durable state; realtime should only refresh.', 'Cuts idle polling and duplicate notification work.'],
  workspace: ['Split LetterGeneratorWorkspaceV2 into state/action modules', 'Template, source, output, case, and settings logic should not conflict in one component.', 'Reduces unnecessary re-renders and UI regression risk.'],
  css: ['Enforce CSS ownership before new UI patches', 'Global CSS patch layering is still a layout risk.', 'Reduces style recalculation conflicts and repeated layout bugs.'],
  repo: ['Run one ordered repo verification gate after every fix', 'Recommendations should be tied to latest files and guard output.', 'Stops random fixes from bypassing typecheck/build.']
};

const bestFiveNextLogicalActions = signals.slice(0, 5).map((s, index) => {
  const [title, why, performanceBoost] = actionCatalog[s.id] || actionCatalog.repo;
  return {
    rank: index + 1,
    criticality: s.severity,
    title,
    why,
    evidence: [s.evidence],
    performanceBoost,
    relevantFunctions: relevant(s.id),
    ownerFiles: s.files
  };
});

const report = {
  ok: true,
  generatedAt: new Date().toISOString(),
  source: 'LATEST_REPO_FILES',
  scannedFiles: 16,
  signals,
  bestFiveNextLogicalActions
};

console.log(JSON.stringify(report, null, 2));
