import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'lib/repository-contract-map.ts',
  'lib/supabase/db-rpc-contract.ts',
  'lib/template-execution/render-proof-gate.ts',
  'lib/pdf-conversion-policy.ts',
  'lib/manager-console/boss-reporting-contract.ts'
];

const result = files.map((file) => {
  const path = resolve(process.cwd(), file);
  const text = readFileSync(path, 'utf8');
  return { file, lines: text.split('\n').length, bytes: Buffer.byteLength(text, 'utf8') };
});

console.log(JSON.stringify({ ok: true, generatedAt: new Date().toISOString(), files: result }, null, 2));
