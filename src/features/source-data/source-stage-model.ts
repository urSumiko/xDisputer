export type SourceWorkflowStage = 'SOURCE' | 'REVIEW' | 'EVIDENCE';
export type SourceInputMethod = 'CHOOSE' | 'UPLOAD' | 'PASTE';

export function activeWorkflowStepForStage(stage: SourceWorkflowStage) {
  if (stage === 'SOURCE') return 'source-data';
  if (stage === 'REVIEW') return 'validation';
  return 'generate';
}

export function inputMethodForSource(source: string): SourceInputMethod {
  return source ? 'PASTE' : 'CHOOSE';
}
