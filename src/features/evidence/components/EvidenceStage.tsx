'use client';

import SupportingDocumentsSetup from '../../../../components/SupportingDocumentsSetup';
import type { PacketAssets } from '../../../../lib/packet-assets';

type EvidenceStageProps = {
  storageKey: string;
  clientName: string;
  onChanged: (assets: PacketAssets) => void;
  onMessage: (message: string) => void;
};

export default function EvidenceStage({ storageKey, clientName, onChanged, onMessage }: EvidenceStageProps) {
  return <SupportingDocumentsSetup embedded storageKey={storageKey} clientName={clientName} onChanged={onChanged} onMessage={onMessage} />;
}
