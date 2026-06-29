export type UIContractScope = 'global' | 'domain' | 'route' | 'component' | 'custom';

export type UIContractKind =
  | 'layout'
  | 'component'
  | 'navigation'
  | 'account'
  | 'template'
  | 'process'
  | 'api'
  | 'database'
  | 'style'
  | 'runtime-debug';

export type UIIntelligenceStatus = 'healthy' | 'warning' | 'blocked' | 'unknown';

export type UIContractOwner = 'manager' | 'master' | 'client' | 'system' | 'global';

export type UIContract = {
  id: string;
  kind: UIContractKind;
  scope: UIContractScope;
  owner: UIContractOwner;
  label: string;
  description: string;
  sourceFiles: string[];
  connectedRoutes: string[];
  connectedProcesses: string[];
  requiredMarkers: string[];
  designTokens: string[];
  dependencies: string[];
  allowedCustomizations: string[];
  forbiddenPatterns: string[];
  propagationGroup?: string;
};

export type UIInspectionSeverity = 'info' | 'warning' | 'error' | 'critical';

export type UIInspectionFinding = {
  id: string;
  severity: UIInspectionSeverity;
  contractId: string;
  title: string;
  description: string;
  sourceFile?: string;
  route?: string;
  detectedPattern?: string;
  expectedPattern?: string;
  rootCause?: string;
  recommendedAction: string;
};

export type RootCauseLayer = 'route' | 'component' | 'style' | 'api' | 'database' | 'script' | 'cache';

export type RootCauseTrace = {
  traceId: string;
  problem: string;
  route?: string;
  activeFunction?: string;
  likelyRootFile?: string;
  responsibleContract?: string;
  chain: Array<{
    layer: RootCauseLayer;
    file?: string;
    evidence: string;
    status: UIIntelligenceStatus;
  }>;
  conclusion: string;
  actionPlan: string[];
};

export type ChangePropagationPlan = {
  changeId: string;
  changeType: 'ui' | 'ux' | 'function' | 'process' | 'template' | 'navigation';
  sourceContractId: string;
  affectedContracts: string[];
  affectedRoutes: string[];
  safeToAutoApply: boolean;
  requiredGuards: string[];
  manualReviewNotes: string[];
};

export type FeatureContract = {
  id: string;
  label: string;
  owner: UIContractOwner;
  status: 'active' | 'draft' | 'disabled' | 'deprecated';
  entryRoutes: string[];
  sourceFiles: string[];
  apiRoutes: string[];
  databaseObjects: string[];
  uiContracts: string[];
  dependencies: string[];
  fallbackBehavior: string;
};

export type UIIntelligenceSourceMap = Record<string, string>;

export type UIIntelligenceReport = {
  generatedAt: string;
  status: UIIntelligenceStatus;
  contracts: Array<{
    id: string;
    label: string;
    status: UIIntelligenceStatus;
    findings: UIInspectionFinding[];
  }>;
  findings: UIInspectionFinding[];
  globalContracts: string[];
  domainContracts: string[];
  routeContracts: string[];
  customContracts: string[];
  propagationGroups: Record<string, string[]>;
};
