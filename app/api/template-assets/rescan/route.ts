import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';
import { inspectDynamicTemplateContractV2, dynamicTemplateContractV2Summary } from '../../../../lib/dynamic-template/contract-v2';
import { dynamicRendererModePolicy, resolveDynamicTemplateRendererMode } from '../../../../lib/dynamic-template/renderer-mode';
import type { TemplateDocumentKind } from '../../../../lib/template-contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];
const allowedLetterTypes = ['DISPUTE', 'LATE_PAYMENT'];
const allowedExhibitKinds = ['FCRA', 'AFFIDAVIT', 'ATTACHMENT', 'FTC'];

type TemplateAssetRow = {
  id: string;
  round_label: string;
  template_kind: 'LETTER' | 'EXHIBIT';
  letter_type: string | null;
  exhibit_kind: string | null;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  validation_json: Record<string, unknown> | null;
  rule_json: Record<string, unknown> | null;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}

function documentKind(row: TemplateAssetRow): TemplateDocumentKind | null {
  if (row.template_kind === 'LETTER') {
    if (row.letter_type === 'DISPUTE') return 'DISPUTE_LETTER';
    if (row.letter_type === 'LATE_PAYMENT') return 'LATE_PAYMENT_LETTER';
    return null;
  }

  return row.exhibit_kind as TemplateDocumentKind | null;
}

function mergeValidationJson(input: {
  current: Record<string, unknown> | null;
  rendererMode: string;
  rendererPolicy: ReturnType<typeof dynamicRendererModePolicy>;
  contractSummary: unknown;
}) {
  return {
    ...(input.current || {}),
    dynamicTemplateEngineV2: {
      rendererMode: input.rendererMode,
      rendererPolicy: input.rendererPolicy,
      diagnosticsWarning: null,
      contract: input.contractSummary,
      rescannedAt: new Date().toISOString()
    }
  };
}

function mergeRuleJson(input: {
  current: Record<string, unknown> | null;
  rendererMode: string;
  status: string;
  confidence: number;
}) {
  return {
    ...(input.current || {}),
    dynamicTemplateEngineV2: {
      rendererMode: input.rendererMode,
      status: input.status,
      confidence: input.confidence,
      rescannedAt: new Date().toISOString()
    }
  };
}

async function blobToFile(blob: Blob, row: TemplateAssetRow) {
  const arrayBuffer = await blob.arrayBuffer();
  return new File([arrayBuffer], row.original_filename, {
    type: row.mime_type || blob.type || 'application/octet-stream',
    lastModified: Date.now()
  });
}

export async function POST(request: NextRequest) {
  try {
    const accessError = await workspaceAccessErrorResponse();
    if (accessError) return accessError;

    const session = await getSessionContext();

    if (!session.user) {
      return noStoreJson({ error: 'No authenticated user.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const assetId = String(body?.assetId || request.nextUrl.searchParams.get('assetId') || '').trim();
    const round = String(body?.round || request.nextUrl.searchParams.get('round') || '').trim();
    const templateKind = String(body?.templateKind || request.nextUrl.searchParams.get('templateKind') || '').trim();
    const letterType = String(body?.letterType || request.nextUrl.searchParams.get('letterType') || '').trim();
    const exhibitKind = String(body?.exhibitKind || request.nextUrl.searchParams.get('exhibitKind') || '').trim();
    const activeOnly = body?.activeOnly !== false;
    const rendererMode = resolveDynamicTemplateRendererMode({
      requestHeader: request.headers.get('x-dynamic-template-renderer-mode'),
      explicitMode: body?.rendererMode
    });
    const rendererPolicy = dynamicRendererModePolicy(rendererMode);

    let query = session.supabase
      .from('template_assets')
      .select('id, round_label, template_kind, letter_type, exhibit_kind, storage_bucket, storage_path, original_filename, mime_type, validation_json, rule_json')
      .eq('owner_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (assetId) query = query.eq('id', assetId);
    if (round) {
      if (!allowedRounds.includes(round)) return noStoreJson({ error: 'Invalid round.' }, { status: 400 });
      query = query.eq('round_label', round);
    }
    if (templateKind) query = query.eq('template_kind', templateKind);
    if (letterType) {
      if (!allowedLetterTypes.includes(letterType)) return noStoreJson({ error: 'Invalid letter type.' }, { status: 400 });
      query = query.eq('letter_type', letterType);
    }
    if (exhibitKind) {
      if (!allowedExhibitKinds.includes(exhibitKind)) return noStoreJson({ error: 'Invalid exhibit kind.' }, { status: 400 });
      query = query.eq('exhibit_kind', exhibitKind);
    }
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as TemplateAssetRow[];
    const results: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const kind = documentKind(row);
      if (!kind) {
        results.push({ assetId: row.id, status: 'skipped', reason: 'Unknown document kind.' });
        continue;
      }

      const download = await session.supabase.storage.from(row.storage_bucket || 'template-assets').download(row.storage_path);
      if (download.error || !download.data) {
        results.push({ assetId: row.id, status: 'error', reason: download.error?.message || 'Storage download failed.' });
        continue;
      }

      const file = await blobToFile(download.data, row);
      const contract = await inspectDynamicTemplateContractV2(file, kind, row.round_label);
      const contractSummary = dynamicTemplateContractV2Summary(contract);
      const update = await session.supabase
        .from('template_assets')
        .update({
          validation_json: mergeValidationJson({
            current: row.validation_json,
            rendererMode,
            rendererPolicy,
            contractSummary
          }),
          rule_json: mergeRuleJson({
            current: row.rule_json,
            rendererMode,
            status: contract.status,
            confidence: contract.confidence
          })
        })
        .eq('owner_id', session.user.id)
        .eq('id', row.id);

      if (update.error) {
        results.push({ assetId: row.id, filename: row.original_filename, status: 'error', reason: update.error.message });
        continue;
      }

      results.push({
        assetId: row.id,
        filename: row.original_filename,
        round: row.round_label,
        templateKind: row.template_kind,
        letterType: row.letter_type,
        exhibitKind: row.exhibit_kind,
        status: 'rescanned',
        contractStatus: contract.status,
        confidence: contract.confidence,
        missingFields: contract.missingFields,
        warnings: contract.warnings,
        diagnostics: contract.diagnostics
      });
    }

    return noStoreJson({
      status: 'ok',
      rendererMode,
      activeOnly,
      count: results.length,
      results
    });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : 'Template asset rescan failed.' }, { status: 500 });
  }
}
