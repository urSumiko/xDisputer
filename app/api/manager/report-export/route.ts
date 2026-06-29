import JSZip from 'jszip';
import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '../../../../lib/saas/session';
import { formatReportDate, formatReportDateRange, listManagerReportData, moneyText, parseManagerReportInput, type ManagerReportData } from '../../../../lib/manager-console/manager-reporting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CellStyle = 'text' | 'header' | 'money' | 'totalPay' | 'title' | 'muted';
type CellValue = string | number | null | undefined;
type SheetRow = Array<{ value: CellValue; style?: CellStyle }>;
type SheetSpec = { name: string; rows: SheetRow[]; widths?: number[] };

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
  const style = styleId(cell.style);
  const styleAttr = style ? ` s="${style}"` : '';
  const value = cell.value;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"${styleAttr}><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${styleAttr}><is><t>${escapeXml(value ?? '')}</t></is></c>`;
}

function sheetXml(sheet: SheetSpec) {
  const widthXml = sheet.widths?.length ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
  const rowXml = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${widthXml}<sheetData>${rowXml}</sheetData></worksheet>`;
}

function workbookXml(sheets: SheetSpec[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
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

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFF0000"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1"/></cellXfs></styleSheet>`;
}

function cell(value: CellValue, style: CellStyle = 'text') { return { value, style }; }
function header(values: string[]): SheetRow { return values.map((value) => cell(value, 'header')); }

function buildSheets(report: ManagerReportData, managerEmail: string): SheetSpec[] {
  const summaryRows: SheetRow[] = [
    [cell('xDisputer Manager Report', 'title')],
    [cell(`Manager: ${managerEmail}`, 'muted')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Metric', 'Value']),
    [cell('Report type'), cell(report.input.type === 'salary_outputs' ? 'Salary' : report.input.type)],
    [cell('Date range'), cell(formatReportDateRange(report.input.range))],
    [cell('Disputers'), cell(report.totals.userCount)],
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
    header(['Date', 'Disputer', 'Letter client', 'Round', 'Status', 'Output type', 'Count', 'Rate', 'Pay']),
    ...report.outputs.map((item) => [cell(formatReportDate(item.createdAt)), cell(item.disputerName), cell(item.clientName), cell(item.roundLabel), cell(item.status), cell(item.outputType), cell(item.outputCount), cell(moneyText(item.rateAmount), 'money'), cell(moneyText(item.estimatedPay), 'money')])
  ];

  const userRows: SheetRow[] = [
    [cell('Users', 'title')],
    [cell(`Range: ${formatReportDateRange(report.input.range)}`, 'muted')],
    [],
    header(['Disputer', 'Email', 'Status', 'Type', 'Daily cap', 'Outputs', 'Approved', 'Pending', 'Returned', 'Estimated pay']),
    ...report.users.map((item) => [cell(item.name), cell(item.email), cell(item.status), cell(item.employmentType), cell(item.outputLimit ?? 'Needs Master cap'), cell(item.outputs), cell(item.approvedOutputs), cell(item.pendingOutputs), cell(item.returnedOutputs), cell(moneyText(item.estimatedPay), 'totalPay')])
  ];

  if (report.input.type === 'users') return [{ name: 'Summary', rows: summaryRows, widths: [24, 34] }, { name: 'Users', rows: userRows, widths: [24, 32, 16, 16, 18, 12, 12, 12, 12, 16] }];
  return [{ name: 'Summary', rows: summaryRows, widths: [24, 34] }, { name: 'Salary', rows: salaryRows, widths: [24, 32, 16, 18, 16, 14, 18, 18, 18, 16, 16] }, { name: 'Output Detail', rows: outputRows, widths: [18, 22, 26, 16, 16, 18, 10, 14, 14] }];
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
  sheets.forEach((sheet, index) => worksheetFolder?.file(`sheet${index + 1}.xml`, sheetXml(sheet)));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function GET(request: NextRequest) {
  const { user, profile, supabase } = await requireRole('manager');
  const params = request.nextUrl.searchParams;
  const input = parseManagerReportInput({ reportType: params.get('reportType') || undefined, from: params.get('from') || undefined, to: params.get('to') || undefined });
  const report = await listManagerReportData(supabase, user.id, input);
  const workbook = await createWorkbook(report, profile?.email || user.email || 'Manager');
  const filename = `xdisputer-${input.type === 'salary_outputs' ? 'salary' : input.type}-report-${input.range.fromDate}-to-${input.range.toDate}.xlsx`;
  return new NextResponse(workbook, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}
