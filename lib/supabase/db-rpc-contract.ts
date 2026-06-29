export type DatabaseContractObjectKind = 'table' | 'rpc' | 'storage_bucket' | 'column' | 'policy_group';

export type DatabaseContractObject = {
  kind: DatabaseContractObjectKind;
  name: string;
  criticality: 'required' | 'recommended';
  owner: string;
  purpose: string;
};

export const REQUIRED_DATABASE_TABLES: DatabaseContractObject[] = [
  { kind: 'table', name: 'profiles', criticality: 'required', owner: 'access-control', purpose: 'Account identity, role, account status, and manager assignment.' },
  { kind: 'table', name: 'template_assets', criticality: 'required', owner: 'manager-template-library', purpose: 'Manager-owned template versions and active template selection.' },
  { kind: 'table', name: 'generation_runs', criticality: 'required', owner: 'generation-ledger', purpose: 'Generated packet ledger and output activity source.' },
  { kind: 'table', name: 'manager_disputer_output_approvals', criticality: 'required', owner: 'output-activity', purpose: 'Per-output approval, return, pay, and report rows.' },
  { kind: 'table', name: 'notifications', criticality: 'required', owner: 'notifications', purpose: 'Durable bell notification source of truth.' },
  { kind: 'table', name: 'bosses', criticality: 'recommended', owner: 'manager-reporting', purpose: 'Structured boss identity for Per Boss reporting.' },
  { kind: 'table', name: 'disputer_boss_assignments', criticality: 'recommended', owner: 'manager-reporting', purpose: 'Structured Disputer-to-boss assignment history.' }
];

export const REQUIRED_DATABASE_COLUMNS: DatabaseContractObject[] = [
  { kind: 'column', name: 'profiles.manager_id', criticality: 'required', owner: 'access-control', purpose: 'Links a Disputer to the responsible manager.' },
  { kind: 'column', name: 'profiles.account_status', criticality: 'required', owner: 'access-control', purpose: 'Blocks inactive, suspended, and pending accounts.' },
  { kind: 'column', name: 'generation_runs.per_output_pay', criticality: 'required', owner: 'output-activity', purpose: 'Marks generated packets that require manager per-output confirmation.' },
  { kind: 'column', name: 'manager_disputer_output_approvals.boss_id', criticality: 'recommended', owner: 'manager-reporting', purpose: 'Structured boss foreign key; migration is additive and safe.' }
];

export const REQUIRED_DATABASE_RPCS: DatabaseContractObject[] = [
  { kind: 'rpc', name: 'access_resolve_manager_invite', criticality: 'required', owner: 'access-control', purpose: 'Resolves manager invite codes during profile creation.' },
  { kind: 'rpc', name: 'access_workspace_account_summary_v1', criticality: 'required', owner: 'account-directory', purpose: 'Master/manager account summary cards.' },
  { kind: 'rpc', name: 'access_workspace_account_directory_v1', criticality: 'required', owner: 'account-directory', purpose: 'Paginated account directory and client center listing.' },
  { kind: 'rpc', name: 'access_workspace_attention_queue_v1', criticality: 'recommended', owner: 'account-directory', purpose: 'Fast attention queue for pending/blocked accounts.' },
  { kind: 'rpc', name: 'access_assert_client_can_generate_v1', criticality: 'required', owner: 'entitlements', purpose: 'Strict generation allowance gate before saving generation runs.' },
  { kind: 'rpc', name: 'access_client_daily_output_entitlement_v1', criticality: 'required', owner: 'entitlements', purpose: 'Daily output limit and reset visibility.' },
  { kind: 'rpc', name: 'sync_generation_output_activity_v1', criticality: 'required', owner: 'output-activity', purpose: 'Creates manager output activity from generation runs.' },
  { kind: 'rpc', name: 'sync_manager_output_activity_notifications_v1', criticality: 'required', owner: 'notifications', purpose: 'Creates manager bell notifications from pending output activity.' },
  { kind: 'rpc', name: 'sync_manager_recent_generation_output_activity_v1', criticality: 'recommended', owner: 'output-activity', purpose: 'Repairs recent manager output activity rows after deployment drift.' },
  { kind: 'rpc', name: 'sync_output_activity_decision_notification_v1', criticality: 'required', owner: 'notifications', purpose: 'Creates Disputer bell notifications after manager confirms or returns output.' },
  { kind: 'rpc', name: 'app_activate_manager_template_asset_v1', criticality: 'recommended', owner: 'manager-template-library', purpose: 'RLS-safe manager template activation fallback.' },
  { kind: 'rpc', name: 'report_boss_name_v1', criticality: 'recommended', owner: 'manager-reporting', purpose: 'Structured boss resolution with legacy notes fallback.' }
];

export const REQUIRED_STORAGE_BUCKETS: DatabaseContractObject[] = [
  { kind: 'storage_bucket', name: 'template-assets', criticality: 'required', owner: 'manager-template-library', purpose: 'Stores manager-uploaded DOCX/PDF template assets.' }
];

export const DATABASE_CONTRACT_OBJECTS: DatabaseContractObject[] = [
  ...REQUIRED_DATABASE_TABLES,
  ...REQUIRED_DATABASE_COLUMNS,
  ...REQUIRED_DATABASE_RPCS,
  ...REQUIRED_STORAGE_BUCKETS
];

export function databaseContractSummary() {
  return {
    version: '2026-06-30.database-rpc-contract.v1',
    requiredTables: REQUIRED_DATABASE_TABLES.filter((item) => item.criticality === 'required').map((item) => item.name),
    requiredRpcs: REQUIRED_DATABASE_RPCS.filter((item) => item.criticality === 'required').map((item) => item.name),
    recommendedRpcs: REQUIRED_DATABASE_RPCS.filter((item) => item.criticality === 'recommended').map((item) => item.name),
    storageBuckets: REQUIRED_STORAGE_BUCKETS.map((item) => item.name),
    objectCount: DATABASE_CONTRACT_OBJECTS.length
  };
}

export function missingCriticalDatabaseContractMessage(names: string[]) {
  if (!names.length) return null;
  return `Database contract is missing required object(s): ${names.join(', ')}. Apply the latest Supabase SQL before using generation, output activity, notifications, or manager reports.`;
}
