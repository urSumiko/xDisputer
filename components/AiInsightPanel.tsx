'use client';

export type ReviewClientState = 'idle' | 'loading' | 'ready' | 'error';
export type ReviewFinding = { severity: 'info' | 'warning' | 'blocker'; title: string; detail: string };
export type ReviewSuggestedAction = { id: string; label: string; requiresApproval?: boolean };
export type ReviewPanelResult = { summary: string; findings: ReviewFinding[]; suggestedActions?: ReviewSuggestedAction[]; requestId?: string; modelName?: string; latencyMs?: number };

type Props = {
  title: string;
  description: string;
  status: ReviewClientState;
  result: ReviewPanelResult | null;
  actionLabel?: string;
  onRun: () => void | Promise<void>;
};

export default function AiInsightPanel({ title, description, status, result, actionLabel = 'Run review', onRun }: Props) {
  return (
    <section className={`ai-insight-panel ${status}`} data-review-panel="deterministic">
      <header>
        <div>
          <p className="eyebrow">Deterministic review</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button type="button" className="secondary-button" disabled={status === 'loading'} onClick={() => { void onRun(); }}>
          {status === 'loading' ? 'Reviewing…' : actionLabel}
        </button>
      </header>
      {result ? (
        <div className="ai-insight-result">
          <strong>{result.summary}</strong>
          <ul>
            {result.findings.map((finding, index) => (
              <li key={`${finding.title}-${index}`} data-severity={finding.severity}>
                <b>{finding.title}</b>
                <p>{finding.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="ai-insight-empty">Run the review to show findings.</p>}
    </section>
  );
}
