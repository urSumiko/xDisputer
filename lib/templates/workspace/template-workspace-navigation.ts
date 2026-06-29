export type TemplateWorkspaceNavId = 'template-library' | 'template-studio' | 'generation-engine' | 'template-test-lab';

export type TemplateWorkspaceProcess = 'template-source-of-truth' | 'template-authoring-rules' | 'template-execution-control' | 'template-output-test-lab';

export type TemplateWorkspaceNavItem = {
  id: TemplateWorkspaceNavId;
  label: string;
  shortLabel: string;
  href: string;
  process: TemplateWorkspaceProcess;
  description: string;
  owns: string[];
  doesNotOwn: string[];
};

export const TEMPLATE_WORKSPACE_NAV_ITEMS: TemplateWorkspaceNavItem[] = [
  {
    id: 'template-library',
    label: 'Template Library',
    shortLabel: 'Library',
    href: '/manager-workspace',
    process: 'template-source-of-truth',
    description: 'Upload, assign, version, and sync manager templates to Disputer workspaces.',
    owns: ['template upload', 'round selection', 'template versions', 'Disputer assignment coverage', 'sync readiness'],
    doesNotOwn: ['parser rules', 'canonical mapping editor', 'release automation', 'Disputer monitoring']
  },
  {
    id: 'template-studio',
    label: 'Template Studio',
    shortLabel: 'Studio',
    href: '/manager-workspace/studio',
    process: 'template-authoring-rules',
    description: 'Control parser, renderer, variables, canonical mappings, entities, static preservation, and table rules.',
    owns: ['parser rules', 'preserve static text', 'canonical field mapping', 'variables and entities', 'table layout logic', 'conflict resolution'],
    doesNotOwn: ['Disputer approval monitoring', 'release execution', 'master governance', 'account settings']
  },
  {
    id: 'template-test-lab',
    label: 'Template Test Lab',
    shortLabel: 'Test Lab',
    href: '/manager-workspace/test',
    process: 'template-output-test-lab',
    description: 'Run manager-owned template output checks, preview sample generated letters, and download active template files before Disputers use them.',
    owns: ['sample output preview', 'template test cases', 'download active template', 'pre-Disputer precision check'],
    doesNotOwn: ['template upload', 'canonical mapping edits', 'payroll reports', 'master account limits']
  },
  {
    id: 'generation-engine',
    label: 'Generation Engine',
    shortLabel: 'Engine',
    href: '/manager-workspace/engine',
    process: 'template-execution-control',
    description: 'Validate release readiness, diagnostics, automation safety, and engine status after testing.',
    owns: ['renderer diagnostics', 'release readiness', 'automation safety', 'engine logs'],
    doesNotOwn: ['raw mapping editing', 'account settings', 'Disputer approval monitoring', 'template upload']
  }
];

export function templateWorkspaceNavForPath(pathname: string) {
  return TEMPLATE_WORKSPACE_NAV_ITEMS.map((item) => ({
    href: item.href,
    label: item.label,
    active: item.href === '/manager-workspace' ? pathname === '/manager-workspace' : pathname.startsWith(item.href)
  }));
}

export function getTemplateWorkspaceNavItem(id: TemplateWorkspaceNavId) {
  return TEMPLATE_WORKSPACE_NAV_ITEMS.find((item) => item.id === id) || null;
}

export function assertTemplateWorkspaceNavContract() {
  const required = new Set<TemplateWorkspaceNavId>(['template-library', 'template-studio', 'template-test-lab', 'generation-engine']);
  const labels = new Set<string>();
  const errors: string[] = [];
  TEMPLATE_WORKSPACE_NAV_ITEMS.forEach((item) => {
    required.delete(item.id);
    if (labels.has(item.label)) errors.push(`duplicate template workspace label: ${item.label}`);
    labels.add(item.label);
    if (!item.owns.length) errors.push(`${item.label} must own at least one process.`);
    if (!item.doesNotOwn.length) errors.push(`${item.label} must declare boundaries.`);
  });
  required.forEach((id) => errors.push(`missing template workspace nav item: ${id}`));
  if (TEMPLATE_WORKSPACE_NAV_ITEMS.length !== 4) errors.push('manager workspace navigation must have exactly 4 functional hubs.');
  return errors;
}
