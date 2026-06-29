import type { DynamicTemplateInspectionResult, DynamicTemplateRule } from '../../../lib/templates/intelligence';
import type { TemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';
import { buildTemplateRegistrationProfile, topRegistrationAnnotations } from '../../../lib/templates/workspace/template-registration-service';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function laneClass(lane: string) {
  if (lane === 'preserve') return 'ready';
  if (lane === 'map') return 'info';
  if (lane === 'extract') return 'active';
  if (lane === 'table') return 'warning';
  return 'blocked';
}

export default function TemplateRegistrationConsole({ context, intelligence, rules }: { context: TemplateLibraryContext; intelligence: DynamicTemplateInspectionResult; rules: DynamicTemplateRule[] }) {
  const profile = buildTemplateRegistrationProfile({ context, intelligence, rules });
  const top = topRegistrationAnnotations(profile, 10);
  const hasTemplate = Boolean(context.latestAsset?.id);
  return <section className="template-registration-console" data-template-registration-console="v1" aria-label="Template registration console">
    <div className="template-registration-hero">
      <div className="template-registration-copy">
        <p className="eyebrow">Precision registration</p>
        <h2>Register how this template should behave.</h2>
        <span>Manager marks the template intent once. Studio converts detected text, variables, entities, and tables into a lightweight annotation profile for the generation engine.</span>
      </div>
      <div className="template-registration-score" aria-label="Template registration confidence"><strong>{profile.summary.averageConfidence}%</strong><small>avg confidence</small></div>
    </div>
    <div className="template-registration-metrics" aria-label="Registration metrics">
      <article><strong>{profile.summary.preserve}</strong><span>Preserve</span></article>
      <article><strong>{profile.summary.map}</strong><span>Map</span></article>
      <article><strong>{profile.summary.extract}</strong><span>Extract</span></article>
      <article><strong>{profile.summary.table}</strong><span>Tables</span></article>
      <article className={profile.summary.blockers ? 'attention' : ''}><strong>{profile.summary.blockers}</strong><span>Blockers</span></article>
    </div>
    <div className="template-registration-grid">
      <form action="/api/template-registration" method="post" className="template-registration-form">
        <input type="hidden" name="assetId" value={context.latestAsset?.id || ''} />
        <input type="hidden" name="round" value={context.activeRound} />
        <label><span>Template intent</span><select name="managerIntent" defaultValue="precision-output"><option value="precision-output">Use for high-precision generated output</option><option value="preserve-legal-copy">Preserve legal copy and fill only mapped fields</option><option value="dynamic-letter">Dynamic letter: map fields, generate sections, protect tables</option><option value="review-only">Review-only registration</option></select></label>
        <label><span>Annotation mode</span><select name="annotationMode" defaultValue="safe"><option value="safe">Safe — preserve first, replace only mapped fields</option><option value="strict">Strict — block if required field is unmapped</option><option value="adaptive">Adaptive — allow manager rules for weak areas</option></select></label>
        <label><span>In-place anchor phrase</span><input name="inPlaceAnchor" defaultValue="Account Name – Account number" placeholder="Exact wording in the template" /></label>
        <label><span>Render policy</span><select name="renderPolicy" defaultValue="replace-in-place"><option value="replace-in-place">Replace in the same template location</option><option value="block-if-missing">Block if the anchor cannot be found</option><option value="manager-review">Require manager review before use</option></select></label>
        <label><span>Preservation policy</span><select name="preservationPolicy" defaultValue="preserve-surrounding-copy"><option value="preserve-surrounding-copy">Preserve surrounding copy</option><option value="preserve-table-layout">Preserve table layout</option><option value="preserve-paragraph-layout">Preserve paragraph layout</option></select></label>
        <label><span>Manager note for this template</span><textarea name="managerNotes" rows={3} placeholder="Keep legal paragraph static, map consumer fields, protect table rows, generate reason from source data." /></label>
        <button type="submit" className="admin-action-button primary" disabled={!hasTemplate}>{hasTemplate ? 'Register precision profile' : 'Upload template first'}</button>
        <small>{hasTemplate ? `${context.latestAsset?.original_filename || 'Template'} · ${context.activeRound}` : 'Registration is available after the manager uploads an active template.'}</small>
      </form>
      <div className="template-registration-annotations" aria-label="Detected template annotations">
        <div className="template-registration-section-header"><strong>Detected annotation lanes</strong><span>{profile.summary.annotations} total</span></div>
        {top.length ? top.map((annotation) => <article key={annotation.id} className="template-registration-annotation"><span className={`template-workspace-pill ${laneClass(annotation.lane)}`}>{annotation.label}</span><div><strong>{annotation.canonicalField || annotation.outputToken || annotation.sourcePath}</strong><small>{annotation.sourceText}</small></div><em>{percent(annotation.confidence)}</em></article>) : <article className="template-registration-empty"><strong>No annotations detected yet</strong><span>Upload a template or run Studio inspection first.</span></article>}
      </div>
    </div>
  </section>;
}
