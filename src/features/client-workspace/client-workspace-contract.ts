export type ClientWorkspacePanel = 'Dashboard' | 'Templates' | 'Source Data' | 'Outputs' | 'Client Center' | 'Settings';

export type ClientWorkspaceCriticalGapStatus = 'closed' | 'controlled' | 'pending-extraction';

export type ClientWorkspaceCriticalGap = {
  id: string;
  title: string;
  status: ClientWorkspaceCriticalGapStatus;
  owner: string;
  verification: string;
};

export const clientWorkspaceOwnershipContract = {
  owner: 'src/features/client-workspace',
  activeShell: 'components/LetterGeneratorWorkspaceV2.tsx',
  rule: 'Client workspace should compose feature-owned pieces and avoid duplicated shell, account rail, and entitlement surfaces.'
} as const;

export const clientWorkspacePanels: ClientWorkspacePanel[] = ['Dashboard', 'Templates', 'Source Data', 'Outputs', 'Client Center', 'Settings'];

export const clientWorkspaceCriticalGaps: ClientWorkspaceCriticalGap[] = [
  {
    id: 'large-client-workspace-component',
    title: 'Large client workspace component split',
    status: 'controlled',
    owner: 'components/LetterGeneratorWorkspaceV2.tsx + src/features/client-workspace',
    verification: 'Client workspace now exposes feature contracts and canonical shell markers while preserving generation behavior.'
  },
  {
    id: 'dashboard-header-duplication',
    title: 'Dashboard conceptual header duplication',
    status: 'controlled',
    owner: 'app/client-account-popover-ratio.css + app/client-workspace-layout-lock.css',
    verification: 'Top entitlement chip is hidden; dashboard command card remains the primary entitlement surface.'
  },
  {
    id: 'canonical-client-account-menu',
    title: 'Canonical client account menu',
    status: 'closed',
    owner: 'components/console/AccountMenu.tsx + components/LetterGeneratorWorkspaceV2.tsx',
    verification: 'Client role uses the same AccountMenu dock path as manager/master.'
  },
  {
    id: 'modernization-pending-slices',
    title: 'Canvas modernization pending slices',
    status: 'controlled',
    owner: 'docs/modernization-implementation-tracker.md + feature contracts',
    verification: 'Pending slices are guarded and sequenced instead of hidden in ad hoc CSS or route code.'
  },
  {
    id: 'client-css-cascade-conflicts',
    title: 'Client CSS cascade conflicts',
    status: 'controlled',
    owner: 'app/client-account-popover-ratio.css + app/client-workspace-layout-lock.css',
    verification: 'Client shell has a scoped canonical account dock and duplicate fixed-card selectors are forbidden.'
  }
];

export function clientWorkspaceHeaderLabel(panel: ClientWorkspacePanel, round: string) {
  if (panel === 'Dashboard') return 'Client operations';
  if (panel === 'Client Center') return 'Client workspace';
  return `${round} workflow`;
}

export function clientWorkspaceGapSummary() {
  const closed = clientWorkspaceCriticalGaps.filter((gap) => gap.status === 'closed').length;
  const controlled = clientWorkspaceCriticalGaps.filter((gap) => gap.status === 'controlled').length;
  const pendingExtraction = clientWorkspaceCriticalGaps.filter((gap) => gap.status === 'pending-extraction').length;
  return { total: clientWorkspaceCriticalGaps.length, closed, controlled, pendingExtraction };
}
