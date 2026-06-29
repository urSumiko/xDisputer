import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const workspacePath = path.join(ROOT, 'components/LetterGeneratorWorkspaceV2.tsx');
const manifestPath = path.join(ROOT, 'lib/generation-manifest.ts');

function readRequired(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${path.relative(ROOT, filePath)}: ${message}`);
  }
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

const workspace = readRequired(workspacePath);
const manifest = readRequired(manifestPath);

const checks = [
  {
    name: 'RegistryTemplateAsset carries validation_json metadata',
    ok: workspace.includes('validation_json?: Record<string, unknown> | null;')
  },
  {
    name: 'RegistryTemplateAsset carries content_hash metadata',
    ok: workspace.includes('content_hash?: string | null;')
  },
  {
    name: 'RegistryTemplateAsset carries version_number metadata',
    ok: workspace.includes('version_number?: number | null;')
  },
  {
    name: 'Letter Supabase/manager assets hydrate manifest asset IDs',
    ok: /function\s+managerLetterReference[\s\S]*assetId:\s*asset\.id/.test(workspace)
  },
  {
    name: 'Letter Supabase/manager assets hydrate manifest versions',
    ok: /function\s+managerLetterReference[\s\S]*versionNumber:\s*asset\.version_number\s*\|\|\s*null/.test(workspace)
  },
  {
    name: 'Letter Supabase/manager assets hydrate manifest content hashes',
    ok: /function\s+managerLetterReference[\s\S]*contentHash:\s*asset\.content_hash\s*\|\|\s*null/.test(workspace)
  },
  {
    name: 'Letter Supabase/manager assets hydrate manifest validation JSON',
    ok: /function\s+managerLetterReference[\s\S]*validationJson:\s*asset\.validation_json\s*\|\|\s*null/.test(workspace)
  },
  {
    name: 'Exhibit Supabase/manager assets hydrate manifest asset IDs',
    ok: /function\s+managerExhibitAsset[\s\S]*assetId:\s*asset\.id/.test(workspace)
  },
  {
    name: 'Exhibit Supabase/manager assets hydrate manifest versions',
    ok: /function\s+managerExhibitAsset[\s\S]*versionNumber:\s*asset\.version_number\s*\|\|\s*null/.test(workspace)
  },
  {
    name: 'Exhibit Supabase/manager assets hydrate manifest content hashes',
    ok: /function\s+managerExhibitAsset[\s\S]*contentHash:\s*asset\.content_hash\s*\|\|\s*null/.test(workspace)
  },
  {
    name: 'Exhibit Supabase/manager assets hydrate manifest validation JSON',
    ok: /function\s+managerExhibitAsset[\s\S]*validationJson:\s*asset\.validation_json\s*\|\|\s*null/.test(workspace)
  },
  {
    name: 'Generation manifests use effective references and templates in both browser calls',
    ok: countOccurrences(workspace, 'buildGenerationManifest({ round, parsed, routes, references: effectiveRefs, templates: effectiveTemplates,') >= 2
  },
  {
    name: 'Template asset fetch bypasses stale cache',
    ok: workspace.includes("cache: 'no-store'") && workspace.includes("'cache-control': 'no-store'")
  },
  {
    name: 'Generation manifest accepts Supabase and manager provenance sources',
    ok: manifest.includes("'SUPABASE_TEMPLATE_ASSET'") && manifest.includes("'MANAGER_TEMPLATE_ASSET'")
  },
  {
    name: 'Generation manifest defaults asset-backed templates to Supabase provenance',
    ok: manifest.includes("carrier.assetId ? 'SUPABASE_TEMPLATE_ASSET' : 'LOCAL_BROWSER'")
  },
  {
    name: 'Generation manifest counts manager-scoped template provenance',
    ok: manifest.includes("template.source === 'MANAGER_TEMPLATE_ASSET'") && manifest.includes("template.templateScope === 'MANAGER_TEMPLATE_ASSET'")
  }
];

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error('Template provenance workspace guard failed:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Template provenance workspace guard passed (${checks.length} checks).`);
