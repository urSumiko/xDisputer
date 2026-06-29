import { summarizeTemplateQuality } from '../lib/manager-template-authority';
import type { Round } from '../lib/reference-store';
import type { ExhibitKind } from '../lib/template-exhibits';
import type { LetterType } from '../lib/letter-engine';

type TemplateAsset = {
  id: string;
  round_label: Round;
  template_kind: 'LETTER' | 'EXHIBIT';
  letter_type: LetterType | null;
  exhibit_kind: ExhibitKind | null;
  original_filename: string;
  content_hash?: string | null;
  version_number?: number | null;
  validation_json?: Record<string, unknown> | null;
};

function shortHash(value?: string | null) {
  return value ? value.slice(0, 10) : '—';
}

export default function ManagerTemplateLibraryStatus({ round, assets, loading }: { round: Round; assets: TemplateAsset[]; loading: boolean }) {
  const warningCount = assets.filter((asset) => summarizeTemplateQuality({ file: asset.original_filename, validationJson: asset.validation_json }).tone === 'warning').length;
  const latestVersion = assets.reduce((max, asset) => Math.max(max, asset.version_number || 0), 0);
  const letterCount = assets.filter((asset) => asset.template_kind === 'LETTER').length;
  const exhibitCount = assets.filter((asset) => asset.template_kind === 'EXHIBIT').length;

  return <section className="minimal-report-summary manager-template-summary" aria-label="Manager template library status" data-manager-template-summary="true">
    <article><span>Active templates</span><strong>{loading ? '…' : assets.length}</strong><small>{round}</small></article>
    <article><span>Letters / exhibits</span><strong>{letterCount}/{exhibitCount}</strong><small>active slots</small></article>
    <article><span>Latest version</span><strong>{latestVersion || '—'}</strong><small>manager default</small></article>
    <article><span>Needs review</span><strong>{warningCount}</strong><small>validation warnings</small></article>
    <article><span>Storage proof</span><strong>{shortHash(assets[0]?.content_hash)}</strong><small>content hash</small></article>
  </section>;
}
