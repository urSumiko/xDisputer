import type { DocumentGenerationJob, DocumentGenerationProgress, DocumentGenerationResult } from '../services/document-generation-service';

export type DocumentWorkerRequest =
  | { id: string; type: 'GENERATE_PACKET'; job: DocumentGenerationJob }
  | { id: string; type: 'CANCEL' };

export type DocumentWorkerResponse =
  | { id: string; type: 'PROGRESS'; progress: DocumentGenerationProgress }
  | { id: string; type: 'COMPLETE'; result: DocumentGenerationResult }
  | { id: string; type: 'ERROR'; message: string };

export type DocumentWorkerClient = {
  generate(job: DocumentGenerationJob, onProgress?: (progress: DocumentGenerationProgress) => void): Promise<DocumentGenerationResult>;
  cancel(): void;
  dispose(): void;
};
