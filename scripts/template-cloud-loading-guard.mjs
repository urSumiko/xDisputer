import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

const checks = [
  {
    file: 'lib/ordered-packet-archive.ts',
    needles: ['fetchManagerTemplateFile', 'readLatestPacketExhibit', 'active manager template library']
  },
  {
    file: 'lib/manager-template-file-resolver.ts',
    needles: ["cache: 'no-store'", "params.set('sync'", 'fetchManagerTemplateFile']
  },
  {
    file: 'app/api/template-assets/file/route.ts',
    needles: ['Cache-Control', 'no-store, no-cache', 'createSupabaseAdminClient']
  },
  {
    file: 'lib/template-exhibits.ts',
    needles: ['readCloudExhibit', "source: 'SUPABASE_TEMPLATE_ASSET'", 'readTemplateExhibit']
  }
];

const failures = [];
for (const check of checks) {
  const text = read(check.file);
  for (const needle of check.needles) {
    if (!text.includes(needle)) failures.push(`${check.file} missing ${needle}`);
  }
}

if (failures.length) {
  console.error('[template-cloud-loading-guard] Failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[template-cloud-loading-guard] OK - manager cloud templates are loaded before browser-local fallback.');
