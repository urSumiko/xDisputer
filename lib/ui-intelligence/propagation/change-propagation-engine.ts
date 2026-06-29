import type { ChangePropagationPlan, UIContract } from '../types';

function unique(values: string[]) {
  return Array.from(new Set(values)).filter(Boolean);
}

export function createPropagationPlan(contracts: UIContract[], sourceContractId: string, changeType: ChangePropagationPlan['changeType']): ChangePropagationPlan {
  const source = contracts.find((contract) => contract.id === sourceContractId);
  const group = source?.propagationGroup;
  const affected = group
    ? contracts.filter((contract) => contract.propagationGroup === group)
    : source
      ? [source]
      : [];

  const affectedContracts = affected.map((contract) => contract.id);
  const affectedRoutes = unique(affected.flatMap((contract) => contract.connectedRoutes));
  const isGlobal = source?.scope === 'global';
  const isDomain = source?.scope === 'domain';

  return {
    changeId: `${sourceContractId}:${changeType}:${Date.now()}`,
    changeType,
    sourceContractId,
    affectedContracts,
    affectedRoutes,
    safeToAutoApply: false,
    requiredGuards: unique([
      'npm run ui-intelligence:guard',
      'npm run console-shell:guard',
      isGlobal || isDomain ? 'npm run ui-shell:smoke' : '',
      changeType === 'template' ? 'npm run template-execution:guard' : '',
      'npm run typecheck',
      'npm run build'
    ]),
    manualReviewNotes: [
      isGlobal ? 'Global contract changed; verify every route in the propagation group.' : 'Non-global contract changed; verify related routes only.',
      'Do not add route-only CSS unless the classifier says custom and the registry explains why.',
      'Use runtime debugger to confirm markers, grid, and width ratio after local restart.'
    ]
  };
}

export function affectedContractsForRoute(contracts: UIContract[], route: string) {
  return contracts.filter((contract) => contract.connectedRoutes.some((pattern) => {
    if (pattern.endsWith('/*')) return route.startsWith(pattern.slice(0, -1));
    return pattern === route;
  }));
}
