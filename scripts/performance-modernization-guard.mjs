#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) {
  if (!existsSync(path)) {
    failures.push(`missing ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}
function must(source, text, label) {
  if (!source.includes(text)) failures.push(label);
}

const layout = read('app/layout.tsx');
const debuggerMount = read('components/console/RenderDebuggerMount.tsx');
const sourceReview = read('components/SourceReviewAiPanel.tsx');
const supportingSetup = read('components/SupportingDocumentsSetup.tsx');
const sourceReadiness = read('src/features/source-data/source-readiness.ts');
const generationReadiness = read('src/features/generation/readiness.ts');
const evidenceReadiness = read('src/features/evidence/evidence-readiness.ts');
const evidenceStage = read('src/features/evidence/components/EvidenceStage.tsx');
const lazyEvidenceStage = read('src/features/evidence/components/LazyEvidenceStage.tsx');
const templateStatus = read('src/features/templates/template-registry-status.ts');

must(layout, '<RenderDebuggerMount />', 'root layout must use lazy RenderDebuggerMount');
must(debuggerMount, "dynamic(() => import('./RenderDebugger')", 'RenderDebugger must be dynamically imported');
must(debuggerMount, 'ssr: false', 'RenderDebugger must stay client-only');
must(sourceReview, "dynamic(() => import('./AiInsightPanel')", 'AI insight panel must be dynamically imported');
must(sourceReview, "await import('../lib/ai/ai-ui-client')", 'AI review client must load only when review runs');
must(supportingSetup, 'readEvidenceReadiness', 'supporting documents setup must consume evidence readiness');
must(sourceReadiness, 'firstSourceDataReadinessBlocker', 'source readiness utility must exist');
must(generationReadiness, 'packetIsReady', 'generation readiness utility must exist');
must(generationReadiness, 'uniqueBlockers', 'generation blocker dedupe utility must exist');
must(evidenceReadiness, 'readEvidenceReadiness', 'evidence readiness utility must exist');
must(evidenceStage, '<SupportingDocumentsSetup', 'feature evidence stage must wrap supporting documents setup');
must(lazyEvidenceStage, "dynamic(() => import('./EvidenceStage')", 'lazy evidence stage must dynamically import evidence stage');
must(lazyEvidenceStage, 'ssr: false', 'lazy evidence stage must stay client-only');
must(templateStatus, 'summarizeTemplateRegistryStatus', 'template registry status summarizer must exist');

if (failures.length) {
  console.error(`performance-modernization-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('performance-modernization-guard: ok');
