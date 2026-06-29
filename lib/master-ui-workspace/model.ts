export type HologramRole = 'client' | 'manager' | 'master';
export type HologramMode = 'live' | 'edit' | 'navigation' | 'theme' | 'content' | 'behavior' | 'ai' | 'publish';
export type HologramImpact = 'low' | 'medium' | 'high';
export type HologramViewport = 'desktop' | 'tablet' | 'mobile';
export type HologramDensity = 'compact' | 'comfortable' | 'spacious';
export type HologramAlignment = 'left' | 'center';
export type HologramColumnPreset = '1' | '2' | '3' | 'auto';
export type HologramInteraction = 'static' | 'link' | 'action' | 'dataset';

export type HologramBlockProps = {
  eyebrow: string;
  title: string;
  description: string;
  density: HologramDensity;
  alignment: HologramAlignment;
  columns: HologramColumnPreset;
  accent: string;
};

export type HologramBlockBehavior = {
  draggable: boolean;
  resizable: boolean;
  hideOnMobile: boolean;
  interaction: HologramInteraction;
  dataSource: string;
};

export type HologramBlock = {
  id: string;
  type: string;
  title: string;
  region: 'hero' | 'navigation' | 'content' | 'system';
  description: string;
  roles: HologramRole[];
  impact: HologramImpact;
  props: HologramBlockProps;
  behavior: HologramBlockBehavior;
  locked?: boolean;
  status: 'published' | 'draft-ready' | 'guarded';
};

export type HologramNavItem = {
  id: string;
  label: string;
  route: string;
  roles: HologramRole[];
  enabled: boolean;
  locked?: boolean;
};

export type HologramThemeToken = {
  key: string;
  label: string;
  value: string;
  scope: 'global' | HologramRole;
  editable: boolean;
};

export type HologramModeDefinition = {
  id: HologramMode;
  label: string;
  purpose: string;
  guardrail: string;
};

export const HOLOGRAM_MODES: HologramModeDefinition[] = [
  {
    id: 'live',
    label: 'Live View',
    purpose: 'Inspect the currently published UI exactly as each role sees it.',
    guardrail: 'Read-only. Never edits live users directly.'
  },
  {
    id: 'edit',
    label: 'Edit Canvas',
    purpose: 'Drag approved UI blocks like Word paragraphs and preview the reordered layout instantly.',
    guardrail: 'Local draft only until the publish gate validates it.'
  },
  {
    id: 'navigation',
    label: 'Navigation Builder',
    purpose: 'Add, enable, disable, and inspect role-scoped side navigation.',
    guardrail: 'Routes must remain approved and role-gated.'
  },
  {
    id: 'theme',
    label: 'Theme Studio',
    purpose: 'Tune impact tokens for triad surfaces, compactness, borders, chips, and motion.',
    guardrail: 'Only allowlisted tokens may be changed.'
  },
  {
    id: 'content',
    label: 'Content Studio',
    purpose: 'Edit UI wording like a document: eyebrow, title, description, labels, and helper copy.',
    guardrail: 'Presentation copy only. Never hide backend/auth/RLS errors.'
  },
  {
    id: 'behavior',
    label: 'Behavior Studio',
    purpose: 'Control safe UI behavior like interaction type, data source, mobile visibility, and resize readiness.',
    guardrail: 'No unsafe JavaScript, no bypassing permissions, no production publish from local state.'
  },
  {
    id: 'ai',
    label: 'AI Proposal Gate',
    purpose: 'Convert natural-language UI requests into guarded JSON patch proposals.',
    guardrail: 'AI proposes. Master approves. Guards validate.'
  },
  {
    id: 'publish',
    label: 'Publish Center',
    purpose: 'Review draft changes, required guards, risk score, rollback plan, and publish readiness.',
    guardrail: 'Backend draft/publish/rollback comes in the persistence phase.'
  }
];

function blockProps(title: string, description: string, eyebrow: string, accent: string, density: HologramDensity = 'comfortable'): HologramBlockProps {
  return {
    eyebrow,
    title,
    description,
    density,
    alignment: 'left',
    columns: 'auto',
    accent
  };
}

function blockBehavior(dataSource: string, interaction: HologramInteraction, draggable = true): HologramBlockBehavior {
  return {
    draggable,
    resizable: false,
    hideOnMobile: false,
    interaction,
    dataSource
  };
}

export const INITIAL_HOLOGRAM_BLOCKS: HologramBlock[] = [
  {
    id: 'master-command-hero',
    type: 'hero',
    title: 'Command hero',
    region: 'hero',
    description: 'Controls the primary page title, context, action zone, and role-aware visual identity.',
    roles: ['client', 'manager', 'master'],
    impact: 'high',
    props: blockProps('Command hero', 'Controls the primary page title, context, action zone, and role-aware visual identity.', 'Hero', 'master', 'comfortable'),
    behavior: blockBehavior('route.header', 'static', false),
    status: 'published',
    locked: true
  },
  {
    id: 'role-navigation',
    type: 'navigation',
    title: 'Role navigation rail',
    region: 'navigation',
    description: 'Controls side navigation order, labels, route visibility, and role-scoped destinations.',
    roles: ['client', 'manager', 'master'],
    impact: 'high',
    props: blockProps('Role navigation rail', 'Controls side navigation order, labels, route visibility, and role-scoped destinations.', 'Navigation', 'global', 'compact'),
    behavior: blockBehavior('runtime.navigation', 'link'),
    status: 'guarded'
  },
  {
    id: 'account-directory',
    type: 'dataset',
    title: 'Account directory',
    region: 'content',
    description: 'Master account table, filter toolbar, chips, status labels, and pagination surface.',
    roles: ['master'],
    impact: 'high',
    props: blockProps('Account directory', 'Master account table, filter toolbar, chips, status labels, and pagination surface.', 'Dataset', 'master', 'compact'),
    behavior: blockBehavior('master.accountDirectory', 'dataset'),
    status: 'draft-ready'
  },
  {
    id: 'manager-queue',
    type: 'workflow',
    title: 'Manager workflow queue',
    region: 'content',
    description: 'Manager client queues, lifecycle states, exceptions, and reports shell.',
    roles: ['manager', 'master'],
    impact: 'medium',
    props: blockProps('Manager workflow queue', 'Manager client queues, lifecycle states, exceptions, and reports shell.', 'Workflow', 'manager', 'comfortable'),
    behavior: blockBehavior('manager.clientQueue', 'dataset'),
    status: 'draft-ready'
  },
  {
    id: 'client-workbench',
    type: 'workspace',
    title: 'Client workbench',
    region: 'content',
    description: 'Client packet generation, document flow, guidance, and output review surfaces.',
    roles: ['client', 'manager', 'master'],
    impact: 'medium',
    props: blockProps('Client workbench', 'Client packet generation, document flow, guidance, and output review surfaces.', 'Workspace', 'client', 'comfortable'),
    behavior: blockBehavior('client.packetWorkspace', 'action'),
    status: 'draft-ready'
  },
  {
    id: 'theme-token-strip',
    type: 'theme',
    title: 'Triad theme token strip',
    region: 'system',
    description: 'Controls approved token families for Client/Auth Aurora, Manager Graphite, and Master Executive.',
    roles: ['master'],
    impact: 'medium',
    props: blockProps('Triad theme token strip', 'Controls approved token families for Client/Auth Aurora, Manager Graphite, and Master Executive.', 'Theme', 'master', 'compact'),
    behavior: blockBehavior('theme.tokens', 'static'),
    status: 'guarded'
  },
  {
    id: 'ai-proposal-gate',
    type: 'ai-proposal',
    title: 'AI proposal gate',
    region: 'system',
    description: 'Turns AI requests into risk-scored draft proposals with rollback metadata and guard requirements.',
    roles: ['master'],
    impact: 'high',
    props: blockProps('AI proposal gate', 'Turns AI requests into risk-scored draft proposals with rollback metadata and guard requirements.', 'AI Gate', 'master', 'comfortable'),
    behavior: blockBehavior('ai.changeRequests', 'action', false),
    status: 'guarded',
    locked: true
  }
];

export const INITIAL_HOLOGRAM_NAV_ITEMS: HologramNavItem[] = [
  { id: 'nav-monitoring', label: 'Monitoring', route: '/master', roles: ['master'], enabled: true, locked: true },
  { id: 'nav-accounts', label: 'All accounts', route: '/master/accounts', roles: ['master'], enabled: true, locked: true },
  { id: 'nav-workspaces', label: 'Workspaces', route: '/master/workspaces', roles: ['master'], enabled: true },
  { id: 'nav-ui-workspace', label: 'UI workspace', route: '/master/ui-workspace', roles: ['master'], enabled: true },
  { id: 'nav-reports', label: 'Reports', route: '/master/reports', roles: ['master'], enabled: true },
  { id: 'nav-audit', label: 'Audit log', route: '/master/audit', roles: ['master'], enabled: true },
  { id: 'nav-system', label: 'System health', route: '/master/system', roles: ['master'], enabled: true }
];

export const HOLOGRAM_THEME_TOKENS: HologramThemeToken[] = [
  { key: '--x-triad-client-accent', label: 'Client/Auth Aurora accent', value: '#2563eb', scope: 'client', editable: true },
  { key: '--x-triad-manager-accent', label: 'Manager Graphite accent', value: '#0f766e', scope: 'manager', editable: true },
  { key: '--x-triad-master-accent', label: 'Master Executive accent', value: '#4f46e5', scope: 'master', editable: true },
  { key: '--x-surface-radius', label: 'Unified card radius', value: '24px', scope: 'global', editable: true },
  { key: '--x-chip-height', label: 'Compact chip height', value: '32px', scope: 'global', editable: true },
  { key: '--x-float-y', label: 'Global float lift', value: '-1px', scope: 'global', editable: true },
  { key: '--x-shell-sidebar-width', label: 'Client sidebar width', value: 'clamp(244px, 17vw, 296px)', scope: 'global', editable: true },
  { key: '--x-console-sidebar-width', label: 'Console sidebar width', value: 'clamp(216px, 18vw, 260px)', scope: 'global', editable: true }
];

export const HOLOGRAM_GUARD_COMMANDS = [
  'node scripts/master-ui-workspace-guard.mjs',
  'node scripts/unified-surface-contract-guard.mjs',
  'node scripts/theme-governance-contract-guard.mjs',
  'node scripts/instant-performance-guard.mjs',
  'npm run layout:guard',
  'npm run responsive:guard',
  'npm run typecheck',
  'npm run build'
];

export function moveHologramBlock(blocks: HologramBlock[], activeId: string, overId: string) {
  if (activeId === overId) return blocks;
  const activeIndex = blocks.findIndex((block) => block.id === activeId);
  const overIndex = blocks.findIndex((block) => block.id === overId);
  if (activeIndex < 0 || overIndex < 0) return blocks;
  const active = blocks[activeIndex];
  if (active.locked || !active.behavior.draggable) return blocks;
  const next = [...blocks];
  next.splice(activeIndex, 1);
  next.splice(overIndex, 0, active);
  return next;
}

export function createSuggestedNavItem(count: number): HologramNavItem {
  return {
    id: `nav-custom-${count + 1}`,
    label: `Custom workspace ${count + 1}`,
    route: `/master/custom-${count + 1}`,
    roles: ['master'],
    enabled: true
  };
}
