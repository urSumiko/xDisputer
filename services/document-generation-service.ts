import type { Bureau, LetterRoute, ParsedSource } from '../lib/letter-engine';
import type { PacketAssets } from '../lib/packet-assets';
import type { LetterReference, Round } from '../lib/reference-store';
import type { TemplateExhibits } from '../lib/template-exhibits';

export type GenerationOutputRole = 'LETTER' | 'AFFIDAVIT' | 'FTC';

export type GenerationReviewOutput = {
  id: string;
  path: string;
  type: LetterRoute['type'];
  role: GenerationOutputRole;
  sequence: number;
  bureau: Bureau | 'CLIENT';
  count: number;
  detail: string;
  blob: Blob;
  packetSteps: string[];
};

export type AffidavitJurisdictionReview = {
  state: string;
  county: string;
  reviewRequired: boolean;
  explanation: string;
};

export type DocumentGenerationJob = {
  round: Round;
  caseId: string;
  source: ParsedSource;
  affidavitSource: ParsedSource;
  affidavitJurisdiction: AffidavitJurisdictionReview;
  routes: LetterRoute[];
  references: LetterReference[];
  templates: TemplateExhibits;
  evidence: PacketAssets;
  documentDate: string;
  evidenceKey: string;
};

export type DocumentGenerationProgressPhase =
  | 'READING_TEMPLATE'
  | 'RENDERING_LETTER'
  | 'RENDERING_AFFIDAVIT'
  | 'RENDERING_FTC'
  | 'ASSEMBLING_PACKET'
  | 'COMPLETE';

export type DocumentGenerationProgress = {
  phase: DocumentGenerationProgressPhase;
  label: string;
  route?: LetterRoute;
};

export type DocumentGenerationResult = {
  outputs: GenerationReviewOutput[];
  warnings: string[];
  documentDate: string;
  zipName: string;
  zipBlob: Blob;
};

export type DocumentGenerationDependencies = {
  onProgress?: (progress: DocumentGenerationProgress) => void;
};

export type DocumentGenerationService = {
  generate(job: DocumentGenerationJob, dependencies?: DocumentGenerationDependencies): Promise<DocumentGenerationResult>;
};

export function createDocumentGenerationNotImplementedService(): DocumentGenerationService {
  return {
    async generate(): Promise<DocumentGenerationResult> {
      throw new Error('Document generation service orchestration has not been wired yet.');
    }
  };
}

export function documentGenerationJobSummary(job: DocumentGenerationJob) {
  const routeLabels = job.routes.map((route) => `${route.bureau}:${route.type}`);

  return {
    round: job.round,
    caseId: job.caseId,
    clientName: job.source.name,
    documentDate: job.documentDate,
    routeCount: job.routes.length,
    routes: routeLabels,
    referenceCount: job.references.filter((reference) => Boolean(reference.file)).length,
    supportingDocumentCount: job.evidence.supporting.length,
    hasLegalPdf: Boolean(job.evidence.legalPdf),
    hasAffidavitTemplate: Boolean(job.templates.AFFIDAVIT),
    affidavitReviewRequired: job.affidavitJurisdiction.reviewRequired
  };
}
