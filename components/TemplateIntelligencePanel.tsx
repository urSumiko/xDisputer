'use client';

import { useMemo, useState } from 'react';
import AiInsightPanel, { type ReviewClientState, type ReviewFinding, type ReviewPanelResult, type ReviewSuggestedAction } from './AiInsightPanel';
import type { LetterReference, Round } from '../lib/reference-store';
import type { ExhibitKind, TemplateExhibits } from '../lib/template-exhibits';
import type { CanonicalTemplateField, TemplateContract } from '../lib/template-contracts';

const GOVERNANCE_SLOTS = [
  'CLIENT_IDENTITY',
  'CLIENT_ADDRESS',
  'DOCUMENT_DATE',
  'BUREAU_ROUTING',
  'ACCOUNT_DETAILS',
  'AFFIDAVIT_JURISDICTION',
  'FTC_DETAILS',
  'STATIC_APPENDIX'
] as const;

const CANONICAL_TO_GOVERNANCE: Record<CanonicalTemplateField, typeof GOVERNANCE_SLOTS[number]> = {
  'client.name': 'CLIENT_IDENTITY',
  'client.address': 'CLIENT_ADDRESS',
  'client.dob': 'CLIENT_IDENTITY',
  'client.ssnMasked': 'CLIENT_IDENTITY',
  'client.email': 'CLIENT_IDENTITY',
  'client.phone': 'CLIENT_IDENTITY',
  'letter.date': 'DOCUMENT_DATE',
  'bureau.name': 'BUREAU_ROUTING',
  'bureau.address': 'BUREAU_ROUTING',
  'accounts.lines': 'ACCOUNT_DETAILS',
  'inquiries.lines': 'ACCOUNT_DETAILS',
  'affidavit.state': 'AFFIDAVIT_JURISDICTION',
  'affidavit.county': 'AFFIDAVIT_JURISDICTION',
  'ftc.reportNumber': 'FTC_DETAILS',
  'ftc.reportDate': 'FTC_DETAILS',
  'ftc.statement': 'FTC_DETAILS'
};

type Props = {
  round: Round;
  slots: LetterReference[];
  managedExhibits?: TemplateExhibits;
};

function contractFields(contract?: TemplateContract) {
  return new Set([...(contract?.validation.fulfilledFields || []), ...(contract?.requiredCanonicalFields || [])]);
}

function coveredSlots(contracts: Array<TemplateContract | undefined>) {
  const covered = new Set<string>();
  contracts.forEach((contract) => {
    contractFields(contract).forEach((field) => covered.add(CANONICAL_TO_GOVERNANCE[field]));
  });
  return covered;
}

function exhibitEntries(exhibits?: TemplateExhibits) {
  return Object.entries(exhibits || {}) as Array<[ExhibitKind, NonNullable<TemplateExhibits[ExhibitKind]> | null]>;
}

function buildFindings(round: Round, slots: LetterReference[], exhibits?: TemplateExhibits): ReviewFinding[] {
  const contracts = [...slots.map((slot) => slot.contract), ...exhibitEntries(exhibits).map(([, asset]) => asset?.contract)];
  const covered = coveredSlots(contracts);
  const findings: ReviewFinding[] = [];
  const configuredLetters = slots.filter((slot) => Boolean(slot.file));
  const missingLetters = slots.filter((slot) => !slot.file);
  const configuredExhibits = exhibitEntries(exhibits).filter(([, asset]) => Boolean(asset));

  if (missingLetters.length > 0) findings.push({ severity: 'blocker', title: 'Letter template slots incomplete', detail: `${round} is missing ${missingLetters.map((slot) => slot.name).join(', ')}.` });
  if (!configuredExhibits.some(([kind]) => kind === 'FCRA')) findings.push({ severity: 'warning', title: 'Static legal exhibit not configured', detail: 'FCRA legal exhibit is not currently attached to this round.' });
  if (!configuredExhibits.some(([kind]) => kind === 'ATTACHMENT')) findings.push({ severity: 'warning', title: 'Attachment exhibit not configured', detail: 'Attachment exhibit is not currently attached to this round.' });

  GOVERNANCE_SLOTS.forEach((slot) => {
    if (!covered.has(slot) && slot !== 'STATIC_APPENDIX') {
      findings.push({ severity: slot === 'ACCOUNT_DETAILS' || slot === 'BUREAU_ROUTING' ? 'blocker' : 'warning', title: `Governance slot needs review: ${slot}`, detail: 'No active template contract currently proves this slot is fulfilled.' });
    }
  });

  contracts.forEach((contract) => {
    if (contract?.validation.status === 'BLOCKED') findings.push({ severity: 'blocker', title: `${contract.kind} template is blocked`, detail: contract.validation.errors[0] || 'Template contract validation reported a blocked status.' });
    if (contract?.validation.warnings.length) findings.push({ severity: 'warning', title: `${contract.kind} template warnings`, detail: contract.validation.warnings.slice(0, 2).join(' ') });
  });

  if (!findings.length && configuredLetters.length) findings.push({ severity: 'info', title: 'Template intelligence is clear', detail: 'Configured templates have no deterministic blockers.' });
  if (!configuredLetters.length) findings.push({ severity: 'blocker', title: 'No letter templates configured', detail: 'Upload or assign at least one letter template before using this round for generation.' });

  return findings;
}

function buildActions(findings: ReviewFinding[]): ReviewSuggestedAction[] {
  const actions: ReviewSuggestedAction[] = [];
  if (findings.some((finding) => finding.title.includes('Letter template slots incomplete') || finding.title.includes('No letter templates'))) {
    actions.push({ id: 'upload-letter-template', label: 'Upload or assign missing letter templates', requiresApproval: false });
  }
  if (findings.some((finding) => finding.title.includes('Governance slot needs review'))) {
    actions.push({ id: 'review-template-contract', label: 'Review template contract and placeholders', requiresApproval: false });
  }
  if (findings.some((finding) => finding.title.includes('exhibit not configured'))) {
    actions.push({ id: 'review-exhibit-setup', label: 'Review required packet exhibits', requiresApproval: false });
  }
  return actions;
}

function summarize(findings: ReviewFinding[]) {
  const blockers = findings.filter((finding) => finding.severity === 'blocker').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  if (blockers > 0) return `${blockers} blocker(s) and ${warnings} warning(s) need template review.`;
  if (warnings > 0) return `${warnings} warning(s) detected in the active template configuration.`;
  return 'Deterministic template review is clear.';
}

export default function TemplateIntelligencePanel({ round, slots, managedExhibits }: Props) {
  const [status, setStatus] = useState<ReviewClientState>('idle');
  const [result, setResult] = useState<ReviewPanelResult | null>(null);
  const findings = useMemo(() => buildFindings(round, slots, managedExhibits), [round, slots, managedExhibits]);
  const actions = useMemo(() => buildActions(findings), [findings]);

  function runReview() {
    setStatus('loading');
    const next: ReviewPanelResult = {
      summary: summarize(findings),
      findings,
      suggestedActions: actions,
      requestId: 'deterministic-template-review',
      modelName: 'deterministic',
      latencyMs: 0
    };
    setResult(next);
    setStatus(findings.some((finding) => finding.severity === 'blocker') ? 'error' : 'ready');
  }

  return (
    <AiInsightPanel
      title="Template Intelligence"
      description="Explains slot coverage, missing template contracts, and packet-readiness risks without changing template authority or assets."
      status={status}
      result={result}
      actionLabel="Run template review"
      onRun={runReview}
    />
  );
}
