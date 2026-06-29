import type { Bureau, LetterRoute, ParsedSource } from '../letter-engine';
import type { Round } from '../reference-store';
import { DOCX_MIME, renderReferenceDisputeDocx } from '../docx-renderer';
import { renderLatePaymentReference } from '../late-reference-renderer';
import { renderMappedAppendix, type MappedAppendixKind } from '../supplemental-template-renderer';
import { createCanonicalSourceModel } from './canonical-source-model';

function toTemplateFile(value: Blob | File, name: string) {
  return value instanceof File
    ? value
    : new File([value], name, { type: value.type || DOCX_MIME, lastModified: Date.now() });
}

export async function renderLegacyLetterAdapter(input: {
  template: Blob | File;
  route: LetterRoute;
  parsed: ParsedSource;
  round: Round;
  documentDate: string;
}) {
  const model = createCanonicalSourceModel(input.parsed);
  const templateFile = toTemplateFile(input.template, input.route.type === 'DISPUTE' ? 'dispute-template.docx' : 'late-payment-template.docx');

  if (input.route.type === 'DISPUTE') {
    return renderReferenceDisputeDocx(templateFile, model.legacyDisputeValues(input.route, input.documentDate));
  }

  return renderLatePaymentReference(templateFile, model.legacyLateValues(input.route, input.documentDate));
}

export async function renderLegacyAppendixAdapter(input: {
  template: Blob | File;
  kind: MappedAppendixKind;
  bureau: Bureau;
  parsed: ParsedSource;
  round: Round;
  documentDate: string;
}) {
  const model = createCanonicalSourceModel(input.parsed);
  const templateFile = toTemplateFile(input.template, `${input.kind}.docx`);

  return renderMappedAppendix(
    templateFile,
    model.appendixContext({ kind: input.kind, bureau: input.bureau, round: input.round, documentDate: input.documentDate }),
    { rendererMode: 'LEGACY_STABLE', allowLegacyFallback: true }
  );
}
