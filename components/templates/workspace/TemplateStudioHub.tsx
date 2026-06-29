import DynamicTemplateRuleControlPanel from './DynamicTemplateRuleControlPanel';
import TemplateReadinessCard from './TemplateReadinessCard';
import TemplateRegistrationConsole from './TemplateRegistrationConsole';
import TemplateRuleEditor from './TemplateRuleEditor';
import TemplateWorkflowFrameworkPanel from './TemplateWorkflowFrameworkPanel';
import type { DynamicTemplateInspectionResult, DynamicTemplateRule } from '../../../lib/templates/intelligence';
import type { TemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';
import type { TemplateStructureInspection } from '../../../lib/templates/workspace/template-studio-service';
import type { TemplateWorkflowFramework } from '../../../lib/templates/workspace/template-workflow-framework';

export default function TemplateStudioHub({ context, inspection, intelligence, intelligenceRules, workflowFramework }: { context: TemplateLibraryContext; inspection: TemplateStructureInspection; intelligence: DynamicTemplateInspectionResult; intelligenceRules: DynamicTemplateRule[]; workflowFramework: TemplateWorkflowFramework }) {
  return <section className="template-workspace-hub template-studio-minimal-hub" data-template-workspace-hub="studio" data-template-process="template-authoring-rules" data-template-studio-ui="workflow-framework-first">
    <TemplateReadinessCard contract={context.contract} summary="Register the active template once, then let Studio keep mapping, preservation, and table rules available under Advanced analysis." action={context.nextAction} />
    <TemplateWorkflowFrameworkPanel framework={workflowFramework} />
    <TemplateRegistrationConsole context={context} intelligence={intelligence} rules={intelligenceRules} />
    <details className="template-studio-advanced-panel">
      <summary><span>Advanced analysis</span><small>Open only when you need parser rules, raw mapping counts, or boundary diagnostics.</small></summary>
      <DynamicTemplateRuleControlPanel inspection={intelligence} rules={intelligenceRules} />
      <section className="template-workspace-hub-grid studio" aria-label="Template Studio inspection summary">
        <article className="admin-monitor-card template-workspace-status-card"><p className="eyebrow">Static text</p><strong>{intelligence.staticTextBlocks.length}</strong><span>Legal and instruction blocks marked for preservation.</span></article>
        <article className="admin-monitor-card template-workspace-status-card"><p className="eyebrow">Variables</p><strong>{intelligence.variables.length}</strong><span>Detected template variables routed to canonical or manager rules.</span></article>
        <article className="admin-monitor-card template-workspace-status-card"><p className="eyebrow">Mapped fields</p><strong>{intelligence.mappedFields.length}</strong><span>Canonical mappings available for renderer replacement.</span></article>
      </section>
      <section className="template-workspace-two-column">
        <TemplateRuleEditor rules={inspection.rules} />
        <section className="admin-monitor-card template-rule-editor" data-template-studio-boundaries="true">
          <div className="admin-monitor-card-header"><div><p>Rule boundaries</p><h2>What Studio owns</h2></div><span className="template-workspace-pill ready">wired</span></div>
          <div className="template-rule-list">
            <article className="template-rule-row valid"><div><strong>Preserve static legal text</strong><span>Legal copy and declarations remain stable unless explicitly overridden by a manager rule.</span></div><small>preserve</small></article>
            <article className="template-rule-row valid"><div><strong>Map variables to canonical fields</strong><span>Variables must resolve through the canonical layer.</span></div><small>mapping</small></article>
            <article className="template-rule-row valid"><div><strong>Protect table layouts</strong><span>Tables preserve structure while rows can be generated from source data.</span></div><small>tables</small></article>
            <article className="template-rule-row warning"><div><strong>Route unresolved fields</strong><span>Unmapped required fields are routed to Studio.</span></div><small>if/else</small></article>
          </div>
        </section>
      </section>
    </details>
  </section>;
}
