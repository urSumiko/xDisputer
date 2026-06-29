#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (file) => existsSync(file) ? readFileSync(file, 'utf8') : (failures.push(`missing ${file}`), '');
const must = (file, marker, label) => { if (!read(file).includes(marker)) failures.push(`${file}: ${label}`); };
const mustNot = (file, marker, label) => { if (read(file).includes(marker)) failures.push(`${file}: ${label}`); };

for (const file of [
  'lib/templates/workspace/template-workspace-navigation.ts',
  'components/templates/workspace/TemplateRoundOnlyLibrary.tsx',
  'components/templates/workspace/TemplateStudioHub.tsx',
  'components/templates/workspace/TemplateWorkflowFrameworkPanel.tsx',
  'components/templates/workspace/TemplateRegistrationConsole.tsx',
  'lib/templates/workspace/template-workflow-framework.ts',
  'lib/templates/intelligence/dynamic-template-inspector.ts',
  'lib/supplemental-template-renderer.ts',
  'lib/final-pdf-packet.ts',
  'components/LetterGeneratorWorkspace.tsx',
  'components/OutputReviewWorkspace.tsx',
  'components/TemplateProgressiveWorkspace.tsx',
  'components/TemplatePacketConfigurator.tsx',
  'components/templates/workspace/TemplateTestLabHub.tsx',
  'lib/templates/workspace/template-test-lab-service.ts',
  'app/api/template-registration/route.ts',
  'app/api/template-assets/route.ts',
  'app/api/template-assets/download/route.ts',
  'app/manager-template-test-lab.css',
  'app/template-workflow-framework.css',
  'app/layout.tsx',
  'app/manager-workspace/studio/page.tsx',
  'app/manager-workspace/test/page.tsx'
]) read(file);

must('lib/templates/workspace/template-workspace-navigation.ts', 'Template Test Lab', 'navigation must include Test Lab');
must('lib/templates/workspace/template-workspace-navigation.ts', 'TEMPLATE_WORKSPACE_NAV_ITEMS.length !== 4', 'navigation must enforce 4 hubs');
must('app/manager-workspace/test/page.tsx', 'TemplateTestLabHub', 'test route must render hub');
must('app/manager-workspace/test/page.tsx', "dynamic = 'force-dynamic'", 'test route must be dynamic');
must('app/layout.tsx', "import './manager-template-test-lab.css';", 'layout must import test CSS');
must('app/layout.tsx', "import './template-workflow-framework.css';", 'layout must import workflow CSS');
must('components/TemplateProgressiveWorkspace.tsx', "type Stage = 'ROUND' | 'PACKET' | 'EDITOR'", 'shared workflow stages missing');
must('components/TemplatePacketConfigurator.tsx', 'manager-template-direct-actions', 'manager actions missing');
must('components/templates/workspace/TemplateRoundOnlyLibrary.tsx', "import TemplateProgressiveWorkspace from '../../TemplateProgressiveWorkspace'", 'manager library must use shared workflow');
must('components/templates/workspace/TemplateRoundOnlyLibrary.tsx', 'data-template-library-minimal="progressive-upload"', 'manager library must be progressive upload');
mustNot('components/templates/workspace/TemplateRoundOnlyLibrary.tsx', 'data-template-library-minimal="round-only"', 'old round-only marker returned');
must('components/templates/workspace/TemplateStudioHub.tsx', 'TemplateWorkflowFrameworkPanel', 'Template Studio must show workflow framework panel');
must('app/manager-workspace/studio/page.tsx', 'buildTemplateWorkflowFramework', 'Studio page must build universal framework');
must('lib/templates/workspace/template-workflow-framework.ts', 'Account Name - Account number', 'framework must include account in-place default');
must('lib/templates/workspace/template-workflow-framework.ts', 'Replace this wording in the same paragraph or table cell', 'framework must prevent wrong-location rendering');
must('components/templates/workspace/TemplateRegistrationConsole.tsx', 'name="inPlaceAnchor"', 'registration UI must allow anchor customization');
must('components/templates/workspace/TemplateRegistrationConsole.tsx', 'name="renderPolicy"', 'registration UI must allow render policy customization');
must('components/templates/workspace/TemplateRegistrationConsole.tsx', 'name="preservationPolicy"', 'registration UI must allow preservation policy customization');
must('app/api/template-registration/route.ts', 'workflowPolicy', 'registration API must persist workflow policy');
must('app/api/template-registration/route.ts', 'workflowAnchorPolicy', 'registration API must persist anchor policy');
must('lib/templates/intelligence/dynamic-template-inspector.ts', 'natural-anchor-account-name-account-number', 'inspector must detect account in-place anchors');
must('lib/templates/intelligence/dynamic-template-inspector.ts', 'do not append or increment', 'inspector must explain wrong-location prevention');
must('lib/supplemental-template-renderer.ts', 'normalizeAffidavit', 'affidavit renderer must normalize account anchors');
must('lib/supplemental-template-renderer.ts', 'Affidavit account anchors mapped in-place', 'affidavit renderer must report in-place mapping');
must('lib/supplemental-template-renderer.ts', 'accountLinesForAffidavit', 'affidavit renderer must use source account lines');
must('lib/final-pdf-packet.ts', 'mergePdfBlobs', 'final PDF helper must merge PDFs');
must('components/LetterGeneratorWorkspace.tsx', '_FINAL_MERGED_PACKET.pdf', 'letter workspace must produce one merged PDF');
must('components/OutputReviewWorkspace.tsx', 'Generate merged PDF', 'review stage must generate merged PDF');
must('components/OutputReviewWorkspace.tsx', 'Download merged PDF', 'review stage must download merged PDF');
must('lib/templates/workspace/template-test-lab-service.ts', 'buildTemplateTestLabContext', 'test service missing');
must('lib/templates/workspace/template-test-lab-service.ts', 'previewGenerationPlan', 'preview plan missing');
must('components/templates/workspace/TemplateTestLabHub.tsx', 'template-test-side-panel', 'side panel missing');
must('components/templates/workspace/TemplateTestLabHub.tsx', 'Generated output preview', 'preview panel missing');
must('components/templates/workspace/TemplateTestLabHub.tsx', 'Active template downloads', 'active file links missing');
must('app/api/template-assets/download/route.ts', 'downloadManagerTemplateObject', 'file reader missing');
must('app/api/template-assets/download/route.ts', 'scope.managerUserId', 'scope check missing');
must('app/manager-template-test-lab.css', '.template-test-side-panel', 'side panel CSS missing');
must('app/template-workflow-framework.css', '.template-workflow-framework-panel', 'workflow framework CSS missing');
must('app/api/template-assets/route.ts', 'request.formData()', 'template API upload parser missing');

if (failures.length) {
  console.error(`Template workspace contract guard failed: ${failures.length} issue(s).`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Template workspace contract guard passed.');
