export type ClientCssOwner = {
  file: string;
  owns: string[];
  forbidden: string[];
};

export const clientCssOwners: ClientCssOwner[] = [
  {
    file: 'app/client-account-popover-ratio.css',
    owns: ['canonical client AccountMenu dock', 'client account 75/25 rail', 'compact account popover contract'],
    forbidden: ['retired chip selectors', 'fixed sidebar account card imitation', 'desktop workspace-account-card popover positioning']
  },
  {
    file: 'app/client-workspace-layout-lock.css',
    owns: ['client shell page width', 'dashboard card geometry', 'metrics and recent work alignment'],
    forbidden: ['account popover ownership', 'retired chip ownership']
  },
  {
    file: 'app/account-menu-ratio-system.css',
    owns: ['shared manager/master/client AccountMenu rail behavior'],
    forbidden: ['client-only fixed popover overrides']
  }
];

export function clientCssOwnershipSummary() {
  return clientCssOwners.map((owner) => owner.file + ': ' + owner.owns.join(', ')).join('\n');
}
