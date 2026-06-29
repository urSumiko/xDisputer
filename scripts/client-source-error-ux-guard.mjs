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
function must(source, marker, label) {
  if (!source.includes(marker)) failures.push(label);
}
function mustNot(source, marker, label) {
  if (source.includes(marker)) failures.push(label);
}

const ux = read('lib/ux-visibility-contract.ts');
const flow = read('components/GuidedSourceDataFlow.tsx');
const rail = read('src/features/generation/components/WorkflowRail.tsx');

must(ux, 'showHeaderNextAction: false', 'client header next-action tracker must stay retired');
must(ux, 'Client errors now surface at the exact workflow stage', 'UX contract must document stage-local client errors');

must(flow, 'const [readinessAttempted, setReadinessAttempted] = useState(false)', 'source flow must track whether the client attempted a blocked action');
must(flow, 'const visibleClientErrorReasons = uniqueBlockers', 'source flow must compute specific visible client error reasons');
must(flow, '{showClientErrorRail && <WorkflowRail', 'workflow rail must render only when specific client errors exist');
must(flow, 'readinessAttempted && !packetReady', 'generation blocked panel must appear only after a failed client action');
must(flow, 'setReadinessAttempted(true);', 'client actions must mark readiness attempt before surfacing errors');
must(flow, 'setReadinessAttempted(false);', 'successful/reset paths must clear readiness attempts');
mustNot(flow, '<WorkflowRail activeStep={workflowActiveStep} blockers={generationBlockReasons} />', 'source flow must not always render workflow rail with generic generation blockers');
mustNot(flow, '{!packetReady && generationBlockReasons.length > 0 && <section id="generation-blocked-reasons"', 'generation readiness panel must not render before the user attempts generation');

must(rail, 'if (!visibleBlockers.length) return null', 'workflow rail must render nothing without blockers');
must(rail, 'data-client-error-only="true"', 'workflow rail must be marked as client-error-only');
must(rail, 'Action needed', 'workflow rail copy must be user-error specific, not generic workflow tracking');
must(rail, 'Client blocker', 'workflow rail list must label specific client blockers');
mustNot(rail, 'Workflow control', 'workflow rail must not use generic Workflow control copy');
mustNot(rail, 'Generation readiness', 'workflow rail must not use generic Generation readiness copy');
mustNot(rail, 'Current step is ready', 'workflow rail must not appear as an always-ready tracker');

if (failures.length) {
  console.error(`client-source-error-ux-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('client-source-error-ux-guard: ok');
