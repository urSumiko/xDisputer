'use client';

import type { LetterRoute, ParsedSource } from '../lib/letter-engine';
import type { PacketAssets } from '../lib/packet-assets';
import type { TemplateFieldContract } from '../lib/template-contracts';

type Props = {
  parsed: ParsedSource;
  routes: LetterRoute[];
  evidence: PacketAssets;
  sourceWarnings: Array<{ message: string }>;
  generationBlockers?: string[];
  missingLetters: string[];
  affidavitReady: boolean;
  customFields: TemplateFieldContract[];
  packetReady: boolean;
  scopeConfirmed: boolean;
  strict: boolean;
};

void ({} as Props);

export default function SourceReviewAiPanel(_props: Props) {
  return null;
}
