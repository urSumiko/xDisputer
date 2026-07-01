import JSZip from 'jszip';
import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '../../../../lib/saas/session';
import { formatReportDate, formatReportDateRange, listManagerReportData, moneyText, parseManagerReportInput, type ManagerReportData, type ManagerReportType } from '../../../../lib/manager-console/manager-reporting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CellStyle = 'text' | 'header' | 'money' | 'totalPay' | 'title' | 'muted';
type CellValue = string | number | null | undefined;
type SheetRole = ManagerReportType | 'output_detail';
type SheetRow = Array<{ value: CellValue; style?: CellStyle }>;
type SheetSpec = { name: string; role: SheetRole; rows: SheetRow[]; widths?: number[] };

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function outputPay(totalPay: number, baseSalary: number) {
  return Math.max(0, totalPay - baseSalary);
}

function reportTypeName(report: ManagerReportData) {
  if (report.input.type === 'salary_outputs') return 'Salary';
  if (report.input.type === 'users') return 'Users';
  if (report.input.type === 'per_boss') return 'Per Boss';
  return 'Summary';
}

function filenameDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function downloadFilename(report: ManagerReportData) {
  const raw = `${reportTypeName(report)} ${filenameDate(report.input.range.fromDate)} to ${filenameDate(report.input.range.toDate)}.xlsx`;
  return raw.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

function styleId(style?: CellStyle) {
  if (style === 'header') return 1;
  if (style === 'money') return 2;
  if (style === 'totalPay') return 3;
  if (style === 'title') return 4;
  if (style === 'muted') return 5;
  return 0;
}

function columnName(index: number) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }
  return name;
}

function cellXml(cell: SheetRow[number], rowIndex: number, columnIndex: number) {
  const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
  const styleAttr = ` s="${styleId(cell.style)}"`;
  const value = cell.value;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"${styleAttr}><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${styleAttr}><is><t>${escapeXml(value ?? '')}</t></is></c>`;
}

function sheetDimension(sheet: SheetSpec) {
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  return `A1:${columnName(maxColumns - 1)}${maxRows}`;
}

function sheetXml(sheet: SheetSpec, active = false) {
  const widthXml = sheet.widths?.length ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
  const rowXml = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${sheetDimension(sheet)}"/><sheetViews><sheetView workbookViewId="0" showGridLines="1"${active ? ' tabSelected="1"' : ''}/></sheetViews><sheetFormatPr defaultRowHeight="18"/>${widthXml}<sheetData>${rowXml}</sheetData></worksheet>`;
}

function workbookXml(sheets: SheetSpec[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0" firstSheet="0"/></bookViews><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
}

function workbookRelsXml(sheets: SheetSpec[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheets: SheetSpec[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function xf(fontId: number, fillId: number, borderId: number, horizontal = 'left', extra = '') {
  return `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${extra}><alignment horizontal="${horizontal}" vertical="center" wrapText="1"/></xf>`;
}

function stylesXml() {
  const visibleTableBorder = '<border><left style="thin"><color rgb="FF111827"/></left><right style="thin"><color rgb="FF111827"/></right><top style="thin"><color rgb="FF111827"/></top><bottom style="thin"><color rgb="FF111827"/></bottom><diagonal/></border>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFB91C1C"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${visibleTableBorder}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment horizontal="left" vertical="center" wrapText="1"/></xf></cellStyleXfs><cellXfs count="6"><!-- totalPay fontId="3" -->${xf(0, 0, 1)}${xf(1, 2, 1, 'center')} ${xf(2, 0, 1, 'center')}${xf(3, 0, 1, 'center')}${xf(4, 0, 0, 'left')}${xf(0, 0, 0, 'left')}</cellXfs></styleSheet>`;
}

function cell(value: CellValue, style: CellStyle = 'text') { return { value, style }; }
function header(values: string[]): SheetRow { return values.map((value) => cell(value, 'header')); }

function sheetForRole(sheets: SheetSpec[], role: SheetRole) {
  return sheets.find((sheet) => sheet.role === role);
}

function selectedFirst(sheets: SheetSpec[], selected: ManagerReportType) {
  const selectedSheet = sheetForRole(sheets, selected);
  if (!selectedSheet) return sheets;
  return [selectedSheet, ...sheets.filter((sheet) => sheet !== selectedSheet)];
}

function buildSheets(report: ManagerReportData, managerEmail: string): SheetSpec[] {
  const summaryRows: SheetRow[] = [
    [cell('xDisputer Manager Report', 'title')],
    [cell(`Manager: ${managerEmail}`, 'muted')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Metric', 'Value']),
    [cell('Report type'), cell(reportTypeName(report))],
    [cell('Date range'), cell(formatReportDateRange(report.input.range))],
    [cell('Disputers'), cell(report.totals.userCount)],
    [cell('Bosses'), cell(report.bosses.length)],
    [cell('Active Disputers'), cell(report.totals.activeUsers)],
    [cell('Output items'), cell(report.totals.totalOutputItems)],
    [cell('Approved rows'), cell(report.totals.approvedRows)],
    [cell('Pending rows'), cell(report.totals.pendingRows)],
    [cell('Returned rows'), cell(report.totals.returnedRows)],
    [cell('Estimated pay'), cell(moneyText(report.totals.estimatedPayTotal), 'totalPay')]
  ];

  const salaryRows: SheetRow[] = [
    [cell('Salary', 'title')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Disputer', 'Email', 'Type', 'Daily cap', 'Base salary', 'Rate', 'Approved outputs', 'Pending outputs', 'Returned outputs', 'Output pay', 'Total pay']),
    ...report.users.map((item) => [
      cell(item.name), cell(item.email), cell(item.employmentType), cell(item.outputLimit ?? 'Needs Master cap'), cell(moneyText(item.baseSalary), 'money'), cell(moneyText(item.perOutputRate), 'money'), cell(item.approvedOutputs), cell(item.pendingOutputs), cell(item.returnedOutputs), cell(moneyText(outputPay(item.estimatedPay, item.baseSalary)), 'money'), cell(moneyText(item.estimatedPay), 'totalPay')
    ])
  ];

  const outputRows: SheetRow[] = [
    [cell('Output Detail', 'title')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Date', 'Boss', 'Disputer', 'Letter client', 'Round', 'Status', 'Output type', 'Count', 'Rate', 'Pay']),
    ...report.outputs.map((item) => [cell(formatReportDate(item.createdAt)), cell(item.bossName), cell(item.disputerName), cell(item.clientName), cell(item.roundLabel), cell(item.status), cell(item.outputType), cell(item.outputCount), cell(moneyText(item.rateAmount), 'money'), cell(moneyText(item.estimatedPay), 'money')])
  ];

  const userRows: SheetRow[] = [
    [cell('Users', 'title')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Disputer', 'Email', 'Status', 'Type', 'Daily cap', 'Outputs', 'Approved', 'Pending', 'Returned', 'Estimated pay']),
    ...report.users.map((item) => [cell(item.name), cell(item.email), cell(item.status), cell(item.employmentType), cell(item.outputLimit ?? 'Needs Master cap'), cell(item.outputs), cell(item.approvedOutputs), cell(item.pendingOutputs), cell(item.returnedOutputs), cell(moneyText(item.estimatedPay), 'totalPay')])
  ];

  const bossRows: SheetRow[] = [
    [cell('Per Boss', 'title')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Boss', 'Disputers', 'Output rows', 'Output items', 'Approved outputs', 'Pending outputs', 'Returned outputs', 'Full-time rows', 'Output pay', 'Total pay']),
    ...report.bosses.map((item) => [cell(item.bossName), cell(item.disputerCount), cell(item.outputRows), cell(item.outputItems), cell(item.approvedOutputs), cell(item.pendingOutputs), cell(item.returnedOutputs), cell(item.fulltimeRows), cell(moneyText(item.outputPay), 'money'), cell(moneyText(item.totalPay), 'totalPay')])
  ];

  const summary: SheetSpec = { name: 'Summary', role: 'summary', rows: summaryRows, widths: [24, 34] };
  const salary: SheetSpec = { name: 'Salary', role: 'salary_outputs', rows: salaryRows, widths: [24, 32, 16, 18, 16, 14, 18, 18, 18, 16, 16] };
  const users: SheetSpec = { name: 'Users', role: 'users', rows: userRows, widths: [24, 32, 16, 16, 18, 12, 12, 12, 12, 16] };
  const perBoss: SheetSpec = { name: 'Per Boss', role: 'per_boss', rows: bossRows, widths: [26, 14, 14, 14, 18, 18, 18, 16, 16, 16] };
  const outputDetail: SheetSpec = { name: 'Output Detail', role: 'output_detail', rows: outputRows, widths: [18, 22, 22, 26, 16, 16, 18, 10, 14, 14] };

  if (report.input.type === 'users') return selectedFirst([users, summary], report.input.type);
  if (report.input.type === 'per_boss') return selectedFirst([perBoss, summary, outputDetail], report.input.type);
  if (report.input.type === 'salary_outputs') return selectedFirst([salary, summary, outputDetail], report.input.type);
  return selectedFirst([summary, salary, outputDetail], report.input.type);
}

async function createWorkbook(report: ManagerReportData, managerEmail: string) {
  const sheets = buildSheets(report, managerEmail);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml(sheets));
  zip.folder('_rels')?.file('.rels', rootRelsXml());
  zip.folder('xl')?.file('workbook.xml', workbookXml(sheets));
  zip.folder('xl')?.file('styles.xml', stylesXml());
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', workbookRelsXml(sheets));
  const worksheetFolder = zip.folder('xl')?.folder('worksheets');
  sheets.forEach((sheet, index) => worksheetFolder?.file(`sheet${index + 1}.xml`, sheetXml(sheet, index === 0)));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function GET(request: NextRequest) {
  const { user, profile, supabase } = await requireRole('manager');
  const params = request.nextUrl.searchParams;
  const input = parseManagerReportInput({ reportType: params.get('reportType') || undefined, from: params.get('from') || undefined, to: params.get('to') || undefined });
  const report = await listManagerReportData(supabase, user.id, input);
  const workbook = await createWorkbook(report, profile?.email || user.email || 'Manager');
  const filename = downloadFilename(report);
  const dispositionFilename = filename.replace(/"/g, '');
  return new NextResponse(workbook, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${dispositionFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}
