#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function writeIfChanged(path, before, after) {
  if (before === after) {
    console.log(`Manager template storage wiring already present: ${path}`);
    return;
  }

  writeFileSync(path, after);
  console.log(`Applied manager template storage wiring: ${path}`);
}

function ensureImport(source, anchor, importLine) {
  if (source.includes(importLine)) return source;
  return source.replace(anchor, `${anchor}\n${importLine}`);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function normalizeTemplateAssetRouteImports(source) {
  const staleImport = "import { downloadManagerTemplateObject, managerTemplateStorageMode, removeManagerTemplateObjects, uploadManagerTemplateObject } from '../../../lib/supabase/template-storage-service';";
  const serverMutationImport = "import { managerTemplateStorageMode, removeManagerTemplateObjects, uploadManagerTemplateObject } from '../../../lib/supabase/template-storage-service';";
  const scopeImport = "import { assertCanManageManagerTemplates, managerTemplateScopePayload, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../lib/manager-template-scope';";

  source = source.replaceAll(`${staleImport}\n`, '');
  source = source.replaceAll(`\n${staleImport}`, '');
  source = source.replaceAll(`${serverMutationImport}\n`, '');
  source = source.replaceAll(`\n${serverMutationImport}`, '');

  if (!source.includes(serverMutationImport)) {
    if (!source.includes(scopeImport)) throw new Error('Missing manager template scope import anchor in app/api/template-assets/route.ts');
    source = source.replace(scopeImport, `${scopeImport}\n${serverMutationImport}`);
  }

  if (count(source, 'managerTemplateStorageMode') < 1) throw new Error('managerTemplateStorageMode import or usage is missing.');
  const importBlock = source.slice(0, source.indexOf('const allowedRounds'));
  if (count(importBlock, 'managerTemplateStorageMode') !== 1) throw new Error('Duplicate managerTemplateStorageMode import detected in route header.');
  if (importBlock.includes('downloadManagerTemplateObject')) throw new Error('Stale downloadManagerTemplateObject import detected in template-assets route.');

  return source;
}

function normalizeTemplateStoragePayload(source) {
  const duplicateGet = "managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode() }, dynamicTemplateEngineV2: { rendererMode, autoBackfilled: autoBackfill.backfilledCount, warnings: autoBackfill.warnings }, templateStorage: { mode: managerTemplateStorageMode() }";
  const canonicalGet = "managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode() }, dynamicTemplateEngineV2: { rendererMode, autoBackfilled: autoBackfill.backfilledCount, warnings: autoBackfill.warnings }";
  source = source.replaceAll(duplicateGet, canonicalGet);

  source = source.replace(
    "managerTemplateScope: managerTemplateScopePayload(scope), dynamicTemplateEngineV2",
    "managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode() }, dynamicTemplateEngineV2"
  );

  source = source.replaceAll(duplicateGet, canonicalGet);
  return source;
}

function patchTemplateAssetsRoute() {
  const path = 'app/api/template-assets/route.ts';
  if (!existsSync(path)) return;

  const before = readFileSync(path, 'utf8');
  let source = before;

  source = normalizeTemplateAssetRouteImports(source);

  source = source.replace(
    /session\.supabase\.storage\.from\('template-assets'\)\.upload\(storagePath, new Blob\(\[fileBuffer\], \{ type: file\.type \|\| 'application\/octet-stream' \}\), \{ contentType: file\.type \|\| 'application\/octet-stream', upsert: false \}\)/g,
    "uploadManagerTemplateObject({ sessionSupabase: session.supabase, bucket: 'template-assets', path: storagePath, body: new Blob([fileBuffer], { type: file.type || 'application/octet-stream' }), contentType: file.type || 'application/octet-stream', upsert: false })"
  );

  source = source.replace(
    /session\.supabase\.storage\.from\('template-assets'\)\.remove\(\[storagePath\]\)/g,
    "removeManagerTemplateObjects({ sessionSupabase: session.supabase, bucket: 'template-assets', paths: [storagePath] })"
  );

  source = source.replace(
    /session\.supabase\.storage\.from\(bucket\)\.remove\(paths\)/g,
    "removeManagerTemplateObjects({ sessionSupabase: session.supabase, bucket, paths })"
  );

  source = normalizeTemplateStoragePayload(source);

  source = source.replace(
    /managerTemplateScope: managerTemplateScopePayload\(scope\), validation: contract\.validation/g,
    "managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode() }, validation: contract.validation"
  );

  source = source.replace(
    /managerTemplateScope: managerTemplateScopePayload\(scope\) \}\);/g,
    "managerTemplateScope: managerTemplateScopePayload(scope), templateStorage: { mode: managerTemplateStorageMode() } });"
  );

  source = normalizeTemplateStoragePayload(source);
  source = normalizeTemplateAssetRouteImports(source);

  writeIfChanged(path, before, source);
}

function patchTemplateFileRoute() {
  const path = 'app/api/template-assets/file/route.ts';
  if (!existsSync(path)) return;

  const before = readFileSync(path, 'utf8');
  let source = before;

  source = ensureImport(
    source,
    "import { managerTemplateScopePayload, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../../lib/manager-template-scope';",
    "import { downloadManagerTemplateObject } from '../../../../lib/supabase/template-storage-service';"
  );

  source = source.replace(
    "function privateTemplateCacheHeaders(input: { etag: string; filename: string; mimeType: string | null; managerUserId: string }) {",
    "function privateTemplateCacheHeaders(input: { etag: string; filename: string; mimeType: string | null; managerUserId: string }): Record<string, string> {"
  );

  source = source.replace(
    /const download = await session\.supabase\.storage\.from\(asset\.storage_bucket\)\.download\(asset\.storage_path\);\n  if \(download\.error\) return NextResponse\.json\(\{ error: download\.error\.message \}, \{ status: 500 \}\);\n\n  return new Response\(download\.data, \{ headers \}\);/g,
    "const download = await downloadManagerTemplateObject({ sessionSupabase: session.supabase, bucket: asset.storage_bucket || 'template-assets', path: asset.storage_path });\n  if (download.error || !download.data) return NextResponse.json({ error: download.error?.message || 'Template file could not be loaded.', category: 'MANAGER_TEMPLATE' }, { status: 500 });\n  headers['x-template-storage-mode'] = download.mode;\n\n  return new Response(download.data, { headers });"
  );

  writeIfChanged(path, before, source);
}

patchTemplateAssetsRoute();
patchTemplateFileRoute();
