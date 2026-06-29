import type { DynamicTemplateRule } from '../../../lib/templates/workspace/template-workspace-contract';

export default function TemplateRuleEditor({ rules }: { rules: DynamicTemplateRule[] }) {
  const visibleRules = rules.slice(0, 8);
  return <section className="admin-monitor-card template-rule-editor" data-template-rule-editor="true">
    <div className="admin-monitor-card-header"><div><p>Authoring rules</p><h2>Template rule editor</h2></div><span className="template-workspace-pill">{rules.length} rules</span></div>
    <div className="template-rule-list">
      {visibleRules.length ? visibleRules.map((rule) => <article key={rule.id} className={`template-rule-row ${rule.validationState}`}>
        <div><strong>{rule.outputToken || rule.sourcePattern}</strong><span>{rule.reason}</span></div>
        <small>{rule.ruleType}</small>
      </article>) : <div className="admin-monitor-empty">Upload a template to inspect variables, fields, entities, and table rules.</div>}
    </div>
  </section>;
}
