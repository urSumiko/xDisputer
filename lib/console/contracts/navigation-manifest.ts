export type ConsoleDomain = 'manager-authoring' | 'manager-operations' | 'master-governance';
export type ConsoleRole = 'manager' | 'master';
export type ConsoleMode = 'operations' | 'workspace';
export type ConsolePanelStatus = 'planned' | 'wired' | 'active';

export type ConsolePanelManifest = {
  id: string;
  domain: ConsoleDomain;
  role: ConsoleRole;
  mode: ConsoleMode;
  href: string;
  label: string;
  shortLabel: string;
  capability: string;
  status: ConsolePanelStatus;
  ownerFile: string;
  purpose: string;
  notResponsibleFor: string[];
  fiveW: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
  };
  how: string[];
  whatIf: string[];
  ifElse: string[];
  wiredProcesses: string[];
  integrationPoints: string[];
  dataContracts: string[];
  verification: string[];
};

export const CONSOLE_DOMAIN_LABELS: Record<ConsoleDomain, string> = {
  'manager-authoring': 'Manager workspace',
  'manager-operations': 'Manager monitoring',
  'master-governance': 'Master governance'
};

export const CONSOLE_DOMAIN_DESCRIPTIONS: Record<ConsoleDomain, string> = {
  'manager-authoring': 'Authoring plane for manager-owned templates, mappings, validation, releases, and automation.',
  'manager-operations': 'Operations plane for clients, outputs, exceptions, capacity, filings, reports, and audit.',
  'master-governance': 'Governance plane for all accounts, workspaces, policies, entitlements, deployments, and incidents.'
};

const authoringNotOps = ['Client approval queues', 'Account suspension', 'Global policy changes', 'Cross-manager deployment decisions'];
const opsNotAuthoring = ['Template authoring', 'Template release promotion', 'Canonical placeholder editing', 'Master-wide policy authoring'];
const masterNotManager = ['Single-manager template editing', 'Per-client workspace generation editing', 'Manager daily queue ownership'];

export const CONSOLE_TRANSFORMATION_PANELS: ConsolePanelManifest[] = [
  {
    id: 'manager-template-library',
    domain: 'manager-authoring',
    role: 'manager',
    mode: 'workspace',
    href: '/manager-workspace',
    label: 'Template Library',
    shortLabel: 'Library',
    capability: 'manager.template.library',
    status: 'active',
    ownerFile: 'app/manager-workspace/page.tsx',
    purpose: 'Manage active manager-owned template assets and provide the default authoring landing surface.',
    notResponsibleFor: authoringNotOps,
    fiveW: { who: 'Manager or master acting as template authority', what: 'Active template assets and round slots', when: 'Before client generation or after template upload', where: '/manager-workspace', why: 'Clients must use their assigned manager template assets.' },
    how: ['Resolve manager template scope', 'Fetch active template assets by round', 'Hydrate TemplateProgressiveWorkspace'],
    whatIf: ['If no active slot exists, show missing slot state.', 'If user is read-only, hide mutation controls.'],
    ifElse: ['If managerTemplateScope.canManageTemplates then allow upload/remove.', 'Else show read-only manager template proof.'],
    wiredProcesses: ['Template asset fetch', 'Template upload/remove mutation', 'Round switching'],
    integrationPoints: ['/api/template-assets', 'ManagerTemplateWorkspaceClient', 'TemplateProgressiveWorkspace'],
    dataContracts: ['ManagerTemplateScopeUi', 'TemplateRegistryAsset', 'TemplateSourceRef'],
    verification: ['template-execution:guard', 'ui-source:guard', 'window.__xdisputerDebug']
  },
  {
    id: 'manager-contracts-center',
    domain: 'manager-authoring',
    role: 'manager',
    mode: 'workspace',
    href: '/manager-workspace/contracts',
    label: 'Contracts Center',
    shortLabel: 'Contracts',
    capability: 'manager.template.contracts',
    status: 'wired',
    ownerFile: 'app/manager-workspace/contracts/page.tsx',
    purpose: 'Review contract version, required fields, placeholder aliases, and readiness before a template can be promoted.',
    notResponsibleFor: authoringNotOps,
    fiveW: { who: 'Template manager', what: 'Dynamic template contract and field coverage', when: 'After upload and before release', where: '/manager-workspace/contracts', why: 'Blocks silent renderer mismatch and missing canonical fields.' },
    how: ['Read template validation JSON', 'Compare aliases with canonical field registry', 'Surface contract-v2 readiness'],
    whatIf: ['If contract-v2 is missing, queue normalization review.', 'If required aliases are missing, block release.'],
    ifElse: ['If all required aliases are covered, mark releasable.', 'Else route to Mapping Studio.'],
    wiredProcesses: ['Canonical field validation', 'Contract-v2 readiness', 'Release blocking'],
    integrationPoints: ['field-registry.ts', 'dynamic-template/contract-v2.ts', 'TemplateExecutionOrchestrator'],
    dataContracts: ['CanonicalFieldKey', 'DynamicTemplateContract', 'TemplateValidationJson'],
    verification: ['template-execution:guard', 'dynamic-template:v2:regression']
  },
  {
    id: 'manager-mapping-studio',
    domain: 'manager-authoring',
    role: 'manager',
    mode: 'workspace',
    href: '/manager-workspace/mappings',
    label: 'Mapping Studio',
    shortLabel: 'Mappings',
    capability: 'manager.template.mappings',
    status: 'wired',
    ownerFile: 'app/manager-workspace/mappings/page.tsx',
    purpose: 'Connect source parser output to canonical fields and template aliases for each route and round.',
    notResponsibleFor: authoringNotOps,
    fiveW: { who: 'Template manager', what: 'Source-to-canonical-to-template mapping', when: 'Whenever parser, canonical field, or template aliases change', where: '/manager-workspace/mappings', why: 'One mapping layer prevents duplicate field logic in UI components.' },
    how: ['Use CanonicalSourceModel', 'Preview render-plan fields', 'Flag unmapped aliases'],
    whatIf: ['If parser output changes, compare coverage before release.', 'If aliases conflict, choose canonical winner.'],
    ifElse: ['If canonical value exists, bind it.', 'Else mark missing and block production release.'],
    wiredProcesses: ['Parser coverage review', 'Canonical mapping review', 'Alias conflict resolution'],
    integrationPoints: ['canonical-source-model.ts', 'mapping-engine.ts', 'field-registry.ts'],
    dataContracts: ['CanonicalSourceModel', 'RenderPlan', 'FieldMappingResult'],
    verification: ['template-execution:guard']
  },
  {
    id: 'manager-quality-lab',
    domain: 'manager-authoring',
    role: 'manager',
    mode: 'workspace',
    href: '/manager-workspace/quality',
    label: 'Quality Lab',
    shortLabel: 'Quality',
    capability: 'manager.template.quality',
    status: 'wired',
    ownerFile: 'app/manager-workspace/quality/page.tsx',
    purpose: 'Run dry renders, dynamic-v2 validation, legacy fallback visibility, and output proof before release.',
    notResponsibleFor: authoringNotOps,
    fiveW: { who: 'Template manager', what: 'Template quality and renderer behavior', when: 'Before release and after any mapping change', where: '/manager-workspace/quality', why: 'Catches renderer mismatch before clients generate packages.' },
    how: ['Trigger dry render path', 'Inspect runtime execution snapshot', 'Record warnings and fallback engines'],
    whatIf: ['If v2 renderer fails, expose fallback reason.', 'If legacy adapter renders, require follow-up contract fix.'],
    ifElse: ['If dynamic-template-v2 passes, allow release review.', 'Else quarantine template version.'],
    wiredProcesses: ['Dynamic renderer validation', 'Legacy adapter audit', 'Manifest proof review'],
    integrationPoints: ['dynamic-template-engine.ts', 'legacy-renderer-adapter.ts', 'generation-manifest.ts'],
    dataContracts: ['TemplateExecutionResult', 'GenerationManifestItem', 'RendererProof'],
    verification: ['ui-shell:smoke', 'template-execution:guard']
  },
  {
    id: 'manager-release-center',
    domain: 'manager-authoring',
    role: 'manager',
    mode: 'workspace',
    href: '/manager-workspace/releases',
    label: 'Release Center',
    shortLabel: 'Releases',
    capability: 'manager.template.releases',
    status: 'wired',
    ownerFile: 'app/manager-workspace/releases/page.tsx',
    purpose: 'Promote, rollback, and document manager template versions with MCoder-compatible approval proof.',
    notResponsibleFor: authoringNotOps,
    fiveW: { who: 'Template manager and MCoder reviewer', what: 'Template version release decisions', when: 'After contracts, mappings, and quality checks pass', where: '/manager-workspace/releases', why: 'Template changes must be promoted intentionally and reversibly.' },
    how: ['Show latest active version', 'Require quality gate proof', 'Attach release note metadata'],
    whatIf: ['If release fails, keep previous active version.', 'If MCoder approval is missing, keep request pending.'],
    ifElse: ['If gate passes, mark release candidate.', 'Else route back to Quality Lab.'],
    wiredProcesses: ['Version promotion', 'Rollback', 'Deployment approval correlation'],
    integrationPoints: ['mcoder-deployment-gate.mjs', 'deployment_requests', 'deployment_request_events'],
    dataContracts: ['DeploymentRequest', 'TemplateRegistryAsset', 'ReleaseProof'],
    verification: ['mcoder:check', 'template-execution:guard']
  },
  {
    id: 'manager-automation-center',
    domain: 'manager-authoring',
    role: 'manager',
    mode: 'workspace',
    href: '/manager-workspace/automation',
    label: 'Automation Center',
    shortLabel: 'Automation',
    capability: 'manager.template.automation',
    status: 'wired',
    ownerFile: 'app/manager-workspace/automation/page.tsx',
    purpose: 'Coordinate cache invalidation, scheduled validation, and template sync proof after template changes.',
    notResponsibleFor: authoringNotOps,
    fiveW: { who: 'Template manager and system process', what: 'Template sync and validation automation', when: 'After upload, remove, release, or rollback', where: '/manager-workspace/automation', why: 'Keeps template changes visible and prevents stale UI behavior.' },
    how: ['Expose source-sync status', 'List cache invalidation needs', 'Queue validation follow-up'],
    whatIf: ['If UI does not reflect changes, compare repo sha, asset hash, and runtime debugger.', 'If cache is stale, clear .next and revalidate tag.'],
    ifElse: ['If runtime hash matches asset hash, mark synced.', 'Else mark drift and block release.'],
    wiredProcesses: ['Source sync', 'Cache invalidation', 'Runtime debugger verification'],
    integrationPoints: ['/api/system/source-sync', 'RenderDebugger', 'safe-sync-guard.sh'],
    dataContracts: ['SourceSyncSnapshot', 'RuntimeDebugSnapshot', 'TemplateAssetHash'],
    verification: ['safe:sync', 'ui-source:guard']
  },
  {
    id: 'manager-monitoring-overview',
    domain: 'manager-operations',
    role: 'manager',
    mode: 'operations',
    href: '/admin',
    label: 'Monitoring Overview',
    shortLabel: 'Overview',
    capability: 'manager.operations.overview',
    status: 'active',
    ownerFile: 'app/admin/page.tsx',
    purpose: 'Show manager-owned client health, pending work, and current operational metrics.',
    notResponsibleFor: opsNotAuthoring,
    fiveW: { who: 'Manager', what: 'Operational dashboard', when: 'Daily monitoring', where: '/admin', why: 'One landing page for operational state.' },
    how: ['Read manager client summary', 'Show pending and active snapshots', 'Link to operational queues'],
    whatIf: ['If RPC fails, show guarded empty state.', 'If pending rises, route to Lifecycle Desk.'],
    ifElse: ['If active rate is low, prioritize intake.', 'Else monitor output queue.'],
    wiredProcesses: ['Client summary', 'Pending clients', 'Active clients'],
    integrationPoints: ['getManagerClientSummary', 'listManagerClientDirectory'],
    dataContracts: ['AccountDirectoryListResult', 'AccountDirectoryRow'],
    verification: ['ui-source:guard']
  },
  {
    id: 'manager-lifecycle-desk',
    domain: 'manager-operations',
    role: 'manager',
    mode: 'operations',
    href: '/admin/lifecycle',
    label: 'Lifecycle Desk',
    shortLabel: 'Lifecycle',
    capability: 'manager.operations.lifecycle',
    status: 'wired',
    ownerFile: 'app/admin/lifecycle/page.tsx',
    purpose: 'Merge intake, pending approval, handoff, and blocked-client review into one operational queue.',
    notResponsibleFor: opsNotAuthoring,
    fiveW: { who: 'Manager', what: 'Client lifecycle actions', when: 'When a client needs approval, handoff, or review', where: '/admin/lifecycle', why: 'Removes duplication between intake, review queue, and access control.' },
    how: ['Link to access views', 'Summarize pending, active, blocked', 'Expose next action path'],
    whatIf: ['If client is pending, route to access approval.', 'If client is blocked, route to review.'],
    ifElse: ['If client needs approval, open /admin/access?view=pending.', 'Else if blocked, open /admin/access?view=blocked.'],
    wiredProcesses: ['Invite flow', 'Approval flow', 'Blocked review'],
    integrationPoints: ['/admin/access?view=pending', '/admin/access?view=blocked'],
    dataContracts: ['ManagerClientSummary', 'AccountStatus'],
    verification: ['ui-shell:smoke']
  },
  {
    id: 'manager-output-queue',
    domain: 'manager-operations',
    role: 'manager',
    mode: 'operations',
    href: '/admin/output-queue',
    label: 'Output Queue',
    shortLabel: 'Outputs',
    capability: 'manager.operations.outputs',
    status: 'wired',
    ownerFile: 'app/admin/output-queue/page.tsx',
    purpose: 'Track generation output status, warnings, retry needs, and package handoff state without entering template authoring.',
    notResponsibleFor: opsNotAuthoring,
    fiveW: { who: 'Manager', what: 'Generated output monitoring', when: 'After clients generate packets', where: '/admin/output-queue', why: 'Separates output operations from template authoring.' },
    how: ['Read report and audit views', 'Surface generation warnings', 'Route failed outputs to Exceptions Desk'],
    whatIf: ['If output failed due template, link to Quality Lab.', 'If output failed due account limit, link to Capacity Desk.'],
    ifElse: ['If warning is template-related, escalate to authoring.', 'Else keep in operations queue.'],
    wiredProcesses: ['Generation reports', 'Output retries', 'Package handoff'],
    integrationPoints: ['/admin/reports', 'TemplateExecutionOrchestrator', 'generation-manifest.ts'],
    dataContracts: ['GenerationManifestItem', 'OutputStatus'],
    verification: ['template-execution:guard']
  },
  {
    id: 'manager-exceptions-desk',
    domain: 'manager-operations',
    role: 'manager',
    mode: 'operations',
    href: '/admin/exceptions',
    label: 'Exceptions Desk',
    shortLabel: 'Exceptions',
    capability: 'manager.operations.exceptions',
    status: 'wired',
    ownerFile: 'app/admin/exceptions/page.tsx',
    purpose: 'Collect blocked accounts, template mismatch warnings, failed outputs, and system drift into one triage surface.',
    notResponsibleFor: opsNotAuthoring,
    fiveW: { who: 'Manager', what: 'Exception triage', when: 'When output, access, or template drift blocks work', where: '/admin/exceptions', why: 'Prevents failures from hiding inside reports or workspace pages.' },
    how: ['Group exceptions by source', 'Route each exception to owner plane', 'Record audit trail'],
    whatIf: ['If source is template, route to Quality Lab.', 'If source is account, route to Lifecycle Desk.'],
    ifElse: ['If exception can be retried, show retry action.', 'Else show escalation path.'],
    wiredProcesses: ['Blocked clients', 'Template drift', 'Failed outputs'],
    integrationPoints: ['/admin/audit', '/manager-workspace/quality', '/admin/access?view=blocked'],
    dataContracts: ['ExceptionSource', 'AuditEvent'],
    verification: ['ui-shell:smoke']
  },
  {
    id: 'manager-capacity-desk',
    domain: 'manager-operations',
    role: 'manager',
    mode: 'operations',
    href: '/admin/capacity',
    label: 'Capacity Desk',
    shortLabel: 'Capacity',
    capability: 'manager.operations.capacity',
    status: 'wired',
    ownerFile: 'app/admin/capacity/page.tsx',
    purpose: 'Monitor seats, active clients, output usage, default limits, and quota risks for the manager workspace.',
    notResponsibleFor: opsNotAuthoring,
    fiveW: { who: 'Manager', what: 'Workspace capacity and limits', when: 'Before approvals or high-volume generation', where: '/admin/capacity', why: 'Capacity decisions should not be mixed with template editing.' },
    how: ['Summarize assigned/active/blocked clients', 'Link capacity exceptions to master entitlements', 'Expose output usage risk'],
    whatIf: ['If limits are exceeded, request entitlement change.', 'If seats are available, approve client.'],
    ifElse: ['If capacity available, continue lifecycle.', 'Else escalate to master entitlements.'],
    wiredProcesses: ['Seat monitoring', 'Output usage monitoring', 'Quota exception routing'],
    integrationPoints: ['getManagerClientSummary', '/master/entitlements'],
    dataContracts: ['CapacitySnapshot', 'EntitlementRequest'],
    verification: ['ui-source:guard']
  },
  {
    id: 'manager-filings-board',
    domain: 'manager-operations',
    role: 'manager',
    mode: 'operations',
    href: '/admin/filings',
    label: 'Filings Board',
    shortLabel: 'Filings',
    capability: 'manager.operations.filings',
    status: 'wired',
    ownerFile: 'app/admin/filings/page.tsx',
    purpose: 'Track review, send, file, and follow-up state for generated client packets.',
    notResponsibleFor: opsNotAuthoring,
    fiveW: { who: 'Manager', what: 'Post-generation filing workflow', when: 'After output review', where: '/admin/filings', why: 'Creates a working board for packet handoff instead of hiding it in reports.' },
    how: ['Group packets by status', 'Link to reports and audit proof', 'Surface next filing action'],
    whatIf: ['If packet is ready, queue filing action.', 'If packet has warnings, route to Output Queue.'],
    ifElse: ['If audit proof exists, mark ready.', 'Else keep in review.'],
    wiredProcesses: ['Packet review', 'Filing handoff', 'Follow-up reminders'],
    integrationPoints: ['/admin/reports', '/admin/audit'],
    dataContracts: ['FilingStatus', 'GenerationManifestItem'],
    verification: ['ui-shell:smoke']
  },
  {
    id: 'master-template-governance',
    domain: 'master-governance',
    role: 'master',
    mode: 'operations',
    href: '/master/template-governance',
    label: 'Template Governance',
    shortLabel: 'Templates',
    capability: 'master.governance.templates',
    status: 'wired',
    ownerFile: 'app/master/template-governance/page.tsx',
    purpose: 'Monitor template readiness, validation drift, fallback rates, and missing slots across all managers.',
    notResponsibleFor: masterNotManager,
    fiveW: { who: 'Master', what: 'Cross-manager template health', when: 'Before platform-level releases and after incidents', where: '/master/template-governance', why: 'Masters need fleet-wide template visibility without editing each manager workspace.' },
    how: ['Aggregate template health', 'Surface missing slots', 'Link to manager workspace when intervention is needed'],
    whatIf: ['If fallback rate rises, block promotion.', 'If manager template missing, open governance exception.'],
    ifElse: ['If all managers pass, mark platform template healthy.', 'Else open incident or policy action.'],
    wiredProcesses: ['Template fleet health', 'Fallback monitoring', 'Governance exception routing'],
    integrationPoints: ['TemplateExecutionOrchestrator', '/manager-workspace/quality'],
    dataContracts: ['TemplateGovernanceSnapshot', 'ManagerTemplateHealth'],
    verification: ['template-execution:guard']
  },
  {
    id: 'master-policy-studio',
    domain: 'master-governance',
    role: 'master',
    mode: 'operations',
    href: '/master/policies',
    label: 'Policy Studio',
    shortLabel: 'Policies',
    capability: 'master.governance.policies',
    status: 'wired',
    ownerFile: 'app/master/policies/page.tsx',
    purpose: 'Define role capabilities, access-control overrides, and workspace visibility rules from one governance UI.',
    notResponsibleFor: masterNotManager,
    fiveW: { who: 'Master', what: 'Policy and capability rules', when: 'When access model or risk posture changes', where: '/master/policies', why: 'Central policy prevents duplicated access logic across pages.' },
    how: ['Map roles to capabilities', 'Audit policy changes', 'Link policies to route ownership'],
    whatIf: ['If capability collides, guard fails.', 'If policy affects active users, require audit note.'],
    ifElse: ['If user has capability, allow action.', 'Else show read-only or blocked state.'],
    wiredProcesses: ['Role-capability control', 'Access override review', 'Policy audit'],
    integrationPoints: ['role-capability-map.ts', 'panel-ownership.ts', 'Supabase RLS policies'],
    dataContracts: ['CapabilityKey', 'PolicyRule'],
    verification: ['capability-collision-guard']
  },
  {
    id: 'master-entitlements-center',
    domain: 'master-governance',
    role: 'master',
    mode: 'operations',
    href: '/master/entitlements',
    label: 'Entitlements Center',
    shortLabel: 'Entitlements',
    capability: 'master.governance.entitlements',
    status: 'wired',
    ownerFile: 'app/master/entitlements/page.tsx',
    purpose: 'Govern manager seats, client limits, output limits, quota risks, and entitlement exceptions across all workspaces.',
    notResponsibleFor: masterNotManager,
    fiveW: { who: 'Master', what: 'Platform entitlement policy', when: 'Before approvals, quota exceptions, and renewals', where: '/master/entitlements', why: 'Capacity decisions need master-wide consistency.' },
    how: ['Aggregate limits', 'Accept or reject quota exceptions', 'Record entitlement audit'],
    whatIf: ['If manager reaches quota, block new approvals until limit changes.', 'If exception approved, update audit.'],
    ifElse: ['If entitlement available, allow manager action.', 'Else show escalation.'],
    wiredProcesses: ['Quota governance', 'Seat governance', 'Output limit governance'],
    integrationPoints: ['/admin/capacity', 'workspace-account-controls.css'],
    dataContracts: ['EntitlementSnapshot', 'QuotaException'],
    verification: ['manager-template:db-guard']
  },
  {
    id: 'master-deployment-control',
    domain: 'master-governance',
    role: 'master',
    mode: 'operations',
    href: '/master/deployments',
    label: 'Deployment Control',
    shortLabel: 'Deployments',
    capability: 'master.governance.deployments',
    status: 'wired',
    ownerFile: 'app/master/deployments/page.tsx',
    purpose: 'Review MCoder deployment requests, approvals, consumed releases, and event history.',
    notResponsibleFor: masterNotManager,
    fiveW: { who: 'Master and MCoder', what: 'Deployment approval and release audit', when: 'Before production deployment', where: '/master/deployments', why: 'Deployment must be gated and traceable.' },
    how: ['List deployment requests', 'Inspect event history', 'Block deployment without approval'],
    whatIf: ['If request sha mismatches, reject.', 'If request expired, require new approval.'],
    ifElse: ['If approved and current sha matches, allow workflow.', 'Else block deploy.'],
    wiredProcesses: ['MCoder approval', 'Deployment event ledger', 'Release audit'],
    integrationPoints: ['deployment_requests', 'deployment_request_events', '.github/workflows/deploy-approved.yml'],
    dataContracts: ['DeploymentRequest', 'DeploymentRequestEvent'],
    verification: ['mcoder:check', 'mcoder:history']
  },
  {
    id: 'master-incident-command',
    domain: 'master-governance',
    role: 'master',
    mode: 'operations',
    href: '/master/incidents',
    label: 'Incident Command',
    shortLabel: 'Incidents',
    capability: 'master.governance.incidents',
    status: 'wired',
    ownerFile: 'app/master/incidents/page.tsx',
    purpose: 'Aggregate system health, recovery actions, audit anomalies, and platform incidents into one response surface.',
    notResponsibleFor: masterNotManager,
    fiveW: { who: 'Master', what: 'Incident response and system recovery', when: 'When the platform detects drift, failed deploys, or data risk', where: '/master/incidents', why: 'Incident response should not be scattered across passive detail pages.' },
    how: ['Link system and recovery detail pages', 'Group incident sources', 'Expose next recovery action'],
    whatIf: ['If source is deployment, route to Deployment Control.', 'If source is data drift, route to System Health.'],
    ifElse: ['If incident is active, show command state.', 'Else archive in audit.'],
    wiredProcesses: ['System health', 'Recovery queue', 'Audit anomaly review'],
    integrationPoints: ['/master/system', '/master/recovery', '/master/audit'],
    dataContracts: ['IncidentSnapshot', 'RecoveryEvent'],
    verification: ['ui-shell:smoke']
  }
];

export function panelsForDomain(domain: ConsoleDomain) {
  return CONSOLE_TRANSFORMATION_PANELS.filter((panel) => panel.domain === domain);
}

export function getPanelByHref(href: string) {
  return CONSOLE_TRANSFORMATION_PANELS.find((panel) => panel.href === href);
}

export function navItemsForDomain(domain: ConsoleDomain, activeHref: string) {
  return panelsForDomain(domain).map((panel) => ({ href: panel.href, label: panel.shortLabel, active: panel.href === activeHref }));
}

export function assertUniqueConsolePanelOwnership() {
  const hrefs = new Set<string>();
  const capabilities = new Set<string>();
  const collisions: string[] = [];
  for (const panel of CONSOLE_TRANSFORMATION_PANELS) {
    if (hrefs.has(panel.href)) collisions.push(`duplicate href: ${panel.href}`);
    hrefs.add(panel.href);
    if (capabilities.has(panel.capability)) collisions.push(`duplicate capability: ${panel.capability}`);
    capabilities.add(panel.capability);
  }
  return collisions;
}
