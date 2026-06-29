import type { DocumentWorkerRequest, DocumentWorkerResponse } from './document-worker-contract';

let cancelled = false;

function reply(message: DocumentWorkerResponse) {
  self.postMessage(message);
}

self.addEventListener('message', async (event: MessageEvent<DocumentWorkerRequest>) => {
  const request = event.data;

  if (request.type === 'CANCEL') {
    cancelled = true;
    return;
  }

  if (request.type !== 'GENERATE_PACKET') return;

  cancelled = false;

  try {
    reply({
      id: request.id,
      type: 'PROGRESS',
      progress: {
        phase: 'ASSEMBLING_PACKET',
        label: 'Document worker foundation received the generation job.'
      }
    });

    if (cancelled) throw new Error('Document generation was cancelled.');

    throw new Error('Document worker execution is not wired yet. Use the current browser generation path until the service is migrated.');
  } catch (error) {
    reply({
      id: request.id,
      type: 'ERROR',
      message: error instanceof Error ? error.message : 'Document worker failed.'
    });
  }
});

export {};
