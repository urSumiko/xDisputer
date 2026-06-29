export type WorkflowStepId = 'templates' | 'source-data' | 'validation' | 'generate' | 'review' | 'finalize';

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  state: 'complete' | 'active' | 'blocked' | 'pending';
  detail: string;
};

const defaultSteps: readonly WorkflowStep[] = [
  { id: 'templates', label: 'Templates', state: 'complete', detail: 'Template routing is selected before source review.' },
  { id: 'source-data', label: 'Source Data', state: 'active', detail: 'Normalize and verify client Notepad data.' },
  { id: 'validation', label: 'Validation', state: 'pending', detail: 'Confirm scope, affidavit data, required fields, and blockers.' },
  { id: 'generate', label: 'Generate', state: 'pending', detail: 'Generate after visible blockers are cleared.' },
  { id: 'review', label: 'Review Outputs', state: 'pending', detail: 'Review ordered output packages.' },
  { id: 'finalize', label: 'Finalize', state: 'pending', detail: 'Finalize delivery package after output review.' }
] as const;

export type WorkflowRailProps = {
  activeStep?: WorkflowStepId;
  blockers?: readonly string[];
  steps?: readonly WorkflowStep[];
};

export default function WorkflowRail({ blockers = [] }: WorkflowRailProps) {
  const visibleBlockers = blockers.filter((item) => item.trim()).slice(0, 4);
  if (!visibleBlockers.length) return null;

  return <aside className="generation-workflow-rail generation-client-error-rail" data-modernization-feature="generation" data-modernization-owner="src/features/generation" data-client-error-only="true" aria-label="Client action needed">
    <div className="generation-workflow-rail-header">
      <p className="eyebrow">Action needed</p>
      <strong>{visibleBlockers.length === 1 ? 'Fix this issue' : 'Fix these issues'}</strong>
      <span>{visibleBlockers[0]}</span>
    </div>
    <ol className="generation-workflow-rail-list">
      {visibleBlockers.map((reason, index) => <li key={`${reason}-${index}`} data-step-state="blocked">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div><strong>Client blocker</strong><small>{reason}</small></div>
      </li>)}
    </ol>
  </aside>;
}

export { defaultSteps };
