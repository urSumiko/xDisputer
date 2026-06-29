import type { GenerationEnginePlan } from './generation-engine-service';
import { previewGenerationPlan } from './generation-engine-service';
import { getManagerTemplateLibraryContext, type TemplateLibraryContext } from './template-library-service';
import type { TemplateRound } from './template-workspace-contract';
import type { LetterType } from '../../letter-engine';

type SupabaseLike = Parameters<typeof getManagerTemplateLibraryContext>[0]['supabase'];
type TemplateAssetForLab = TemplateLibraryContext['assets'][number];

export type TemplateTestLabContext = {
  round: TemplateRound;
  packet: LetterType;
  library: TemplateLibraryContext;
  plan: GenerationEnginePlan;
  assets: TemplateAssetForLab[];
  downloadableAssets: Array<{ id: string; label: string; filename: string; href: string }>;
  testCases: Array<{ id: string; label: string; value: string }>;
  output: {
    title: string;
    fileName: string;
    body: string[];
    checklist: Array<{ label: string; status: 'pass' | 'warn' | 'blocked'; detail: string }>;
  };
  status: 'ready' | 'warning' | 'blocked';
};

function normalizePacket(value?: string | null): LetterType {
  return value === 'LATE_PAYMENT' ? 'LATE_PAYMENT' : 'DISPUTE';
}

function packetTitle(packet: LetterType) {
  return packet === 'LATE_PAYMENT' ? 'Late Payment Letter' : 'Dispute Letter';
}

function slotLabel(asset: TemplateAssetForLab) {
  if (asset.template_kind === 'LETTER') return asset.letter_type === 'LATE_PAYMENT' ? 'Late Payment Letter' : 'Dispute Letter';
  if (asset.exhibit_kind === 'AFFIDAVIT') return 'Affidavit';
  if (asset.exhibit_kind === 'ATTACHMENT') return 'Attachment';
  if (asset.exhibit_kind === 'FTC') return 'FTC Report';
  if (asset.exhibit_kind === 'FCRA') return 'FCRA Exhibit';
  return asset.original_filename || 'Template file';
}

function statusFrom(plan: GenerationEnginePlan, assets: TemplateAssetForLab[]) {
  if (plan.blockers.length || !assets.length) return 'blocked' as const;
  if (plan.warnings.length) return 'warning' as const;
  return 'ready' as const;
}

function buildTestCases(plan: GenerationEnginePlan) {
  return [
    { id: 'consumer.full_name', label: 'Consumer name', value: 'Sample Consumer' },
    { id: 'consumer.address', label: 'Consumer address', value: '123 Sample Street' },
    { id: 'account.creditor_name', label: 'Creditor name', value: 'Sample Creditor' },
    { id: 'account.account_number', label: 'Account number', value: '****4321' },
    ...plan.generatedVariables.slice(0, 6).map((variable) => ({ id: variable.token, label: variable.canonicalField, value: variable.status === 'ready' ? 'Resolved' : 'Needs mapping' }))
  ];
}

function buildOutput(input: { packet: LetterType; plan: GenerationEnginePlan; assets: TemplateAssetForLab[] }) {
  const primary = input.assets.find((asset) => asset.template_kind === 'LETTER' && (input.packet === 'LATE_PAYMENT' ? asset.letter_type === 'LATE_PAYMENT' : asset.letter_type === 'DISPUTE')) || input.assets.find((asset) => asset.template_kind === 'LETTER') || null;
  const title = packetTitle(input.packet);
  return {
    title,
    fileName: `${input.plan.round.replace(/\s+/g, '-')}-${input.packet === 'LATE_PAYMENT' ? 'late-payment' : 'dispute'}-preview.txt`,
    checklist: [
      { label: 'Active letter template', status: primary ? 'pass' as const : 'blocked' as const, detail: primary ? `${primary.original_filename || 'Template'} is active.` : 'No active letter template is available for this packet.' },
      { label: 'Required mappings', status: input.plan.blockers.length ? 'blocked' as const : 'pass' as const, detail: input.plan.blockers[0] || 'No required mapping blocker detected.' },
      { label: 'Renderer warnings', status: input.plan.warnings.length ? 'warn' as const : 'pass' as const, detail: input.plan.warnings[0] || 'No renderer warning detected.' }
    ],
    body: [
      `${title} - Manager Test Preview`,
      `Round: ${input.plan.round}`,
      `Template: ${primary?.original_filename || 'No active template selected'}`,
      'Sample field consumer.full_name -> Sample Consumer',
      'Sample field account.creditor_name -> Sample Creditor',
      'Sample field account.account_number -> ****4321',
      input.plan.blockers.length ? `Blocked: ${input.plan.blockers[0]}` : 'Preview can render with the current manager template checks.'
    ]
  };
}

export async function buildTemplateTestLabContext(input: {
  supabase: SupabaseLike;
  managerId: string;
  round?: TemplateRound;
  packet?: string | null;
}): Promise<TemplateTestLabContext> {
  const round = input.round || '1st Round';
  const packet = normalizePacket(input.packet);
  const [library, plan] = await Promise.all([
    getManagerTemplateLibraryContext({ supabase: input.supabase, managerId: input.managerId, round }),
    previewGenerationPlan({ supabase: input.supabase, managerId: input.managerId, round, renderMode: 'release-test' })
  ]);
  const assets = library.assets;
  return {
    round,
    packet,
    library,
    plan,
    assets,
    downloadableAssets: assets.map((asset) => ({ id: asset.id, label: slotLabel(asset), filename: asset.original_filename || `${slotLabel(asset)} template`, href: `/api/template-assets/download?assetId=${encodeURIComponent(asset.id)}` })),
    testCases: buildTestCases(plan),
    output: buildOutput({ packet, plan, assets }),
    status: statusFrom(plan, assets)
  };
}
