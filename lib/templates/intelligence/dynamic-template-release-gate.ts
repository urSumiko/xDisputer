import type { DynamicTemplateDbClient } from './dynamic-template-types';
import { buildDynamicTemplateExecutionModel } from './dynamic-template-rule-orchestrator';

export async function assertDynamicTemplateReleaseReady(input: { supabase: DynamicTemplateDbClient; managerUserId: string; templateAssetId: string }) {
  const executionModel = await buildDynamicTemplateExecutionModel(input);
  if (!executionModel.ready) {
    return {
      ok: false as const,
      blockers: executionModel.blockers.length ? executionModel.blockers : ['Template rules have not been approved for release.'],
      warnings: executionModel.warnings,
      executionModel,
      reason: executionModel.blockers[0] || 'Template is not release-ready.'
    };
  }
  return {
    ok: true as const,
    blockers: [] as string[],
    warnings: executionModel.warnings,
    executionModel,
    reason: 'Template passed dynamic rule, mapping, parser, renderer, and generation checks.'
  };
}
