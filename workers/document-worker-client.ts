import type { DocumentGenerationJob, DocumentGenerationProgress, DocumentGenerationResult } from '../services/document-generation-service';
import type { DocumentWorkerClient, DocumentWorkerRequest, DocumentWorkerResponse } from './document-worker-contract';

export function createDocumentWorkerClient(workerUrl: URL): DocumentWorkerClient {
  const worker = new Worker(workerUrl, { type: 'module' });
  let activeRequestId = '';

  return {
    generate(job: DocumentGenerationJob, onProgress?: (progress: DocumentGenerationProgress) => void) {
      activeRequestId = crypto.randomUUID();

      return new Promise<DocumentGenerationResult>((resolve, reject) => {
        const handleMessage = (event: MessageEvent<DocumentWorkerResponse>) => {
          const message = event.data;
          if (!message || message.id !== activeRequestId) return;

          if (message.type === 'PROGRESS') {
            onProgress?.(message.progress);
            return;
          }

          worker.removeEventListener('message', handleMessage);

          if (message.type === 'COMPLETE') {
            resolve(message.result);
            return;
          }

          reject(new Error(message.message));
        };

        worker.addEventListener('message', handleMessage);

        const request: DocumentWorkerRequest = {
          id: activeRequestId,
          type: 'GENERATE_PACKET',
          job
        };

        worker.postMessage(request);
      });
    },

    cancel() {
      if (!activeRequestId) return;
      worker.postMessage({ id: activeRequestId, type: 'CANCEL' } satisfies DocumentWorkerRequest);
    },

    dispose() {
      worker.terminate();
    }
  };
}
