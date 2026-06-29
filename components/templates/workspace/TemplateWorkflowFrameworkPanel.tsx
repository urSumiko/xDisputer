import type { TemplateWorkflowFramework, WorkflowSeverity } from '../../../lib/templates/workspace/template-workflow-framework';

function tone(value: WorkflowSeverity) {
  if (value === 'ready') return 'ready';
  if (value === 'warning') return 'warning';
  return 'blocked';
}

function laneTitle(value: string) {
  return value.replace(/-/g, ' ');
}

export default function TemplateWorkflowFrameworkPanel({ framework }: { framework: TemplateWorkflowFramework }) {
  const priorityRules = framework.rules.slice(0, 12);
  return <section className="template-workflow-framework-panel" data-template-workflow-framework="universal">
    <header className="template-workflow-framework-hero">
      <div>
        <p className="eyebrow">Universal workflow framework</p>
        <h2>{framework.title}</h2>
        <span>{framework.summary}</span>
      </div>
      <strong className={`template-workflow-status ${tone(framework.status)}`}>{framework.status}</strong>
    </header>

    <div className="template-workflow-principles" aria-label="Workflow principles">
      {framework.principles.map((item, index) => <article key={item}><strong>{String(index + 1).padStart(2, '0')}</strong><span>{item}</span></article>)}
    </div>

    <section className="template-workflow-rules" aria-label="Detected rules and mappings">
      <div className="template-registration-section-header"><strong>Detected mapping and render rules</strong><span>{framework.rules.length} rule(s)</span></div>
      {priorityRules.map((item) => <article key={item.id} className={`template-workflow-rule ${tone(item.status)}`}>
        <div className="template-workflow-rule-main">
          <span className="template-workspace-pill info">{laneTitle(item.lane)}</span>
          <strong>{item.title}</strong>
          <small>{item.sourceText}</small>
        </div>
        <div className="template-workflow-rule-grid">
          <div><span>Canonical target</span><strong>{item.canonicalTarget}</strong></div>
          <div><span>Render action</span><strong>{item.renderAction}</strong></div>
          <div><span>Preservation</span><strong>{item.preservation}</strong></div>
          <div><span>Manager customization</span><strong>{item.customization}</strong></div>
        </div>
        <p>{item.reason}</p>
      </article>)}
    </section>

    <section className="template-workflow-next-actions" aria-label="Recommended next actions">
      <p className="eyebrow">Execution plan</p>
      {framework.nextActions.map((item) => <span key={item}>{item}</span>)}
    </section>
  </section>;
}
