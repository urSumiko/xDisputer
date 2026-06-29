import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'lib/system-core/types.ts',
  'lib/system-core/rbac.ts',
  'lib/system-core/workspace.ts',
  'lib/system-core/event-bus.ts',
  'lib/system-core/design-tokens.ts',
  'lib/system-core/component-registry.ts',
  'lib/system-core/global-core.ts',
  'lib/system-core/index.ts'
];

const requiredMarkers = new Map([
  ['lib/system-core/types.ts', ['ACCOUNT_ROLES', 'WORKSPACE_KINDS', 'SystemCoreSnapshot']],
  ['lib/system-core/rbac.ts', ['ROLE_PERMISSION_MATRIX', 'canOpenWorkspace', 'canManageSubject']],
  ['lib/system-core/workspace.ts', ['createWorkspaceContext', 'validateWorkspaceContext', 'resolveWorkspaceBoundary']],
  ['lib/system-core/event-bus.ts', ['SystemEventBus', 'subscribe', 'publish']],
  ['lib/system-core/design-tokens.ts', ['CANVAS_0_DESIGN_TOKENS', 'DesignTokenRegistry']],
  ['lib/system-core/component-registry.ts', ['CANVAS_0_COMPONENT_IDENTITIES', 'ComponentIdentityRegistry']],
  ['lib/system-core/global-core.ts', ['SystemCore', 'propagateGlobalRule', 'snapshot']],
  ['lib/system-core/index.ts', ["export * from './global-core'"]]
]);

const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing required Canvas 0 file: ${file}`);
    continue;
  }

  const content = readFileSync(file, 'utf8');
  const markers = requiredMarkers.get(file) ?? [];

  for (const marker of markers) {
    if (!content.includes(marker)) {
      errors.push(`Missing marker "${marker}" in ${file}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Canvas 0 System Core Guard failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Canvas 0 System Core Guard passed.');
