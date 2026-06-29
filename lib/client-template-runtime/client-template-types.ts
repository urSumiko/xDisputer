import type { DynamicTemplateRule } from '../templates/intelligence';

export type ClientTemplateAssignmentState = 'assigned' | 'unassigned' | 'blocked';
export type ClientSourceStatus = 'draft' | 'ready' | 'blocked';
export type ClientReviewStatus = 'draft' | 'ready' | 'generated' | 'reviewed' | 'blocked';

export type ClientTemplateAssignment = {
  status: ClientTemplateAssignmentState;
  managerUserId: string | null;
  clientUserId: string;
  activeTemplateAssetId: string | null;
  activeRoundLabel: string | null;
  assignmentPolicy: Record<string, unknown>;
  blocker: string | null;
};

export type ClientTemplateOutputLimit = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  nextResetAt: string;
  canGenerate: boolean;
  policy: Record<string, unknown>;
};

export type ClientCanonicalSourceData = {
  managerUserId: string | null;
  clientUserId: string;
  roundLabel: string | null;
  canonicalData: Record<string, unknown>;
  sourceDataSnapshot: Record<string, unknown>;
  sourceStatus: ClientSourceStatus;
  missingRequiredFields: string[];
  warnings: string[];
};

export type AppliedClientTemplateRules = {
  preserved: Array<Record<string, unknown>>;
  injected: Array<Record<string, unknown>>;
  issues: string[];
  warnings: string[];
  ready: boolean;
};

export type ClientReviewPacketScope = {
  managerUserId: string | null;
  clientUserId: string;
  templateAssetId: string | null;
  roundLabel: string | null;
  packetScope: Record<string, unknown>;
  supportingDocuments: Array<Record<string, unknown>>;
  generatedFiles: Array<Record<string, unknown>>;
  reviewStatus: ClientReviewStatus;
};

export type ClientTemplateRuntimeContext = {
  assignment: ClientTemplateAssignment;
  outputLimit: ClientTemplateOutputLimit;
  templateAsset: Record<string, unknown> | null;
  sourceData: ClientCanonicalSourceData;
  dynamicRules: DynamicTemplateRule[];
  packetScope: ClientReviewPacketScope;
  supportingDocuments: Array<Record<string, unknown>>;
  generatedFiles: Array<Record<string, unknown>>;
  canGenerate: boolean;
  nextResetAt: string;
  managerApprovedTemplate: boolean;
  issues: string[];
  warnings: string[];
};

export type ClientGenerationResult = {
  ok: boolean;
  code?: string;
  reason?: string;
  issues?: string[];
  warnings?: string[];
  generatedFiles?: Array<Record<string, unknown>>;
  packetScope?: Record<string, unknown>;
  nextResetAt?: string;
};

export type ClientTemplateDbClient = {
  from(table: string): {
    select(columns?: string): any;
    insert(values: unknown): any;
    update(values: unknown): any;
    upsert(values: unknown, options?: unknown): any;
  };
};
