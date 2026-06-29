'use client';

import type { ClientCaseRecord, FilingRecord } from '../lib/client-operations-store';

type Props = {
  cases: ClientCaseRecord[];
  filings: FilingRecord[];
  activeCaseId?: string;
  outputsAvailable: boolean;
  onOpenTemplates: () => void;
  onOpenSource: () => void;
  onOpenOutputs: () => void;
  onStartCase: () => void;
  onMarkSent: (id: string) => void;
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function statusLabel(status: ClientCaseRecord['status']) {
  if (status === 'SOURCE_LOCKED') return 'Source loaded';
  if (status === 'EVIDENCE_READY') return 'Evidence ready';
  if (status === 'REVIEW_READY') return 'Review ready';
  return 'Package ready';
}

export default function ClientCenterWorkspace({ cases, filings, activeCaseId, outputsAvailable, onOpenTemplates, onOpenSource, onOpenOutputs, onStartCase, onMarkSent }: Props) {
  const activeCase = cases.find((record) => record.id === activeCaseId) || cases[0];
  const readyItems = filings.filter((record) => record.status === 'PDF_READY');
  const completedItems = filings.filter((record) => record.status === 'SENT');
  const reviewReady = cases.filter((record) => record.status === 'REVIEW_READY' || record.status === 'PDF_READY');
  const title = readyItems.length ? `${readyItems.length} final item${readyItems.length === 1 ? '' : 's'} ready` : outputsAvailable ? 'Generated package is ready' : activeCase ? `${activeCase.clientName} is in progress` : 'No active client packet yet';
  const copy = readyItems.length
    ? 'Open outputs, download the final package, then update your local handoff record.'
    : outputsAvailable
      ? 'Review documents and download the ordered package when ready.'
      : activeCase
        ? 'Continue the guided workflow: templates, source data, outputs, then handoff.'
        : 'Start a case, configure templates, load source data, and generate from one guided workspace.';

  function primaryAction() {
    if (readyItems.length || outputsAvailable) onOpenOutputs();
    else if (activeCase) onOpenSource();
    else onStartCase();
  }

  return <section className="client-center-workspace operations-workspace saas-dashboard-shell">
    <section className="panel client-center-hero saas-panel">
      <div>
        <p className="eyebrow">Client Center</p>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="client-center-actions">
          <button type="button" className="action-button" onClick={primaryAction}>{readyItems.length || outputsAvailable ? 'Open Outputs' : activeCase ? 'Continue Case' : 'Start Case'}</button>
          <button type="button" className="secondary-button" onClick={onOpenTemplates}>Templates</button>
        </div>
      </div>
      <div className="client-center-readiness" aria-label="Client workspace summary">
        <span><strong>{cases.length}</strong><small>Cases</small></span>
        <span><strong>{reviewReady.length}</strong><small>Ready review</small></span>
        <span><strong>{readyItems.length}</strong><small>Final items</small></span>
        <span><strong>{completedItems.length}</strong><small>Completed</small></span>
      </div>
    </section>

    <section className="client-center-grid">
      <article className="panel client-center-card">
        <header><div><p className="eyebrow">Active workspace</p><h3>Current case</h3></div></header>
        {!activeCase ? <div className="operations-empty compact-empty"><strong>No active case</strong><p>Start a case to see progress and next steps here.</p></div> : <div className="client-case-summary">
          <strong>{activeCase.clientName}</strong>
          <span>{activeCase.round} · {statusLabel(activeCase.status)}</span>
          <div className="client-case-progress">
            <small>{activeCase.routeCount} routes</small>
            <small>{activeCase.evidenceCount} evidence files</small>
            <small>{activeCase.editableCount} editable docs</small>
          </div>
          <button type="button" className="secondary-button" onClick={activeCase.status === 'REVIEW_READY' || outputsAvailable ? onOpenOutputs : onOpenSource}>{activeCase.status === 'REVIEW_READY' || outputsAvailable ? 'Open Outputs' : 'Continue'}</button>
        </div>}
      </article>

      <article className="panel client-center-card">
        <header><div><p className="eyebrow">Handoff record</p><h3>Local checklist</h3></div></header>
        {filings.length === 0 ? <div className="operations-empty compact-empty"><strong>No handoff record yet</strong><p>Generated items appear here after output review.</p></div> : <div className="client-delivery-list" role="list">
          {filings.slice(0, 5).map((record) => <article key={record.id} className="client-delivery-row" role="listitem">
            <div><strong>{record.bureau}</strong><span>{record.packetType === 'DISPUTE' ? 'Dispute' : 'Late Payment'} · {formatDate(record.generatedAt)}</span></div>
            {record.status === 'PDF_READY'
              ? <button type="button" className="secondary-button" onClick={() => onMarkSent(record.id)}>Mark complete</button>
              : <em className="operations-status ready">Complete</em>}
          </article>)}
        </div>}
      </article>
    </section>
  </section>;
}
