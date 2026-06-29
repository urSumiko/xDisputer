import type { LetterRoute, LetterType, ParsedSource } from '../letter-engine';
import type { LetterReference, Round } from '../reference-store';
import type { TemplateExhibits } from '../template-exhibits';
import type { ManagerTemplateScopeUi } from '../manager-template-ui';
import { generateFtcWorkflowOutput } from '../ftc-workflow';
import { isFtcEnabled } from '../workflow-framework';
import { ManagerTemplateResolver, type RegistryTemplateAsset, type TemplateSlotSummary } from './manager-template-resolver';
import { assertTemplateExecutionReady } from './template-execution-guards';
import { renderWithBestTemplateEngine } from './dynamic-template-engine';

export type TemplateExecutionDebugSnapshot = {
  status: 'idle' | 'rendered' | 'blocked' | 'failed';
  round: Round;
  outputs: number;
  warnings: number;
  engines: string[];
  missingSlots: string[];
  generatedAt: string;
  summary: string;
};

export type OrchestratedOutput = {
  id: string;
  path: string;
  type: LetterType;
  role: 'LETTER' | 'AFFIDAVIT' | 'FTC';
  sequence: number;
  bureau: string;
  count: number;
  detail: string;
  blob: Blob;
  packetSteps?: string[];
};

export type TemplateExecutionManifest = {
  version: 1;
  round: Round;
  generatedAt: string;
  routeCount: number;
  outputs: Array<{
    id: string;
    role: string;
    engine: string;
    rendererMode: string;
    bureau: string;
    warningCount: number;
  }>;
  guards: { blockers: string[]; warnings: string[] };
  templateSlots: TemplateSlotSummary[];
};

export type TemplateExecutionOrchestratorResult = {
  outputs: OrchestratedOutput[];
  warnings: string[];
  executionManifest: TemplateExecutionManifest;
};

declare global {
  interface Window {
    __xdisputerTemplateExecution?: TemplateExecutionDebugSnapshot;
  }
}

function publishTemplateExecution(snapshot: TemplateExecutionDebugSnapshot) {
  if (typeof window === 'undefined') return;
  window.__xdisputerTemplateExecution = snapshot;
  window.dispatchEvent(new CustomEvent('xdisputer:template-execution', { detail: snapshot }));
}

function outputPath(input: { cleanName: (value: string) => string; clientName: string; bureau: string; label: string }) {
  return `Editable Documents/${input.cleanName(input.clientName)} ${input.bureau} ${input.label}.docx`;
}

export async function executeTemplateGeneration(input: {
  round: Round;
  source: string;
  normalized: boolean;
  parsed: ParsedSource;
  routes: LetterRoute[];
  references: LetterReference[];
  templates: TemplateExhibits;
  registryAssets: RegistryTemplateAsset[];
  managerTemplateScope?: Pick<ManagerTemplateScopeUi, 'canManageTemplates'> | null;
  documentDate: string;
  cleanName: (value: string) => string;
  packetStepsForType?: (type: LetterType) => string[];
  onStatus?: (message: string) => void;
  requestedRendererMode?: string | null;
}): Promise<TemplateExecutionOrchestratorResult> {
  const resolver = new ManagerTemplateResolver({
    round: input.round,
    routes: input.routes,
    parsed: input.parsed,
    references: input.references,
    templates: input.templates,
    registryAssets: input.registryAssets,
    managerTemplateScope: input.managerTemplateScope
  });

  const guard = assertTemplateExecutionReady({
    round: input.round,
    source: input.source,
    normalized: input.normalized,
    parsed: input.parsed,
    routes: input.routes,
    references: input.references,
    templates: input.templates,
    resolver
  });

  const outputs: OrchestratedOutput[] = [];
  const warnings: string[] = [...guard.warnings];
  const executionItems: TemplateExecutionManifest['outputs'] = [];
  const packetSteps = (type: LetterType) => input.packetStepsForType?.(type) || [];

  for (const route of input.routes) {
    const label = route.type === 'DISPUTE' ? 'Dispute Letter' : 'Late Payment Letter';
    input.onStatus?.(`Generating ${label} for ${route.bureau}…`);
    const template = await resolver.resolveLetterBlob(route.type);
    if (!template) throw new Error(`${label} template is missing for ${input.round}.`);

    const rendered = await renderWithBestTemplateEngine({
      template,
      kind: route.type === 'DISPUTE' ? 'DISPUTE_LETTER' : 'LATE_PAYMENT_LETTER',
      parsed: input.parsed,
      round: input.round,
      route,
      documentDate: input.documentDate,
      requestedRendererMode: input.requestedRendererMode
    });

    warnings.push(...rendered.warnings);
    const id = `${route.type}-${route.bureau}-LETTER`;
    outputs.push({
      id,
      path: outputPath({ cleanName: input.cleanName, clientName: input.parsed.name, bureau: route.bureau, label }),
      type: route.type,
      role: 'LETTER',
      sequence: 1,
      bureau: route.bureau,
      count: route.items.length,
      detail: route.reason,
      blob: rendered.blob,
      packetSteps: packetSteps(route.type)
    });
    executionItems.push({ id, role: 'LETTER', engine: rendered.engine, rendererMode: rendered.rendererMode, bureau: route.bureau, warningCount: rendered.warnings.length });
  }

  const disputeContext = input.routes.find((route) => route.type === 'DISPUTE') || null;
  if (disputeContext) {
    if (isFtcEnabled() && input.parsed.ftcAccounts.length > 0) {
      input.onStatus?.('Generating FTC Identity Theft Report…');
      const ftcTemplate = await resolver.resolveExhibitBlob('FTC');
      const ftc = await generateFtcWorkflowOutput({
        round: input.round,
        parsed: input.parsed,
        date: input.documentDate,
        cleanName: input.cleanName,
        packetSteps: packetSteps('DISPUTE'),
        template: ftcTemplate,
        bureau: disputeContext.bureau,
        rendererMode: input.requestedRendererMode
      });
      warnings.push(...ftc.notes);
      outputs.push(ftc.output);
      executionItems.push({ id: ftc.output.id, role: 'FTC', engine: 'ftc-workflow', rendererMode: String(input.requestedRendererMode || 'AUTO'), bureau: ftc.output.bureau, warningCount: ftc.notes.length });
    }

    input.onStatus?.('Generating client Affidavit…');
    const affidavitTemplate = await resolver.resolveExhibitBlob('AFFIDAVIT');
    if (!affidavitTemplate) throw new Error('Required component missing: 05 Affidavit DOCX template is not uploaded.');
    const rendered = await renderWithBestTemplateEngine({
      template: affidavitTemplate,
      kind: 'AFFIDAVIT',
      parsed: input.parsed,
      round: input.round,
      bureau: disputeContext.bureau,
      route: disputeContext,
      documentDate: input.documentDate,
      requestedRendererMode: input.requestedRendererMode
    });

    warnings.push(...rendered.warnings);
    outputs.push({
      id: 'CLIENT-AFFIDAVIT',
      path: `Editable Documents/${input.cleanName(input.parsed.name)} 05 Affidavit.docx`,
      type: 'DISPUTE',
      role: 'AFFIDAVIT',
      sequence: 6,
      bureau: 'CLIENT',
      count: 1,
      detail: 'Shared client affidavit',
      blob: rendered.blob,
      packetSteps: packetSteps('DISPUTE')
    });
    executionItems.push({ id: 'CLIENT-AFFIDAVIT', role: 'AFFIDAVIT', engine: rendered.engine, rendererMode: rendered.rendererMode, bureau: 'CLIENT', warningCount: rendered.warnings.length });
  }

  const generatedAt = new Date().toISOString();
  const templateSlots = resolver.templateSummary();
  const executionManifest: TemplateExecutionManifest = {
    version: 1,
    round: input.round,
    generatedAt,
    routeCount: input.routes.length,
    outputs: executionItems,
    guards: { blockers: [], warnings: guard.warnings },
    templateSlots
  };

  publishTemplateExecution({
    status: outputs.length ? 'rendered' : 'idle',
    round: input.round,
    outputs: outputs.length,
    warnings: warnings.length,
    engines: Array.from(new Set(executionItems.map((item) => item.engine))),
    missingSlots: templateSlots.filter((item) => item.source === 'MISSING').map((item) => item.slotKey),
    generatedAt,
    summary: outputs.length ? 'Template execution completed through TemplateExecutionOrchestrator.' : 'Template execution produced no output.'
  });

  return { outputs, warnings, executionManifest };
}
