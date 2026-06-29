import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';
import { inspectDynamicTemplateContractV2, dynamicTemplateContractV2Summary } from '../../../../lib/dynamic-template/contract-v2';
import type { TemplateDocumentKind } from '../../../../lib/template-contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];
const allowedKinds: TemplateDocumentKind[] = ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC', 'FCRA', 'ATTACHMENT'];

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}

function resolveDocumentKind(input: {
  templateKind: string;
  letterType: string;
  exhibitKind: string;
}): TemplateDocumentKind | null {
  if (input.templateKind === 'LETTER') {
    if (input.letterType === 'DISPUTE') return 'DISPUTE_LETTER';
    if (input.letterType === 'LATE_PAYMENT') return 'LATE_PAYMENT_LETTER';
    return null;
  }

  if (input.templateKind === 'EXHIBIT' && allowedKinds.includes(input.exhibitKind as TemplateDocumentKind)) {
    return input.exhibitKind as TemplateDocumentKind;
  }

  return null;
}

function assertFileType(file: File, kind: TemplateDocumentKind) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx');

  if ((kind === 'FCRA' || kind === 'ATTACHMENT') && !isPdf) throw new Error(`${kind} diagnostics require a PDF file.`);
  if (kind !== 'FCRA' && kind !== 'ATTACHMENT' && !isDocx) throw new Error(`${kind} diagnostics require a DOCX file.`);
}

export async function POST(request: NextRequest) {
  try {
    const accessError = await workspaceAccessErrorResponse();
    if (accessError) return accessError;

    const session = await getSessionContext();

    if (!session.user) {
      return noStoreJson({ error: 'No authenticated user.' }, { status: 401 });
    }

    const formData = await request.formData();
    const round = String(formData.get('round') || '').trim();
    const templateKind = String(formData.get('templateKind') || '').trim();
    const letterType = String(formData.get('letterType') || '').trim();
    const exhibitKind = String(formData.get('exhibitKind') || '').trim();
    const file = formData.get('file');

    if (!allowedRounds.includes(round)) {
      return noStoreJson({ error: 'Invalid round.' }, { status: 400 });
    }

    if (!(file instanceof File) || file.size === 0) {
      return noStoreJson({ error: 'Template file is required.' }, { status: 400 });
    }

    const documentKind = resolveDocumentKind({ templateKind, letterType, exhibitKind });

    if (!documentKind) {
      return noStoreJson({ error: 'Invalid template kind, letter type, or exhibit kind.' }, { status: 400 });
    }

    assertFileType(file, documentKind);

    const contract = await inspectDynamicTemplateContractV2(file, documentKind, round);
    const summary = dynamicTemplateContractV2Summary(contract);

    return noStoreJson({
      status: 'ok',
      message: `${documentKind} dynamic template v2 diagnostics completed with ${contract.status}.`,
      round,
      documentKind,
      filename: file.name,
      diagnostics: summary
    });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : 'Dynamic template diagnostics failed.' }, { status: 500 });
  }
}
