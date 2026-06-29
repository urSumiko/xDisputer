import { buildFtcAffectedAccounts, renderFtcIdentityTheftReportDocx, type FtcAffectedAccount } from './ftc-report-renderer';
import { bureauInfo, type Bureau, type ParsedSource } from './letter-engine';
import { readTemplateExhibit } from './template-exhibits';
import { tryRenderDynamicAppendixTemplateV2 } from './dynamic-template/appendix-renderer-v2-bridge';
import type { DynamicTemplateRendererMode } from './dynamic-template/renderer-mode';

export const FTC_PACKET_ROLE = 'FTC' as const;
export const FTC_PACKET_BUREAU = 'CLIENT' as const;
export const FTC_PACKET_SEQUENCE = 6;
export const FTC_PACKET_LABEL = 'FTC Identity Theft Report';
export const FTC_PACKET_FILENAME = '06 FTC Identity Theft Report.docx';

export type FtcWorkflowReviewOutput = {
  id: string;
  path: string;
  type: 'DISPUTE';
  role: typeof FTC_PACKET_ROLE;
  sequence: typeof FTC_PACKET_SEQUENCE;
  bureau: typeof FTC_PACKET_BUREAU;
  count: number;
  detail: string;
  blob: Blob;
  packetSteps: string[];
};

export type GenerateFtcWorkflowInput = {
  round: string;
  parsed: ParsedSource;
  date: string;
  cleanName: (value: string) => string;
  packetSteps: string[];
  template?: File | Blob | null;
  bureau?: Bureau | null;
  rendererMode?: DynamicTemplateRendererMode | string | null;
};

export type GenerateFtcWorkflowResult = {
  output: FtcWorkflowReviewOutput;
  notes: string[];
  accounts: FtcAffectedAccount[];
};

function toTemplateFile(value: File | Blob, filename: string) {
  if (value instanceof File) return value;
  return new File([value], filename, {
    type: value.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now()
  });
}

async function fetchActiveFtcTemplate(round: string) {
  if (typeof fetch !== 'function') return null;

  const response = await fetch(`/api/template-assets/file?round=${encodeURIComponent(round)}&templateKind=EXHIBIT&exhibitKind=FTC`);
  if (!response.ok) return null;
  return await response.blob();
}

async function resolveFtcTemplate(input: GenerateFtcWorkflowInput) {
  return input.template || await readTemplateExhibit(input.round, 'FTC') || await fetchActiveFtcTemplate(input.round);
}

export function buildFtcWorkflowSource(parsed: ParsedSource) {
  const accounts = buildFtcAffectedAccounts(parsed);

  return {
    source: { ...parsed, ftcAccounts: accounts },
    accounts,
    notes: accounts.length
      ? []
      : ['FTC Identity Theft Report: no affected accounts were detected; generated with an empty review section.']
  };
}

export function ftcOutputPath(clientName: string, cleanName: (value: string) => string) {
  return `Editable Documents/${cleanName(clientName)} ${FTC_PACKET_FILENAME}`;
}

export async function generateFtcWorkflowOutput(input: GenerateFtcWorkflowInput): Promise<GenerateFtcWorkflowResult> {
  const templateBlob = await resolveFtcTemplate(input);

  if (!templateBlob) {
    throw new Error('Required component missing: 06 FTC Identity Theft Report DOCX template is not uploaded.');
  }

  const template = toTemplateFile(templateBlob, FTC_PACKET_FILENAME);
  const workflow = buildFtcWorkflowSource(input.parsed);
  const bureau = input.bureau || 'EQUIFAX';
  const v2 = await tryRenderDynamicAppendixTemplateV2({
    template,
    context: {
      kind: 'FTC',
      bureau,
      documentDate: input.date,
      recipientName: bureauInfo[bureau].name,
      recipientAddressLines: bureauInfo[bureau].address.split('\n'),
      source: workflow.source,
      round: input.round as any
    },
    rendererMode: input.rendererMode
  });
  const blob = v2?.blob || await renderFtcIdentityTheftReportDocx(workflow.source, input.date, template);
  const notes = [...workflow.notes];

  if (v2) {
    notes.push(`FTC Identity Theft Report: rendered by Dynamic Template Engine v2 with grade ${v2.engine.quality.tier}/${v2.engine.quality.score}.`);
  }

  return {
    accounts: workflow.accounts,
    notes,
    output: {
      id: 'CLIENT-FTC-IDENTITY-THEFT-REPORT',
      path: ftcOutputPath(input.parsed.name, input.cleanName),
      type: 'DISPUTE',
      role: FTC_PACKET_ROLE,
      sequence: FTC_PACKET_SEQUENCE,
      bureau: FTC_PACKET_BUREAU,
      count: workflow.accounts.length,
      detail: `${workflow.accounts.length} affected FTC item(s)`,
      blob,
      packetSteps: input.packetSteps
    }
  };
}

export function isFtcReviewOutput(output: { role?: string; sequence?: number; path?: string }) {
  return output.role === FTC_PACKET_ROLE || output.sequence === FTC_PACKET_SEQUENCE || /FTC Identity Theft Report/i.test(output.path || '');
}
