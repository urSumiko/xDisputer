import type { PreflightCheck } from './preflight-validation';
import type { Round } from './reference-store';

export type OperationStatus =
  | 'IDLE'
  | 'SOURCE_IMPORTED'
  | 'PREFLIGHT_BLOCKED'
  | 'READY_TO_GENERATE'
  | 'GENERATING'
  | 'REVIEW_READY'
  | 'PACKAGE_READY'
  | 'FAILED';

export type OperationState =
  | { status: 'IDLE'; message: string }
  | { status: 'SOURCE_IMPORTED'; caseId: string; round: Round; clientName: string; message: string }
  | { status: 'PREFLIGHT_BLOCKED'; caseId: string; blockers: PreflightCheck[]; message: string }
  | { status: 'READY_TO_GENERATE'; caseId: string; routeCount: number; message: string }
  | { status: 'GENERATING'; caseId: string; phase: string; progress: number; message: string }
  | { status: 'REVIEW_READY'; caseId: string; outputCount: number; warningCount: number; message: string }
  | { status: 'PACKAGE_READY'; caseId: string; zipName: string; outputCount: number; message: string }
  | { status: 'FAILED'; caseId?: string; errorMessage: string; nextAction: string; message: string };

export const initialOperationState: OperationState = {
  status: 'IDLE',
  message: 'Configure packet templates, then load a client source file.'
};

export function operationCanGenerate(state: OperationState) {
  return state.status === 'READY_TO_GENERATE';
}

export function operationCanReview(state: OperationState) {
  return state.status === 'REVIEW_READY' || state.status === 'PACKAGE_READY';
}

export function operationIsBusy(state: OperationState) {
  return state.status === 'GENERATING';
}

export function operationStatusTone(state: OperationState): 'info' | 'success' | 'error' {
  if (state.status === 'FAILED' || state.status === 'PREFLIGHT_BLOCKED') return 'error';
  if (state.status === 'SOURCE_IMPORTED' || state.status === 'REVIEW_READY' || state.status === 'PACKAGE_READY') return 'success';
  return 'info';
}

export function generationProgressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}
