'use client';

import { useEffect } from 'react';
import {
  loadPacketAssets,
  normalizeSupportingLayout,
  savePacketAssets,
  type PacketAssets
} from '../lib/packet-assets';
import { recoverReferenceMetaFromFiles, rounds, type LetterReference, type Round } from '../lib/reference-store';
import { recoverAllTemplateExhibitsFromFiles, type TemplateExhibits } from '../lib/template-exhibits';
import type { WorkspacePreferences } from '../lib/workspace-preferences';

type StatusTone = 'info' | 'success' | 'error';

type Props = {
  round: Round;
  caseId: string;
  clientName: string;
  source: string;
  originalSource: string;
  normalized: boolean;
  preferences: WorkspacePreferences;
  disabled?: boolean;
  onImported: (value: {
    round: Round;
    caseId: string;
    source: string;
    originalSource: string;
    normalized: boolean;
    references: LetterReference[];
    templates: TemplateExhibits;
    evidence: PacketAssets;
    notices: string[];
  }) => void;
  onMessage: (message: string, tone?: StatusTone) => void;
};

function cleanupLegacySnapshotUiState() {
  if (typeof window === 'undefined') return;

  [
    'lettergenerator.workspace-snapshot.pending',
    'lettergenerator.workspace-snapshot.last-error',
    'lettergenerator.workspace-snapshot.import-draft',
    'lettergenerator.device-consistency.warning-dismissed'
  ].forEach((key) => localStorage.removeItem(key));
}

function normalizeEvidenceLayout(round: Round, caseId: string) {
  if (!caseId) return;

  const storageKey = `${round}::${caseId}`;
  const current = loadPacketAssets(storageKey);
  const normalized = normalizeSupportingLayout(current);

  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    savePacketAssets(storageKey, normalized);
  }
}

export default function WorkspacePortabilityPanel({ round, caseId }: Props) {
  useEffect(() => {
    let cancelled = false;

    async function runAutomaticConsistency() {
      try {
        cleanupLegacySnapshotUiState();
        await recoverReferenceMetaFromFiles();
        await recoverAllTemplateExhibitsFromFiles(rounds);
        if (!cancelled) normalizeEvidenceLayout(round, caseId);
      } catch (error) {
        console.warn('Automatic workspace consistency repair skipped.', error);
      }
    }

    void runAutomaticConsistency();

    return () => {
      cancelled = true;
    };
  }, [round, caseId]);

  return null;
}
