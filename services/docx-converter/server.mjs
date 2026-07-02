import express from 'express';
import multer from 'multer';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const app = express();
const PORT = Number(process.env.PORT || 8080);
const TIMEOUT_MS = Number(process.env.CONVERTER_TIMEOUT_MS || 60_000);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024);
const TOKEN = process.env.CONVERTER_TOKEN?.trim() || '';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function executableCandidates() {
  return [process.env.LIBREOFFICE_PATH, '/usr/bin/soffice', 'soffice', 'libreoffice', 'soffice.bin'].filter(Boolean);
}

function safeFileName(value = 'document.docx') {
  return String(value || 'document.docx').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'document.docx';
}

function auth(req, res, next) {
  if (!TOKEN) return next();
  const header = String(req.headers.authorization || '');
  if (header !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'Unauthorized converter request.' });
  return next();
}

function run(command, args, cwd) {
  return new Promise((resolve) => {
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

async function convertWithLibreOffice(inputPath, outDir, profileDir) {
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
  const errors = [];
  for (const command of executableCandidates()) {
    const result = await run(command, args, outDir);
    if (result.ok) return { ok: true, command };
    errors.push(`${command}: ${result.stderr || result.stdout || 'conversion failed'}`);
  }
  return { ok: false, error: errors.join('\n') };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'xdisputer-docx-converter', engine: 'libreoffice' });
});

app.post('/convert', auth, upload.single('file'), async (req, res) => {
  let workDir = '';
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'DOCX file is required.' });
    const originalName = safeFileName(req.file.originalname || 'document.docx');
    const baseName = originalName.replace(/\.docx$/i, '') || 'document';
    workDir = await mkdtemp(join(tmpdir(), 'xdisputer-convert-'));
    const outDir = join(workDir, 'out');
    const profileDir = join(workDir, 'profile');
    const inputPath = join(workDir, `${baseName}.docx`);
    const outputPath = join(outDir, `${baseName}.pdf`);
    await mkdir(outDir, { recursive: true });
    await mkdir(profileDir, { recursive: true });
    await writeFile(inputPath, req.file.buffer);
    const conversion = await convertWithLibreOffice(inputPath, outDir, profileDir);
    if (!conversion.ok) return res.status(500).json({ error: conversion.error || 'LibreOffice conversion failed.' });
    const pdf = await readFile(outputPath);
    res.status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store, max-age=0',
        'X-Conversion-Engine': `libreoffice-service:${conversion.command}`,
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`
      })
      .send(pdf);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'DOCX conversion failed.' });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `DOCX file is larger than ${MAX_UPLOAD_BYTES} bytes.` });
  return res.status(500).json({ error: error instanceof Error ? error.message : 'Converter service failed.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`xDisputer DOCX converter listening on ${PORT}`);
});
