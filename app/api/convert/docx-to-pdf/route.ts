import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 45_000;

function executableCandidates() {
  return [process.env.LIBREOFFICE_PATH, 'soffice', 'libreoffice', 'soffice.bin'].filter(Boolean) as string[];
}

function safeFileName(value: string) {
  return (value || 'document.docx').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'document.docx';
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

async function convertWithLibreOffice(inputPath: string, outDir: string, profileDir: string) {
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
    if (result.ok) return;
    errors.push(`${command}: ${result.stderr || result.stdout || 'conversion failed'}`);
  }

  throw new Error(errors.join('\n'));
}

export async function POST(request: NextRequest) {
  let workDir = '';
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'DOCX file is required.' }, { status: 400 });
    }

    workDir = await mkdtemp(join(tmpdir(), 'xdisputer-docx-pdf-'));
    const outDir = join(workDir, 'out');
    const profileDir = join(workDir, 'profile');
    const name = safeFileName(file.name).replace(/\.docx$/i, '') || 'document';
    const inputPath = join(workDir, `${name}.docx`);
    const outputPath = join(outDir, `${name}.pdf`);

    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    await mkdtemp(outDir);
    await mkdtemp(profileDir);
    await convertWithLibreOffice(inputPath, outDir, profileDir);

    const pdf = await readFile(outputPath);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store, max-age=0',
        'X-Conversion-Engine': 'libreoffice-headless'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'DOCX to PDF conversion failed.' }, { status: 501 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
