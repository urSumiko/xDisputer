import type { TemplateTestLabContext } from '../../../lib/templates/workspace/template-test-lab-service';

const rounds = ['1st Round', '2nd Round', '3rd Round', 'Final'] as const;
const packets = [
  { value: 'DISPUTE', label: 'Dispute Packet' },
  { value: 'LATE_PAYMENT', label: 'Late Payment Packet' }
] as const;

function statusCopy(status: TemplateTestLabContext['status']) {
  if (status === 'ready') return 'Ready for Disputer use';
  if (status === 'warning') return 'Ready with warnings';
  return 'Blocked until fixed';
}

function statusTone(status: string) {
  return status === 'pass' ? 'ready' : status === 'warn' ? 'warning' : 'blocked';
}

function hrefFor(round: string, packet: string) {
  return `/manager-workspace/test?round=${encodeURIComponent(round)}&packet=${encodeURIComponent(packet)}`;
}

export default function TemplateTestLabHub({ context }: { context: TemplateTestLabContext }) {
  const previewText = context.output.body.join('\n');

  return <section className="template-workspace-hub template-test-lab-hub" data-template-workspace-hub="test-lab" data-template-process="template-output-test-lab">
    <section className="admin-monitor-card template-test-command-card">
      <div>
        <p className="eyebrow">Pre-Disputer testing</p>
        <h2>Template Test Lab</h2>
        <p>Test the manager-owned template with sample Source Data before assigned Disputers use it. Download active templates for inspection when needed.</p>
      </div>
      <span className={`template-test-status ${context.status}`}>{statusCopy(context.status)}</span>
    </section>

    <section className="template-test-layout">
      <aside className="admin-monitor-card template-test-side-panel" aria-label="Template test controls">
        <div className="template-test-control-group">
          <strong>Round</strong>
          <div className="template-test-choice-list">
            {rounds.map((round) => <a key={round} className={round === context.round ? 'current' : ''} href={hrefFor(round, context.packet)}>{round}</a>)}
          </div>
        </div>
        <div className="template-test-control-group">
          <strong>Packet</strong>
          <div className="template-test-choice-list">
            {packets.map((packet) => <a key={packet.value} className={packet.value === context.packet ? 'current' : ''} href={hrefFor(context.round, packet.value)}>{packet.label}</a>)}
          </div>
        </div>
        <div className="template-test-control-group">
          <strong>Active template downloads</strong>
          <div className="template-test-download-list">
            {context.downloadableAssets.length ? context.downloadableAssets.map((asset) => <a key={asset.id} href={asset.href}><span>{asset.label}</span><small>{asset.filename}</small></a>) : <p>No active manager templates are available for this round.</p>}
          </div>
        </div>
      </aside>

      <main className="template-test-main-panel">
        <section className="admin-monitor-card template-test-preview-card">
          <header>
            <div>
              <p className="eyebrow">Generated output preview</p>
              <h3>{context.output.title}</h3>
              <span>{context.round} · {context.packet === 'LATE_PAYMENT' ? 'Late payment route' : 'Standard route'}</span>
            </div>
          </header>
          <pre>{previewText}</pre>
        </section>

        <section className="template-test-grid">
          <article className="admin-monitor-card template-test-card">
            <p className="eyebrow">Precision checklist</p>
            <div className="template-test-checklist">
              {context.output.checklist.map((item) => <div key={item.label} className={`template-test-check ${statusTone(item.status)}`}><strong>{item.label}</strong><span>{item.detail}</span></div>)}
            </div>
          </article>

          <article className="admin-monitor-card template-test-card">
            <p className="eyebrow">Sample Source Data</p>
            <div className="template-test-case-list">
              {context.testCases.map((test) => <div key={test.id}><strong>{test.label}</strong><span>{test.value}</span><small>{test.id}</small></div>)}
            </div>
          </article>
        </section>

        <section className="admin-monitor-card template-test-card">
          <p className="eyebrow">Renderer plan</p>
          <div className="template-test-render-list">
            <div><strong>{context.plan.generatedVariables.length}</strong><span>generated variables checked</span></div>
            <div><strong>{context.plan.preservedStaticText.length}</strong><span>static text blocks preserved</span></div>
            <div><strong>{context.plan.tablePlans.length}</strong><span>table plans inspected</span></div>
            <div><strong>{context.plan.blockers.length}</strong><span>release blockers</span></div>
          </div>
          {context.plan.blockers.length ? <p className="template-test-blocker">{context.plan.blockers[0]}</p> : <p className="template-test-ok">No critical blocker detected for this test preview.</p>}
        </section>
      </main>
    </section>
  </section>;
}
