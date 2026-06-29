#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const checks = [];

function file(path) {
  const ok = existsSync(path);
  checks.push({ ok, label: `file exists: ${path}` });
  return ok ? readFileSync(path, 'utf8') : '';
}

function has(content, needle, label) {
  checks.push({ ok: content.includes(needle), label });
}

if (existsSync('scripts/apply-manager-template-storage-wiring.mjs')) {
  execSync('node scripts/apply-manager-template-storage-wiring.mjs', { stdio: 'inherit' });
  execSync('node scripts/apply-manager-template-storage-wiring.mjs', { stdio: 'inherit' });
}

const scope = file('lib/manager-template-scope.ts');
const registry = file('lib/supabase/template-registry.ts');
const storage = file('lib/supabase/template-storage-service.ts');
const migration = file('supabase/migrations/20260614101000_manager_template_scope.sql');
const uploadRoute = file('app/api/template-assets/route.ts');
const fileRoute = file('app/api/template-assets/file/route.ts');
const manifestRoute = file('app/api/template-assets/manifest/route.ts');
const safety = file('scripts/phase14-local-safety-check.mjs');

['resolveManagerTemplateScope', 'ASSIGNED_MANAGER', 'MANAGER_SELF', 'CLIENT_TEMPLATE_UPLOAD_DISABLED', 'assertCanManageManagerTemplates'].forEach((term) => has(scope, term, `scope helper includes ${term}`));
['managerUserId', 'manager/', 'templateStoragePath', 'listActiveTemplateAssets'].forEach((term) => has(registry, term, `registry includes ${term}`));
['createSupabaseAdminClient', 'downloadManagerTemplateObject', 'uploadManagerTemplateObject', 'removeManagerTemplateObjects', 'managerTemplateStorageMode'].forEach((term) => has(storage, ` ${term}`.trim(), `storage adapter includes ${term}`));
['manager_client_assignments', 'manager_user_id', 'uploaded_by_user_id', 'template_scope', 'app_resolve_template_manager_v1', 'app_activate_manager_template_asset_v1', 'idx_template_assets_one_active_per_manager_slot'].forEach((term) => has(migration, term, `migration includes ${term}`));

['resolveManagerTemplateScope', 'assertCanManageManagerTemplates', 'app_activate_manager_template_asset_v1', 'managerTemplateScopePayload', 'manager_user_id', 'uploaded_by_user_id', 'template_scope', 'uploadManagerTemplateObject', 'downloadManagerTemplateObject', 'removeManagerTemplateObjects', 'managerTemplateStorageMode'].forEach((term) => has(uploadRoute, term, `template asset route enforces ${term}`));
['resolveManagerTemplateScope', 'managerTemplateScopePayload', 'MANAGER_TEMPLATE', 'manager_user_id', 'MANAGER_TEMPLATE_ASSET', 'downloadManagerTemplateObject', 'x-template-storage-mode'].forEach((term) => has(fileRoute, term, `template file route enforces ${term}`));
['resolveManagerTemplateScope', 'managerTemplateScopePayload', 'manager_user_id', 'MANAGER_TEMPLATE_ASSET', 'managerUserId'].forEach((term) => has(manifestRoute, term, `template manifest route reports ${term}`));
has(safety, 'apply-manager-template-storage-wiring', 'local checks apply manager template storage wiring');

const failed = checks.filter((check) => !check.ok);
checks.forEach((check) => console.log(`${check.ok ? '✅' : '❌'} ${check.label}`));

if (failed.length) {
  console.error(`\nManager template scope guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nManager template scope guard passed: ${checks.length} check(s).`);
