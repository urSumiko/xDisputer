export type AiChangeRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type AiChangeControlPolicy = {
  directToMainAllowed: boolean;
  requirePullRequest: boolean;
  requireBuildPass: boolean;
  requireTypeCheckPass: boolean;
  highRiskPaths: string[];
};

export const aiChangeControlPolicy: AiChangeControlPolicy = {
  directToMainAllowed: false,
  requirePullRequest: true,
  requireBuildPass: true,
  requireTypeCheckPass: true,
  highRiskPaths: [
    'lib/letter-engine.ts',
    'lib/generation-contract.ts',
    'lib/workflow-framework.ts',
    'lib/final-pdf-packet.ts',
    'components/LetterGeneratorWorkspaceV2.tsx'
  ]
};

export function classifyAiChangeRisk(paths: string[]): AiChangeRisk {
  if (paths.some((path) => aiChangeControlPolicy.highRiskPaths.includes(path))) return 'HIGH';
  if (paths.some((path) => path.startsWith('lib/') || path.startsWith('services/') || path.startsWith('workers/'))) return 'MEDIUM';
  return 'LOW';
}

export function aiChangeRequiresPullRequest(paths: string[]) {
  return aiChangeControlPolicy.requirePullRequest || classifyAiChangeRisk(paths) !== 'LOW';
}
