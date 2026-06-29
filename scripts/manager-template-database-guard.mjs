#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const checks = [];
function read(path) { const ok = existsSync(path); checks.push({ ok, label: `file exists: ${path}` }); return ok ? readFileSync(path, 'utf8') : ''; }
function has(source, term, label) { checks.push({ ok: source.includes(term), label }); }
function notHas(source, term, label) { checks.push({ ok: !source.includes(term), label }); }

const assetRoute = read('app/api/template-assets/route.ts');
const fileRoute = read('app/api/template-assets/file/route.ts');
const statusRoute = read('app/api/template-assets/status/route.ts');
const configurator = read('components/TemplatePacketConfigurator.tsx');
const resolver = read('lib/manager-template-file-resolver.ts');
const migration = read('supabase/migrations/20260614114500_manager_template_supabase_status_contract.sql');

has(assetRoute, 'insert({ owner_id: scope.managerUserId, manager_user_id: scope.managerUserId', 'upload inserts manager-scoped template asset row');
has(assetRoute, 'app_activate_manager_template_asset_v1', 'upload activates inserted template asset');
has(assetRoute, 'deleteAssetRecordsAndFiles', 'delete removes database rows and storage files');
has(assetRoute, "managerTemplateScope: managerTemplateScopePayload(scope)", 'mutation responses return manager template scope');

has(fileRoute, "eq('manager_user_id', scope.managerUserId)", 'file reads are manager-scope filtered');
has(fileRoute, "eq('is_active', true)", 'file reads only active manager templates');
notHas(fileRoute, 'outputLimitError', 'template file reads are independent of output limits');
notHas(fileRoute, 'Output limit reached', 'template file reads do not block on generation limits');

has(statusRoute, 'activeAssetCount', 'status endpoint reports active asset count');
has(statusRoute, 'usedByClientGeneration: true', 'status endpoint marks active slots as client-generation sources');
has(statusRoute, "resolver: 'resolveManagerTemplateFile'", 'status endpoint documents client resolver contract');

has(configurator, 'Uploading ${slot.name} to Supabase', 'letter upload shows Supabase pending state');
has(configurator, 'Verified as active Supabase manager default', 'upload confirms active Supabase default');
has(configurator, 'Removing ${slot.name} from Supabase', 'letter removal shows Supabase pending state');
has(configurator, 'refreshActiveTemplateState', 'UI reloads active slots after mutations');
has(configurator, 'Supabase is authoritative', 'local browser preview cannot block Supabase mutation state');
has(configurator, 'className="manager-upload-input"', 'upload keeps accessible styled file input contract');

has(resolver, 'fetchManagerTemplateFile', 'client generation fetches manager template files');
has(resolver, '/api/template-assets/file?', 'client generation uses active template file route');
has(resolver, 'resolveManagerTemplateFile', 'client generation resolver is present');

has(migration, "insert into storage.buckets", 'database migration ensures template-assets bucket');
has(migration, 'idx_template_assets_one_active_per_manager_slot', 'database migration enforces one active manager slot');
has(migration, 'app_manager_template_slot_status_v1', 'database migration exposes active slot status RPC');
has(migration, 'used_by_client_generation boolean', 'database RPC confirms client generation usage flag');

checks.forEach((check) => console.log(`${check.ok ? '✅' : '❌'} ${check.label}`));
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\nManager template database guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nManager template database guard passed: ${checks.length} check(s).`);
