#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };

const page = read('app/admin/page.tsx');
const service = read('lib/manager-console/manager-reporting.ts');
const controls = read('components/manager/ManagerReportControls.tsx');
const exportRoute = read('app/api/manager/report-export/route.ts');
const css = read('app/manager-report-workflow.css');
const layout = read('app/layout.tsx');
const pkg = read('package.json');

must(pkg, 'manager-report-workflow-guard.mjs', 'manager-console guard must include report workflow guard');
must(page, 'ManagerReportControls', 'manager report page must use auto-submit controls');
must(page, 'salary_outputs', 'manager report page must use merged salary data contract');
must(page, "return 'Salary';", 'manager report page must label merged salary/output report as Salary');
must(page, 'formatReportDateRange', 'manager report page must display Month day, year date range');
must(page, 'reportTypeLabel(type)', 'manager report page must label selected report type');
mustNot(page, 'Generate report', 'manager report page must not require manual Generate button');
mustNot(page, 'value="salary"', 'manager report page must not expose separate Salary type');
mustNot(page, 'value="outputs"', 'manager report page must not expose separate Outputs type');
must(service, "export type ManagerReportType = 'summary' | 'salary_outputs' | 'users'", 'report service must merge salary and outputs');
must(service, 'const PH_OFFSET_MS = 8 * 60 * 60 * 1000', 'report service must use PH time calculations');
must(service, 'mondayDelta', 'report service must default weekly range to Monday PH time');
must(service, 'formatReportDateRange', 'report service must expose Month day, year range formatting');
must(controls, "'use client';", 'report controls must be client-owned for instant changes');
must(controls, 'currentPhWeekRange', 'report controls must reset date range to PH Monday week on report-type changes');
must(controls, 'requestSubmit()', 'report controls must auto-submit without a Generate button');
must(controls, '<option value="salary_outputs">Salary</option>', 'report controls must label merged report as Salary');
must(controls, 'manager-report-export-button', 'report controls must place export button in the control row');
must(exportRoute, "import JSZip from 'jszip';", 'report export must create a real xlsx zip package');
must(exportRoute, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'report export must use xlsx content type');
must(exportRoute, '.xlsx`', 'report export filename must use .xlsx extension');
mustNot(exportRoute, 'application/vnd.ms-excel', 'report export must not use legacy HTML xls content type');
mustNot(exportRoute, '.xls`', 'report export must not use mismatched xls extension');
must(exportRoute, "name: 'Salary'", 'report export must name merged salary sheet Salary');
must(exportRoute, "name: 'Output Detail'", 'report export must move output detail to a separate sheet');
must(exportRoute, "cell(moneyText(item.estimatedPay), 'totalPay')", 'report export must highlight Total pay with red text style');
must(exportRoute, 'fontId="3"', 'report export style must include red font for total pay');
must(exportRoute, 'formatReportDate(item.createdAt)', 'report export dates must use Month day, year format');
must(css, '--manager-report-workflow-contract: monday-ph-auto-submit-merged-salary-output-export;', 'report CSS must document merged report workflow');
must(layout, "import './manager-report-workflow.css';", 'root layout must load manager report CSS');

if (failures.length) {
  console.error(`manager-report-workflow-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('manager-report-workflow-guard: ok');
