import type { UIContract, UIContractScope } from '../types';

export type ClassificationInput = {
  sourceFile: string;
  routeCount: number;
  markers: string[];
  changedTerms: string[];
};

export type ClassificationResult = {
  scope: UIContractScope;
  shouldPropagate: boolean;
  requiresGuardUpdate: boolean;
  reason: string;
};

const GLOBAL_TERMS = ['ConsoleShell', 'ConsoleHeader', 'AccountMenu', 'navigation-manifest', 'final-console-account-rail', 'canonical-field', 'renderer', 'parser', 'generation-engine'];
const GLOBAL_MARKERS = ['data-console-shell', 'data-console-main', 'data-console-header-grid', 'data-console-account-menu', 'data-console-mode-switch'];

export function classifyChange(input: ClassificationInput): ClassificationResult {
  const hasGlobalTerm = input.changedTerms.some((term) => GLOBAL_TERMS.some((globalTerm) => term.includes(globalTerm)));
  const hasGlobalMarker = input.markers.some((marker) => GLOBAL_MARKERS.includes(marker));

  if (input.routeCount >= 3 || hasGlobalTerm || hasGlobalMarker) {
    return {
      scope: 'global',
      shouldPropagate: true,
      requiresGuardUpdate: true,
      reason: 'The change touches shared shell, account, navigation, canonical template, or appears in at least three routes.'
    };
  }

  if (input.sourceFile.includes('/admin/') || input.sourceFile.includes('/master/') || input.sourceFile.includes('/manager-workspace/')) {
    return {
      scope: 'domain',
      shouldPropagate: true,
      requiresGuardUpdate: true,
      reason: 'The change belongs to an operational domain and may affect sibling routes in the same surface.'
    };
  }

  if (input.sourceFile.includes('components/')) {
    return {
      scope: 'component',
      shouldPropagate: false,
      requiresGuardUpdate: false,
      reason: 'The change is component-level unless the component is registered as global.'
    };
  }

  return {
    scope: 'custom',
    shouldPropagate: false,
    requiresGuardUpdate: false,
    reason: 'No global markers or multi-route usage detected; keep this customization explicit and local.'
  };
}

export function classifyContract(contract: UIContract): ClassificationResult {
  const shouldPropagate = contract.scope === 'global' || contract.scope === 'domain';
  return {
    scope: contract.scope,
    shouldPropagate,
    requiresGuardUpdate: shouldPropagate,
    reason: `${contract.label} is registered as ${contract.scope} and belongs to ${contract.propagationGroup || 'no propagation group'}.`
  };
}

export function isForbiddenGlobalBypass(source: string) {
  return [
    'ControlConsoleShell',
    'className="admin-monitor-account"',
    'data-manager-canonical-switch="true"',
    '<aside className="admin-monitor-sidebar',
    '<section className="admin-monitor-main'
  ].filter((pattern) => source.includes(pattern));
}
