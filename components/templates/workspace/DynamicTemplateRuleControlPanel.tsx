import type { DynamicTemplateInspectionResult, DynamicTemplateRule } from '../../../lib/templates/intelligence';
import DynamicTemplateDetectionPanel from './DynamicTemplateDetectionPanel';

export default function DynamicTemplateRuleControlPanel({ inspection, rules }: { inspection: DynamicTemplateInspectionResult; rules: DynamicTemplateRule[] }) {
  return <section className="admin-monitor-card dynamic-template-rule-control" data-dynamic-template-rule-control="true">
    <div className="admin-monitor-card-header"><div><p>Rule control center</p><h2>Detected and customizable rules</h2></div><span className="template-workspace-pill">{rules.length} rules</span></div>
    <div className="dynamic-template-rule-layout">
      <DynamicTemplateDetectionPanel inspection={inspection} />
      <section className="dynamic-template-custom-rule-editor" data-dynamic-template-custom-rule-editor="true">
        <form className="manager-account-settings-form" action="/api/template-intelligence/actions" method="post">
          <input type="hidden" name="action" value="save-rule" />
          <label><span>Rule type</span><input name="ruleType" defaultValue="canonical-field-map" /></label>
          <label><span>Source pattern</span><input name="sourceText" placeholder="{{consumer.full_name}}" /></label>
          <label><span>Canonical field</span><input name="canonicalField" placeholder="consumer.full_name" /></label>
          <label><span>Rule config JSON</span><input name="ruleConfig" placeholder='{"mode":"preserve-layout"}' /></label>
          <button type="button">Custom rules are saved through the Template Intelligence API</button>
        </form>
        <div className="template-rule-list">
          {rules.slice(0, 8).map((rule) => <article key={rule.id} className={`template-rule-row ${rule.validationState === 'blocked' ? 'blocked' : rule.validationState === 'warning' ? 'warning' : 'valid'}`}><div><strong>{rule.outputToken || rule.sourceText || rule.ruleKey}</strong><span>{rule.validationReason || rule.ruleType}</span></div><small>{rule.ruleType}</small></article>)}
          {!rules.length ? <div className="admin-monitor-empty">Detected rules appear after a manager template upload or manual inspection.</div> : null}
        </div>
      </section>
    </div>
  </section>;
}
