'use client';

import dynamic from 'next/dynamic';
import type { PacketAssets } from '../../../../lib/packet-assets';

const EvidenceStage = dynamic(() => import('./EvidenceStage'), {
  ssr: false,
  loading: () => <section className="source-review source-review-loading" aria-live="polite">Preparing evidence workspace…</section>
});

type LazyEvidenceStageProps = {
  storageKey: string;
  clientName: string;
  onChanged: (assets: PacketAssets) => void;
  onMessage: (message: string) => void;
};

export default function LazyEvidenceStage(props: LazyEvidenceStageProps) {
  return <EvidenceStage {...props} />;
}
