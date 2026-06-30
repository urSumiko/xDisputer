import type { Bureau, LetterRoute, ParsedSource } from '../letter-engine';
import { bureauInfo } from '../letter-engine';
import type { Round } from '../reference-store';
import type { TemplateDocumentKind } from '../template-contracts';
import type { ReferenceDisputeValues } from '../docx-renderer';
import { repairDisputeStaticHeaderDuplication } from '../docx-dispute-header-repair';
import { renderDynamicDocxTemplateV2 } from '../dynamic-template/render-orchestrator';
import { resolveDynamicTemplateRendererMode, type DynamicTemplateRendererMode } from '../dynamic-template/renderer-mode';
import { renderLegacyAppendixAdapter, renderLegacyLetterAdapter } from './legacy-renderer-adapter';

export type TemplateEngineResult = {
  blob: Blob;
  engine: 'dynamic-template-v2' | 'legacy-renderer-adapter';
  rendererMode: DynamicTemplateRendererMode;
  warnings: string[];
  manifest: Record<string, unknown>;
};

function toFile(value: Blob | File, filename: string) {
  return value instanceof File
    ? value
    : new File([value], filename, {
      type: value.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now()
    });
}

function legacyKindAllowed(kind: TemplateDocumentKind) {
  return kind === 'DISPUTE_LETTER' || kind === 'LATE_PAYMENT_LETTER' || kind === 'AFFIDAVIT' || kind === 'FTC';
}

function disputeHeaderValues(input: {
  kind: TemplateDocumentKind;
  parsed: ParsedSource;
  route?: LetterRoute | null;
  documentDate: string;
}): ReferenceDisputeValues | null {
  if (input.kind !== 'DISPUTE_LETTER' || !input.route) return null;
  const bureau = bureauInfo[input.route.bureau];
  if (!input.parsed.name || !bureau?.name) return null;

  return {
    consumerName: input.parsed.name,
    addressLines: input.parsed.address,
    dob: input.parsed.dob,
    ssn: input.parsed.ssn,
    letterDate: input.documentDate,
    bureauName: bureau.name,
    bureauAddressLines: bureau.address.split('\n').map((line) => line.trim()).filter(Boolean),
    disputeItems: [],
    hardInquiryItems: []
  };
}

async function enforceDisputeHeaderOnce(input: {
  blob: Blob;
  kind: TemplateDocumentKind;
  parsed: ParsedSource;
  route?: LetterRoute | null;
  documentDate: string;
}) {
  const values = disputeHeaderValues(input);
  return values ? repairDisputeStaticHeaderDuplication(input.blob, values) : input.blob;
}

export async function renderWithBestTemplateEngine(input: {
  template: Blob | File;
  kind: TemplateDocumentKind;
  parsed: ParsedSource;
  round: Round;
  documentDate: string;
  route?: LetterRoute | null;
  bureau?: Bureau;
  requestedRendererMode?: DynamicTemplateRendererMode | string | null;
  validationRendererMode?: string | null;
}): Promise<TemplateEngineResult> {
  const warnings: string[] = [];
  const rendererMode = resolveDynamicTemplateRendererMode({ explicitMode: input.validationRendererMode || input.requestedRendererMode });

  if (legacyKindAllowed(input.kind)) {
    try {
      const dynamic = await renderDynamicDocxTemplateV2({
        template: toFile(input.template, `${input.kind}.docx`),
        kind: input.kind,
        parsed: input.parsed,
        round: input.round,
        route: input.route,
        documentDate: input.documentDate,
        rendererMode
      });
      const blob = await enforceDisputeHeaderOnce({ blob: dynamic.blob, kind: input.kind, parsed: input.parsed, route: input.route, documentDate: input.documentDate });

      return {
        blob,
        engine: 'dynamic-template-v2',
        rendererMode,
        warnings,
        manifest: dynamic.manifest
      };
    } catch (error) {
      warnings.push(`Dynamic Template Engine v2 fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (input.kind === 'DISPUTE_LETTER' || input.kind === 'LATE_PAYMENT_LETTER') {
    if (!input.route) throw new Error(`Missing route for ${input.kind}.`);
    const rendered = await renderLegacyLetterAdapter({
      template: input.template,
      route: input.route,
      parsed: input.parsed,
      round: input.round,
      documentDate: input.documentDate
    });
    const blob = await enforceDisputeHeaderOnce({ blob: rendered, kind: input.kind, parsed: input.parsed, route: input.route, documentDate: input.documentDate });
    return {
      blob,
      engine: 'legacy-renderer-adapter',
      rendererMode,
      warnings,
      manifest: { templateEngine: { chosen: 'legacy-renderer-adapter', reason: warnings.length ? 'v2-fallback' : 'legacy-forced', warnings } }
    };
  }

  if (input.kind === 'AFFIDAVIT' || input.kind === 'FTC') {
    if (!input.bureau) throw new Error(`Missing bureau for ${input.kind}.`);
    const blob = await renderLegacyAppendixAdapter({
      template: input.template,
      kind: input.kind,
      bureau: input.bureau,
      parsed: input.parsed,
      round: input.round,
      documentDate: input.documentDate
    });
    return {
      blob,
      engine: 'legacy-renderer-adapter',
      rendererMode,
      warnings,
      manifest: { templateEngine: { chosen: 'legacy-renderer-adapter', reason: warnings.length ? 'v2-fallback' : 'appendix-legacy', warnings } }
    };
  }

  throw new Error(`Unsupported template kind for templated rendering: ${input.kind}.`);
}
