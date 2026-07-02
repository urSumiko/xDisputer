import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_TIMEOUT_MS = 45_000;
const EXTERNAL_TIMEOUT_MS = 75_000;

type LocalConversionResult = { ok: true; engine: string } | { ok: false; error: Error };
type ExternalConversionResult = { ok: true; bytes: Uint8Array; engine: string } | { ok: false; status: number; error: Error };

function safeFileName(value: string) {
  return (value || 'document.docx').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'document.docx';
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  return output.buffer;
}

function pdfBytesLookValid(bytes: Uint8Array) {
  return bytes.byteLength > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function noStorePdf(bytes: Uint8Array, engine: string) {
  return new NextResponse(responseBody(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Conversion-Engine': engine
    }
  });
}

function jsonError(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function localCandidates() {
  return [process.env.LIBREOFFICE_PATH, 'soffice', 'libreoffice', 'soffice.bin'].filter(Boolean) as string[];
}

function converterUrl() {
  const raw = (process.env.DOCX_CONVERTER_URL || process.env.DOCX_CONVERTER_URI || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === '/') url.pathname = '/convert';
    return url.toString();
  } catch {
    return raw;
  }
}

function healthUrl(url: string) {
  try {
    const value = new URL(url);
    value.pathname = '/health';
    value.search = '';
    return value.toString();
  } catch {
    return url.replace(/\/?convert\/?$/i, '/health');
  }
}

function authHeaders() {
  const token = process.env.DOCX_CONVERTER_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function convertWithExternalService(file: File, fileBuffer: ArrayBuffer, url: string): Promise<ExternalConversionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
  try {
    const formData = new FormData();
    formData.set('file', new File([fileBuffer], safeFileName(file.name), { type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const response = await fetch(url, { method: 'POST', body: formData, cache: 'no-store', signal: controller.signal, headers: authHeaders() });
    const engine = response.headers.get('x-conversion-engine') || 'external-libreoffice';
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: new Error(`External LibreOffice converter failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ''}`) };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!pdfBytesLookValid(bytes)) return { ok: false, status: 502, error: new Error('External LibreOffice converter returned a non-PDF response.') };
    return { ok: true, bytes, engine };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? `External LibreOffice converter timed out after ${Math.round(EXTERNAL_TIMEOUT_MS / 1000)} seconds. Open ${healthUrl(url)} once, then try again.`
      : error instanceof Error ? error.message : 'External LibreOffice converter request failed.';
    return { ok: false, status: 502, error: new Error(message) };
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
      resolve({ ok: false, stdout, stderr: `${stderr}\nTimed out after ${Math.round(LOCAL_TIMEOUT_MS / 1000)} seconds.` });
    }, LOCAL_TIMEOUT_MS);
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

async function convertWithLocalLibreOffice(inputPath: string, outDir: string, profileDir: string): Promise<LocalConversionResult> {
  const args = ['--headless', '--nologo', '--nofirststartwizard', '--norestore', `-env:UserInstallation=file://${profileDir}`, '--convert-to', 'pdf:writer_pdf_Export', '--outdir', outDir, inputPath];
  const errors: string[] = [];
  for (const command of localCandidates()) {
    const result = await run(command, args, outDir);
    if (result.ok) return { ok: true, engine: command };
    errors.push(`${command}: ${result.stderr || result.stdout || 'conversion failed'}`);
  }
  return { ok: false, error: new Error(errors.join('\n')) };
}

export async function GET() {
  const url = converterUrl();
  if (!url) return NextResponse.json({ ok: false, externalConverterConfigured: false, expectedEnv: 'DOCX_CONVERTER_URL' }, { status: 200 });
  const health = healthUrl(url);
  try {
    const response = await fetch(health, { cache: 'no-store', headers: authHeaders() });
    const text = await response.text().catch(() => '');
    return NextResponse.json({ ok: response.ok, externalConverterConfigured: true, healthUrl: health, status: response.status, body: text.slice(0, 500) });
  } catch (error) {
    return NextResponse.json({ ok: false, externalConverterConfigured: true, healthUrl: health, error: error instanceof Error ? error.message : 'Health check failed.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  let workDir = '';
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return jsonError({ error: 'DOCX file is required.' }, 400);

    const fileBuffer = await file.arrayBuffer();
    const externalUrl = converterUrl();
    if (externalUrl) {
      const external = await convertWithExternalService(file, fileBuffer, externalUrl);
      if (external.ok) return noStorePdf(external.bytes, `external-libreoffice:${external.engine}`);
      return jsonError({ error: external.error.message, category: 'external_libreoffice_converter', converterUrl: externalUrl, nextStep: 'Check the converter /health URL, DOCX_CONVERTER_URL, and DOCX_CONVERTER_TOKEN, then redeploy Vercel.' }, external.status);
    }

    workDir = await mkdtemp(join(tmpdir(), 'xdisputer-docx-pdf-'));
    const outDir = join(workDir, 'out');
    const profileDir = join(workDir, 'profile');
    const name = safeFileName(file.name).replace(/\.docx$/i, '') || 'document';
    const inputPath = join(workDir, `${name}.docx`);
    const outputPath = join(outDir, `${name}.pdf`);

    await mkdir(outDir, { recursive: true });
    await mkdir(profileDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(fileBuffer));
    const local = await convertWithLocalLibreOffice(inputPath, outDir, profileDir);
    if (!local.ok) return jsonError({ error: local.error.message, category: 'local_libreoffice_missing', nextStep: 'Configure DOCX_CONVERTER_URL for Vercel production.' }, 501);
    const pdf = await readFile(outputPath);
    return noStorePdf(new Uint8Array(pdf), `libreoffice-headless:${local.engine}`);
  } catch (error) {
    return jsonError({ error: error instanceof Error ? error.message : 'DOCX to PDF conversion failed.' }, 501);
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
