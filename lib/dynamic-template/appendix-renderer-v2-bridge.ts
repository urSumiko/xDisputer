import { bureaus, type LetterRoute, type SourceItem } from '../letter-engine';
import type { Round } from '../reference-store';
import type { MappedAppendixContext } from '../supplemental-template-renderer';
import { renderDynamicDocxTemplateV2, shouldUseDynamicDocxLayoutV2, type DynamicTemplateEngineV2Result } from './render-orchestrator';
import { resolveDynamicTemplateRendererMode, type DynamicTemplateRendererMode } from './renderer-mode';

export type DynamicAppendixRendererV2BridgeResult = {
  blob: Blob;
  engine: DynamicTemplateEngineV2Result;
};

type SupportedDynamicAppendixKind = 'AFFIDAVIT' | 'FTC';

function assertSupportedAppendixKind(kind: string): asserts kind is SupportedDynamicAppendixKind {
  if (kind !== 'AFFIDAVIT' && kind !== 'FTC') {
    throw new Error(`Dynamic Template Engine v2 only supports editable Affidavit and FTC appendix DOCX templates. Received: ${kind}`);
  }
}

function sourceItem(type: SourceItem['type'], displayText: string): SourceItem {
  return { type, displayText };
}

function affidavitRoute(context: MappedAppendixContext): LetterRoute {
  const items: SourceItem[] = [];

  for (const bureau of bureaus) {
    items.push(...context.source.dispute[bureau]);
    items.push(...context.source.inquiry[bureau]);
  }

  return {
    bureau: context.bureau,
    type: 'DISPUTE',
    items,
    reason: 'Affidavit dynamic template v2 shared dispute packet route'
  };
}

function ftcRoute(context: MappedAppendixContext): LetterRoute {
  const items = context.source.ftcAccounts.map((account) => sourceItem('DISPUTE_ACCOUNT', [
    `Account Name: ${account.accountName}`,
    account.accountNumber ? `Account Number: ${account.accountNumber}` : '',
    account.dateDiscovered ? `Date Discovered: ${account.dateDiscovered}` : '',
    account.fraudulentAmount ? `Fraudulent Amount: ${account.fraudulentAmount}` : ''
  ].filter(Boolean).join('\n')));

  return {
    bureau: context.bureau,
    type: 'DISPUTE',
    items,
    reason: 'FTC dynamic template v2 affected-account route'
  };
}

function routeForAppendix(context: MappedAppendixContext): LetterRoute {
  assertSupportedAppendixKind(context.kind);
  return context.kind === 'FTC' ? ftcRoute(context) : affidavitRoute(context);
}

export async function tryRenderDynamicAppendixTemplateV2(input: {
  template: File;
  context: MappedAppendixContext & { round?: Round };
  rendererMode?: DynamicTemplateRendererMode | string | null;
}): Promise<DynamicAppendixRendererV2BridgeResult | null> {
  const rendererMode = resolveDynamicTemplateRendererMode({ explicitMode: input.rendererMode });

  if (!shouldUseDynamicDocxLayoutV2(rendererMode)) return null;

  assertSupportedAppendixKind(input.context.kind);

  const engine = await renderDynamicDocxTemplateV2({
    template: input.template,
    kind: input.context.kind,
    parsed: input.context.source,
    round: input.context.round || '1st Round',
    route: routeForAppendix(input.context),
    documentDate: input.context.documentDate,
    rendererMode
  });

  return {
    blob: engine.blob,
    engine
  };
}
