import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`Missing ${path}`), '');
const has = (path, text, message) => { if (!read(path).includes(text)) failures.push(message); };
const not = (path, text, message) => { if (read(path).includes(text)) failures.push(message); };

has('package.json', '"master-ui-workspace:guard"', 'package.json must keep retired master workspace guard wired');
has('components/console/ConsoleShell.tsx', 'resolvedSwitchTarget', 'ConsoleShell must own switch target resolution');
has('components/console/ConsoleShell.tsx', 'return fallback', 'ConsoleShell must not override master switch target to a retired workspace route');
has('components/console/ConsoleShell.tsx', 'Master governance console', 'ConsoleShell must use non-workspace master switch copy');
not('components/console/ConsoleShell.tsx', "return '/master/ui-workspace'", 'master operations switch must not target retired UI workspace');
not('components/console/ConsoleShell.tsx', 'Switch to UI workspace', 'master switch card must not advertise UI workspace');
not('components/console/ConsoleShell.tsx', 'Master Console ⇄ UI Workspace', 'master shell must not expose UI workspace contract copy');
not('components/console/ConsoleShell.tsx', 'data-master-console-ui-workspace=', 'master shell must not expose UI workspace data marker');

has('app/master/ui-workspace/page.tsx', "redirect('/master')", 'retired master UI workspace route must redirect to /master');
has('app/master/ui-workspace/page.tsx', "requireRole('master')", 'retired master UI workspace route must remain role-gated before redirect');
has('app/master/workspaces/page.tsx', "redirect('/master/accounts')", 'retired master workspaces route must redirect to /master/accounts');
has('app/master/workspaces/page.tsx', "requireRole('master')", 'retired master workspaces route must remain role-gated before redirect');

not('app/master/MasterConsoleHome.tsx', "'/master/ui-workspace'", 'master home navigation must not include UI workspace');
not('app/master/MasterConsoleHome.tsx', "'/master/workspaces'", 'master home navigation must not include Workspaces');
not('app/master/MasterConsoleHome.tsx', 'UI workspace', 'master home copy must not mention UI workspace');
not('app/master/MasterConsoleHome.tsx', 'Workspaces', 'master home nav must not mention Workspaces');
not('app/master/accounts/page.tsx', "'/master/ui-workspace'", 'master accounts navigation must not include UI workspace');
not('app/master/accounts/page.tsx', "'/master/workspaces'", 'master accounts page must not link to Workspaces');
not('app/master/accounts/page.tsx', 'UI workspace', 'master accounts copy must not mention UI workspace');
not('app/master/accounts/page.tsx', 'Workspaces', 'master accounts copy must not mention Workspaces');

has('app/master/accounts/page.tsx', 'Limit saved', 'master accounts page must show entitlement save feedback');
has('app/master/accounts/page.tsx', 'controlStatus', 'master accounts page must read control status from entitlement redirects');
has('app/master/MasterAccountTableV2.tsx', 'Needs Master limit', 'master account table must show missing manager limits as needing Master setup');
has('app/master/MasterAccountTableV2.tsx', 'function canEditLimits(account: ManagedAccount) { return isManager(account); }', 'only manager rows can expose Master limit editing');
has('app/master/MasterAccountTableV2.tsx', 'savedManagerLimits', 'master account table must centralize saved manager limit display');
has('app/master/MasterAccountTableV2.tsx', 'Saved limits:', 'manager flyout must show saved manager limit snapshot');
has('app/master/MasterAccountTableV2.tsx', 'return account.manager_id ? \'Boss assigned\' : \'Needs boss assignment\'', 'client rows must show boss assignment instead of output limit controls');
has('app/master/MasterAccountTableV2.tsx', 'required defaultValue={saved.maxClients', 'manager Disputer limit input must be required and read back from entitlements');
has('app/master/MasterAccountTableV2.tsx', 'required defaultValue={saved.defaultOutput', 'manager default output input must be required and read back from entitlements');
has('app/master/MasterAccountTableV2.tsx', "if (!isManager(account)) return null;", 'client daily output override form must be removed');
not('app/master/MasterAccountTableV2.tsx', 'Daily output override', 'client Daily output override UI must not exist');
not('app/master/MasterAccountTableV2.tsx', 'Daily agreement limits', 'manager flyout must not show duplicate Daily agreement limits meter');
not('app/master/MasterAccountTableV2.tsx', 'flyoutMeter', 'manager flyout must not render duplicate limit meter');
not('app/master/MasterAccountTableV2.tsx', 'unlimited', 'master account table must not advertise unlimited limits');
has('app/master-account-directory-polish.css', 'grid-template-areas:', 'master account rows must use named grid areas to prevent overlap');
has('app/master-account-directory-polish.css', 'grid-area: invite', 'master account row invite chip must have a dedicated area');
has('app/master-account-directory-polish.css', 'grid-area: updated', 'master account row updated chip must have a dedicated area');
has('app/api/master/entitlements/route.ts', 'mode !== \'manager\'', 'master entitlement route must reject client output override mode');
has('app/api/master/entitlements/route.ts', 'parsePositiveLimit(cleanValue(formData, \'maxClients\')', 'master entitlement route must require manager Disputer limit');
has('app/api/master/entitlements/route.ts', 'parsePositiveLimit(cleanValue(formData, \'defaultClientOutputLimit\')', 'master entitlement route must require manager output limit');
not('app/api/master/entitlements/route.ts', 'parseOptionalOverrideLimit', 'master entitlement route must not keep client override parser');
not('app/api/master/entitlements/route.ts', 'access_set_client_entitlement_v1', 'master entitlement route must not write Disputer override limits');
has('app/api/master/entitlements/route.ts', "revalidatePath('/workspace')", 'master entitlement route must revalidate Disputer workspace');
has('app/api/master/entitlements/route.ts', 'entitlementsSyncedAt', 'master entitlement redirect must force a fresh URL state');
has('lib/saas/entitlement-limits.ts', 'function numericValue(value: unknown)', 'entitlement reader must normalize numeric strings for saved value readback');
has('lib/saas/entitlement-limits.ts', 'readManagerLimitTableRows', 'entitlement reader must use direct manager table fallback for saved limit readback');
has('lib/saas/entitlement-limits.ts', 'access_list_entitlement_limits_v1', 'entitlement reader must merge legacy entitlement RPC fallback');
has('lib/saas/entitlement-limits.ts', 'const effectiveLimit = positiveOrNull(row.effective_output_limit)', 'entitlement reader must expose missing caps as not configured');
has('components/manager/ManagerConsoleRealtimeRefreshMount.tsx', "table: 'manager_entitlement_limits'", 'manager console must refresh when master updates manager entitlement limits');
has('components/ClientOutputLimitBoundary.tsx', 'managerId?: string | null', 'Disputer entitlement payload must carry manager id for master cap realtime sync');
has('components/ClientOutputLimitBoundary.tsx', 'managerDefaultOutputLimit', 'Disputer pause screen must expose Master manager output cap');
has('components/ClientOutputLimitBoundary.tsx', 'Master manager limit', 'Disputer pause screen must show the Master manager limit panel');
has('components/ClientOutputLimitBoundary.tsx', "table: 'manager_entitlement_limits'", 'Disputer workspace must refresh when master updates manager output cap');
has('app/api/client/output-entitlement/route.ts', 'managerDefaultOutputLimit', 'Disputer entitlement API must return the Master manager default output cap');
has('app/api/client/output-entitlement/route.ts', 'managerDisputerLimit', 'Disputer entitlement API must return the Master manager Disputer seat cap');
has('app/api/client/output-entitlement/route.ts', "source: managerDefaultLimit !== null ? 'master-manager-limit'", 'Disputer entitlement API must prefer manager limit source');
has('app/api/generation-runs/route.ts', 'requireGenerationAllowance', 'generation save route must strictly check allowance before insert');
has('app/api/generation-runs/route.ts', 'access_assert_client_can_generate_v1', 'generation save route must prefer strict allowance RPC');
has('app/api/generation-runs/route.ts', 'Output allowance SQL is not synced. Generation is blocked', 'generation save route must block when allowance SQL is missing');
has('app/api/generation-runs/route.ts', 'entitlement.outputLimit === null', 'generation save route must block missing Master manager output cap');
has('src/features/manager-console/admin-page-presenters.ts', 'Manager cap not set', 'manager UI must not show Default when master cap is missing');
has('supabase/migrations/20260624123000_master_authority_required_limits.sql', 'access_positive_limit_required_v1', 'latest entitlement migration must require positive manager limits');
has('supabase/migrations/20260624123000_master_authority_required_limits.sql', 'Master must set this manager daily output limit', 'latest entitlement migration must block Disputer generation when master cap is missing');
has('supabase/migrations/20260624123000_master_authority_required_limits.sql', 'Master must set this manager Disputer limit', 'latest entitlement migration must block manager assignments when master seat limit is missing');
has('supabase/migrations/20260624133000_entitlement_realtime_master_sync.sql', 'manager_entitlement_limits_select_sync_v1', 'latest realtime migration must allow safe manager entitlement select/realtime visibility');
has('supabase/migrations/20260624133000_entitlement_realtime_master_sync.sql', 'client_entitlement_limits_select_sync_v1', 'latest realtime migration must allow safe client entitlement select/realtime visibility');
has('supabase/migrations/20260624140000_manager_only_disputer_output_entitlement.sql', 'Manager-only Disputer output entitlement contract', 'latest migration must enforce manager-only Disputer allowance');
has('supabase/migrations/20260624140000_manager_only_disputer_output_entitlement.sql', 'nullif(mel.default_client_output_limit, 0)', 'Disputer SQL entitlement must use manager default output limit');
has('supabase/migrations/20260624140000_manager_only_disputer_output_entitlement.sql', 'Per-Disputer output overrides are retired', 'Disputer-specific output override RPC must be retired');
has('supabase/migrations/20260624143000_strict_generation_allowance_compat.sql', 'access_generation_run_counts_as_output(output_status_input text)', 'strict allowance compatibility migration must define missing output-count helper');
has('supabase/migrations/20260624143000_strict_generation_allowance_compat.sql', 'access_assert_client_can_generate_v1', 'strict allowance compatibility migration must define assert RPC');
has('supabase/migrations/20260624143000_strict_generation_allowance_compat.sql', 'manager_id_value is not null and limit_value is not null and used_value < limit_value', 'strict allowance SQL must block when manager/cap is missing or reached');

if (failures.length) {
  console.error('Master workspace retirement guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Master workspace retirement guard passed.');
