export type DynamicTemplateRuleType =
  | 'preserve-static-text'
  | 'replace-variable'
  | 'canonical-field-map'
  | 'detect-entity'
  | 'table-layout'
  | 'conditional-section'
  | 'incrementing-sequence'
  | 'renderer-directive'
  | 'parser-directive'
  | 'declaration-rule'
  | 'property-rule'
  | 'blocker-rule';

export type DynamicTemplateRuleScope = 'template' | 'round' | 'section' | 'paragraph' | 'table' | 'row' | 'cell' | 'field' | 'client-assignment';
export type DynamicTemplateValidationState = 'draft' | 'valid' | 'warning' | 'blocked' | 'disabled';
export type DynamicTemplateInspectionStatus = 'ready' | 'warning' | 'blocked';

export type DynamicTemplateFinding = {
  id: string;
  type: DynamicTemplateRuleType;
  scope: DynamicTemplateRuleScope;
  sourcePath: string;
  sourceText: string;
  suggestedRuleKey: string;
  suggestedCanonicalField?: string;
  suggestedOutputToken?: string;
  confidence: number;
  preserve: boolean;
  required: boolean;
  reason: string;
};

export type DynamicTemplateRule = {
  id: string;
  managerUserId: string;
  templateAssetId: string;
  inspectionId: string;
  ruleKey: string;
  ruleType: DynamicTemplateRuleType;
  ruleScope: DynamicTemplateRuleScope;
  sourcePath?: string | null;
  sourceText?: string | null;
  canonicalField?: string | null;
  outputToken?: string | null;
  preserve: boolean;
  required: boolean;
  enabled: boolean;
  priority: number;
  ruleConfig: Record<string, unknown>;
  validationState: DynamicTemplateValidationState;
  validationReason?: string | null;
};

export type DynamicTemplateInspectionResult = {
  templateAssetId: string;
  managerUserId: string;
  roundLabel: string;
  status: DynamicTemplateInspectionStatus;
  staticTextBlocks: DynamicTemplateFinding[];
  variables: DynamicTemplateFinding[];
  entities: DynamicTemplateFinding[];
  mappedFields: DynamicTemplateFinding[];
  tableLayouts: DynamicTemplateFinding[];
  parserFindings: DynamicTemplateFinding[];
  rendererFindings: DynamicTemplateFinding[];
  blockers: string[];
  warnings: string[];
  suggestedRules: DynamicTemplateFinding[];
};

export type DynamicTemplateExecutionItem = {
  ruleId: string;
  ruleKey: string;
  action: 'preserve' | 'replace' | 'generate' | 'parse' | 'render' | 'block';
  target: string;
  status: 'ready' | 'warning' | 'blocked' | 'disabled';
  reason: string;
};

export type DynamicTemplateExecutionModel = {
  templateAssetId: string;
  managerUserId: string;
  clientId: string | null;
  inspectionId: string | null;
  rulesCount: number;
  executionModel: DynamicTemplateExecutionItem[];
  blockers: string[];
  warnings: string[];
  ready: boolean;
};

export type DynamicTemplateAssetInput = {
  id: string;
  manager_user_id: string;
  round_label: string | null;
  original_filename: string | null;
  mime_type?: string | null;
  validation_json?: Record<string, unknown> | null;
  contract_json?: Record<string, unknown> | null;
  rule_json?: Record<string, unknown> | null;
};

export type DynamicTemplateDbClient = {
  from(table: string): {
    select(columns?: string): any;
    insert(values: unknown): any;
    update(values: unknown): any;
    upsert(values: unknown, options?: unknown): any;
  };
};
