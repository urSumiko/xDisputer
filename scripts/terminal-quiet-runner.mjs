#!/usr/bin/env node
import { spawn } from 'node:child_process';

const mode = process.argv[2] || 'verify';

function hrtimeSeconds(start) {
  return Number(process.hrtime.bigint() - start) / 1_000_000_000;
}

function tailLines(text, maxLines = 80) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-maxLines)
    .join('\n');
}

function summarize(label, output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const interesting = lines.filter((line) => {
    return (
      /^Findings:\s+\d+/i.test(line) ||
      /passed/i.test(line) ||
      /guard: ok/i.test(line) ||
      /Compiled successfully/i.test(line) ||
      /Finished TypeScript/i.test(line) ||
      /Collecting page data/i.test(line) ||
      /Generating static pages/i.test(line) ||
      /Finalizing page optimization/i.test(line) ||
      /Ready in /i.test(line)
    );
  });

  if (!interesting.length) return `${label} complete`;
  return `${label} · ${interesting.slice(-4).join(' · ')}`;
}

function runStep(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      const elapsed = hrtimeSeconds(started).toFixed(1);
      const combined = [stdout, stderr].filter(Boolean).join('\n');
      if (code === 0) {
        console.log(`✓ ${summarize(label, combined)} (${elapsed}s)`);
        resolve();
        return;
      }

      console.error(`✗ ${label} failed (${elapsed}s)`);
      const tail = tailLines(combined);
      if (tail) console.error(tail);
      reject(new Error(`${label} failed`));
    });
  });
}

async function main() {
  if (mode === 'verify') {
    await runStep('next:reset', 'npm', ['run', 'next:reset']);
    await runStep('build', 'npm', ['run', 'build']);
    console.log('✓ verify complete');
    return;
  }

  if (mode === 'guard') {
    await runStep('ui-source:guard', 'npm', ['run', 'ui-source:guard']);
    await runStep('typecheck', 'npm', ['run', 'typecheck']);
    console.log('✓ guard complete');
    return;
  }

  if (mode === 'dev') {
    await runStep('next:reset', 'npm', ['run', 'next:reset']);
    await runStep('build', 'npm', ['run', 'build']);
    console.log('▶ starting local dev server on port 3000');
    const dev = spawn('npm', ['run', 'codespace:dev'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3000' },
      stdio: 'inherit',
      shell: false
    });
    dev.on('close', (code) => process.exit(code ?? 0));
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
