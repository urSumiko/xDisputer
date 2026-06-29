export const rootCssOwnershipContract = {
  owner: 'src/features/app-shell',
  rootLayout: 'app/layout.tsx',
  bundles: [
    'app/root-css-workspace-foundation.css',
    'app/root-css-template-pipeline.css',
    'app/root-css-client-portal.css',
    'app/root-css-console-shell.css',
    'app/root-css-contracts.css'
  ],
  rule: 'Only global contracts and shell-level imports belong in root bundles. Feature geometry should move toward feature-owned files.'
} as const;
