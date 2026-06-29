#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };
const mustNot = (source, text, label) => { if (source.includes(text)) failures.push(label); };
const mustNotMatch = (source, pattern, label) => { if (pattern.test(source)) failures.push(label); };

const admin = read('app/admin/page.tsx');
const outputActivityPage = read('app/admin/output-activity-v2/page.tsx');
const panels = read('lib/manager-console/manager-operations-panels.ts');
const css = read('app/manager-console-workflow.css');
const layout = read('app/layout.tsx');
const consoleShellBundle = read('app/root-css-console-shell.css');
const payrollRoute = read('app/api/manager-console/payroll/route.ts');
const settings = read('lib/saas/manager-user-settings.ts');
const accountRoute = read('app/api/account/profile/route.ts');
const accountRevalidation = read('src/features/account-profile/account-profile-revalidation.ts');
const accountMenu = read('components/console/AccountMenu.tsx');
const metadataEditor = read('components/manager/ManagerPayrollSettingsEditor.tsx');
const payrollModalCss = read('app/manager-payroll-modal.css');

for (const label of ['Monitoring', 'Access control of user', 'Report', 'Output Activity', 'Request']) {
  must(panels, label, `manager panel missing: ${label}`);
}

for (const marker of ['MonitoringPanel', 'AccessPanel', 'ReportPanel', 'OutputActivityPanel', 'RequestsPanel']) {
  must(admin, marker, `manager console section missing: ${marker}`);
}

must(panels, "'output_activity'", 'manager panel id must use output_activity');
must(panels, "panel === 'payroll'", 'legacy payroll query alias must stay backward compatible');
must(admin, "activePanel === 'output_activity'", 'manager page must render Output Activity by output_activity id');
mustNot(admin, 'function PayrollPanel', 'manager page must not expose PayrollPanel UI owner');
mustNot(admin, "activePanel === 'payroll'", 'manager page must not render payroll panel id directly');
must(admin, 'intent="clear_manager"', 'manager access must expose unlink action');
must(admin, 'intent="suspend"', 'manager access must expose pause action');
must(admin, 'ManagerPayrollSettingsEditor', 'manager Access Control page must keep the metadata option');
must(admin, 'initialEmploymentType={employmentTypeFor(setting)}', 'manager Access Control metadata must receive employment type');
must(admin, 'initialPerOutputRate={setting?.per_output_rate || setting?.rate || 0}', 'manager Access Control metadata must receive output rate');
must(admin, 'payrollAmount', 'manager output activity must compute from settings and output count');
must(settings, 'manager_user_settings', 'manager user settings helper missing table contract');
must(payrollRoute, 'manager_user_settings', 'payroll route must save manager metadata');
must(css, 'manager-console-kpi-grid', 'manager console CSS missing KPI layout');

must(admin, '<ManagerConsoleRealtimeRefreshMount />', 'manager page must use the single manager realtime refresh owner');
mustNot(admin, 'AutoRouteRefresh', 'manager page must not mount AutoRouteRefresh with ManagerConsoleRealtimeRefreshMount');

if (!layout.includes("import './manager-console-workflow.css';") && !consoleShellBundle.includes("@import './manager-console-workflow.css';")) {
  failures.push('root layout must load manager console workflow CSS');
}

must(accountRoute, 'account_settings_name', 'account profile route must carry saved display name for immediate UI refresh');

const revalidatesClientWorkspace = accountRoute.includes("revalidatePath('/workspace')") || (
  accountRoute.includes('revalidateAccountProfileRoutes(next)') && accountRevalidation.includes("'/workspace'")
);
if (!revalidatesClientWorkspace) failures.push('account profile route must revalidate client workspace');

const revalidatesManagerConsole = accountRoute.includes("revalidatePath('/admin')") || (
  accountRoute.includes('revalidateAccountProfileRoutes(next)') && accountRevalidation.includes("'/admin'")
);
if (!revalidatesManagerConsole) failures.push('account profile route must revalidate manager console');

must(accountMenu, 'displayNameFromUrl', 'account menu must read saved display name from redirect state');
must(accountMenu, 'setLocalDisplayName(savedName)', 'account menu must update display name immediately');

must(metadataEditor, "import { createPortal } from 'react-dom';", 'manager metadata modal must use a viewport portal');
must(metadataEditor, 'createPortal(modal, document.body)', 'manager metadata modal must mount to document.body');
must(metadataEditor, 'role="dialog"', 'manager metadata modal must expose dialog semantics');
must(metadataEditor, 'aria-modal="true"', 'manager metadata modal must be modal for assistive technology');
must(metadataEditor, 'manager-user-settings-card-trigger-only', 'manager metadata editor must keep card-click behavior without visible tile');
must(metadataEditor, "const METADATA_CARD_SELECTOR = '.manager-console-user-card';", 'manager metadata opener must be scoped to Access Control cards');
mustNot(metadataEditor, '.output-activity-row[data-metadata-profile-id]', 'manager metadata opener must not target Output Activity tiles');
mustNot(metadataEditor, '.output-activity-title-actions', 'manager metadata click blocker must not need Output Activity action exceptions');
must(metadataEditor, 'CARD_CLICK_BLOCKERS', 'manager metadata editor must keep a scoped blocker list');
must(metadataEditor, 'shouldIgnoreCardOpen(event.target, card)', 'manager metadata card click must compare against the current card');
must(metadataEditor, 'nestedButtonRole && nestedButtonRole !== card', 'manager metadata card must not block itself when role="button" is applied');
mustNot(outputActivityPage, 'ManagerPayrollSettingsEditor', 'output activity rows must not mount the metadata opener');
mustNot(outputActivityPage, 'data-metadata-profile-id', 'output activity rows must not expose metadata click hook');
mustNot(metadataEditor, 'metadata-tile-copy', 'manager metadata editor must not render the retired visible metadata tile copy');
mustNot(metadataEditor, 'metadata-tile-plus', 'manager metadata editor must not render the retired visible metadata plus button');
must(payrollModalCss, '--manager-payroll-modal-contract: portal-card-click-no-visible-tile;', 'manager metadata CSS contract must document no-visible-tile portal behavior');
must(payrollModalCss, '.manager-user-settings-modal-backdrop', 'manager metadata CSS must own the backdrop');
must(payrollModalCss, 'position: fixed !important;', 'manager metadata backdrop must stay viewport-fixed');
mustNotMatch(payrollModalCss, /\.manager-metadata-card-trigger:hover\s*{[^}]*transform\s*:/s, 'manager metadata card hover must not transform the fixed-modal ancestor');

if (failures.length) {
  console.error(`manager-console-workflow-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('manager-console-workflow-guard: ok');
