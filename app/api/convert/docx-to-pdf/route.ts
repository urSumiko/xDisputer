import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 45_000;
const EXTERNAL_CONVERTER_TIMEOUT_MS = 55_000;
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const PAGE_MARGIN_X = 54;
const PAGE_MARGIN_TOP = 58;
const PAGE_MARGIN_BOTTOM = 56;
const BODY_FONT_SIZE = 10.5;
const BODY_LINE_HEIGHT = 15;
const TITLE_FONT_SIZE = 11;
const TITLE_LINE_HEIGHT = 18;

type ConversionResult = { ok: true; engine: string } | { ok: false; error: Error };
type ExternalConversionResult = { ok: true; bytes: Uint8Array; engine: string } | { ok: false; error: Error };
type TextToken = { text: string; bold: boolean; italic: boolean };
type Paragraph = { tokens: TextToken[]; text: string };
type PdfFonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

function executableCandidates() {
  return [process.env.LIBREOFFICE_PATH, 'soffice', 'libreoffice', 'soffice.bin'].filter(Boolean) as string[];
}

function safeFileName(value: string) {
  return (value || 'document.docx').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'document.docx';
}

function bodyBuffer(bytes: Uint8Array): ArrayBuffer {
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return body.buffer;
}

function pdfBytesLookValid(bytes: Uint8Array) {
  return bytes.byteLength > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function externalConverterUrl() {
  const raw = process.env.DOCX_CONVERTER_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === '/') url.pathname = '/convert';
    return url.toString();
  } catch {
    return raw;
  }
}

async function convertWithExternalService(file: File, fileBuffer: ArrayBuffer): Promise<ExternalConversionResult> {
  const url = externalConverterUrl();
  if (!url) return { ok: false, error: new Error('DOCX_CONVERTER_URL is not configured.') };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_CONVERTER_TIMEOUT_MS);
  try {
    const formData = new FormData();
    formData.set('file', new File([fileBuffer], safeFileName(file.name), { type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const token = process.env.DOCX_CONVERTER_TOKEN?.trim();
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
      signal: controller.signal,
      headers: token ? { authorization: `Bearer ${token}` } : undefined
    });
    const engine = response.headers.get('x-conversion-engine') || new URL(url).hostname || 'external-libreoffice';
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, error: new Error(`External converter failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 400)}` : ''}`) };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!pdfBytesLookValid(bytes)) return { ok: false, error: new Error('External converter returned a non-PDF response.') };
    return { ok: true, bytes, engine };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? `External converter timed out after ${Math.round(EXTERNAL_CONVERTER_TIMEOUT_MS / 1000)} seconds.`
      : error instanceof Error ? error.message : 'External converter request failed.';
    return { ok: false, error: new Error(message) };
  } finally {
    clearTimeout(timeout);
  }
}

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, stdout, stderr: `${stderr}\nTimed out after ${Math.round(TIMEOUT_MS / 1000)} seconds.` });
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

async function convertWithLibreOffice(inputPath: string, outDir: string, profileDir: string): Promise<ConversionResult> {
  const args = [
    '--headless',
    '--nologo',
    '--nofirststartwizard',
    '--norestore',
    `-env:UserInstallation=file://${profileDir}`,
    '--convert-to',
    'pdf:writer_pdf_Export',
    '--outdir',
    outDir,
    inputPath
  ];

  const errors: string[] = [];
  for (const command of executableCandidates()) {
    const result = await run(command, args, outDir);
    if (result.ok) return { ok: true, engine: command };
    errors.push(`${command}: ${result.stderr || result.stdout || 'conversion failed'}`);
  }

  return { ok: false, error: new Error(errors.join('\n')) };
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function textFromRun(runXml: string): TextToken | null {
  const bold = /<w:b(?:\s|\/|>)/.test(runXml) || /<w:bCs(?:\s|\/|>)/.test(runXml);
  const italic = /<w:i(?:\s|\/|>)/.test(runXml) || /<w:iCs(?:\s|\/|>)/.test(runXml);
  const parts: string[] = [];
  const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\s*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = textPattern.exec(runXml))) {
    const token = match[0];
    if (token.startsWith('<w:tab')) parts.push('    ');
    else if (token.startsWith('<w:br') || token.startsWith('<w:cr')) parts.push('\n');
    else parts.push(decodeXml(match[1] || ''));
  }
  const text = parts.join('');
  return text ? { text, bold, italic } : null;
}

function extractParagraphs(documentXml: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch: RegExpExecArray | null;
  while ((paragraphMatch = paragraphPattern.exec(documentXml))) {
    const paragraphXml = paragraphMatch[1] || '';
    const tokens: TextToken[] = [];
    const runPattern = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
    let runMatch: RegExpExecArray | null;
    while ((runMatch = runPattern.exec(paragraphXml))) {
      const token = textFromRun(runMatch[1] || '');
      if (token) tokens.push(token);
    }
    const text = tokens.map((token) => token.text).join('').replace(/[ \t]+/g, ' ').trim();
    if (text) paragraphs.push({ tokens, text });
    else if (paragraphs.length && paragraphs[paragraphs.length - 1].text) paragraphs.push({ tokens: [], text: '' });
  }
  return paragraphs;
}

async function loadDocumentParagraphs(fileBuffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(fileBuffer);
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) throw new Error('DOCX document.xml could not be read.');
  const paragraphs = extractParagraphs(documentXml);
  if (!paragraphs.length) throw new Error('DOCX text content could not be extracted.');
  return paragraphs;
}

function pickFont(fonts: PdfFonts, token?: Pick<TextToken, 'bold' | 'italic'>) {
  if (token?.bold && token?.italic) return fonts.boldItalic;
  if (token?.bold) return fonts.bold;
  if (token?.italic) return fonts.italic;
  return fonts.regular;
}

function splitWordByWidth(word: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const parts: string[] = [];
  let current = '';
  for (const character of word) {
    const next = current + character;
    if (current && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const rawWord of words) {
      const wordParts = font.widthOfTextAtSize(rawWord, fontSize) > maxWidth ? splitWordByWidth(rawWord, font, fontSize, maxWidth) : [rawWord];
      for (const word of wordParts) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function renderDocxTextFallback(fileBuffer: ArrayBuffer, filename: string) {
  const paragraphs = await loadDocumentParagraphs(fileBuffer);
  const document = await PDFDocument.create();
  const fonts: PdfFonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    italic: await document.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await document.embedFont(StandardFonts.HelveticaBoldOblique)
  };
  const usableWidth = LETTER_WIDTH - PAGE_MARGIN_X * 2;
  let page = document.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  let y = LETTER_HEIGHT - PAGE_MARGIN_TOP;

  const newPage = () => {
    page = document.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
    y = LETTER_HEIGHT - PAGE_MARGIN_TOP;
  };
  const ensureSpace = (height: number) => {
    if (y - height < PAGE_MARGIN_BOTTOM) newPage();
  };

  const title = safeFileName(filename).replace(/\.docx$/i, '');
  ensureSpace(TITLE_LINE_HEIGHT * 2);
  page.drawText(title, { x: PAGE_MARGIN_X, y, size: TITLE_FONT_SIZE, font: fonts.bold, color: rgb(0.08, 0.11, 0.18) });
  y -= TITLE_LINE_HEIGHT;
  page.drawLine({ start: { x: PAGE_MARGIN_X, y }, end: { x: LETTER_WIDTH - PAGE_MARGIN_X, y }, thickness: 0.5, color: rgb(0.83, 0.87, 0.92) });
  y -= BODY_LINE_HEIGHT;

  for (const paragraph of paragraphs) {
    const firstToken = paragraph.tokens.find((token) => token.text.trim());
    const font = pickFont(fonts, firstToken);
    if (!paragraph.text) {
      y -= BODY_LINE_HEIGHT * 0.35;
      continue;
    }
    const lines = wrapText(paragraph.text, font, BODY_FONT_SIZE, usableWidth);
    ensureSpace(lines.length * BODY_LINE_HEIGHT + 5);
    for (const line of lines) {
      page.drawText(line, { x: PAGE_MARGIN_X, y, size: BODY_FONT_SIZE, font, color: rgb(0.06, 0.09, 0.16) });
      y -= BODY_LINE_HEIGHT;
    }
    y -= 3;
  }

  return await document.save();
}

function noStorePdf(bytes: Uint8Array, engine: string) {
  return new NextResponse(bodyBuffer(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Conversion-Engine': engine
    }
  });
}

export async function POST(request: NextRequest) {
  let workDir = '';
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'DOCX file is required.' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const externalResult = await convertWithExternalService(file, fileBuffer);
    if (externalResult.ok) return noStorePdf(externalResult.bytes, `external-libreoffice:${externalResult.engine}`);

    workDir = await mkdtemp(join(tmpdir(), 'xdisputer-docx-pdf-'));
    const outDir = join(workDir, 'out');
    const profileDir = join(workDir, 'profile');
    const name = safeFileName(file.name).replace(/\.docx$/i, '') || 'document';
    const inputPath = join(workDir, `${name}.docx`);
    const outputPath = join(outDir, `${name}.pdf`);

    await mkdir(outDir, { recursive: true });
    await mkdir(profileDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(fileBuffer));
    const libreOfficeResult = await convertWithLibreOffice(inputPath, outDir, profileDir);
    if (libreOfficeResult.ok) {
      const pdf = await readFile(outputPath);
      return noStorePdf(new Uint8Array(pdf), `libreoffice-headless:${libreOfficeResult.engine}`);
    }

    const fallbackPdf = await renderDocxTextFallback(fileBuffer, file.name);
    return noStorePdf(fallbackPdf, 'docx-text-pdf-fallback');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'DOCX to PDF conversion failed.' }, { status: 501 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
