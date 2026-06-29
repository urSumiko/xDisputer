import type { ClientCanonicalSourceData, ClientTemplateDbClient } from './client-template-types';

function pick(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

export function normalizeSourceToCanonicalFields(raw: Record<string, unknown>) {
  return {
    consumer: {
      full_name: pick(raw, ['fullName', 'clientName', 'name', 'consumerName']),
      address: pick(raw, ['address', 'currentAddress', 'consumerAddress']),
      email: pick(raw, ['email', 'consumerEmail'])
    },
    account: {
      creditor_name: pick(raw, ['creditorName', 'furnisher', 'companyName']),
      account_number: pick(raw, ['accountNumber', 'accountNo', 'tradelineAccountNumber']),
      dispute_reason: pick(raw, ['disputeReason', 'reason', 'investigationReason'])
    },
    bureau: {
      name: pick(raw, ['bureauName', 'creditBureau', 'bureau'])
    },
    round: {
      label: pick(raw, ['roundLabel', 'round']) || '1st Round'
    }
  };
}

function readCanonicalValue(data: Record<string, unknown>, path: string | null | undefined) {
  if (!path) return null;
  return path.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : null, data) ?? null;
}

export function detectMissingRequiredCanonicalFields(input: { canonicalData: Record<string, unknown>; requiredFields?: string[] }) {
  const required = input.requiredFields?.length ? input.requiredFields : ['consumer.full_name', 'account.creditor_name', 'account.account_number', 'dispute.reason'];
  return required.filter((field) => !readCanonicalValue(input.canonicalData, field.replace('dispute.', 'account.')) && !readCanonicalValue(input.canonicalData, field));
}

export async function resolveClientCanonicalSourceData(input: { supabase: ClientTemplateDbClient; managerUserId: string | null; clientUserId: string; roundLabel: string | null }): Promise<ClientCanonicalSourceData> {
  if (!input.managerUserId || !input.roundLabel) {
    return { managerUserId: input.managerUserId, clientUserId: input.clientUserId, roundLabel: input.roundLabel, canonicalData: {}, sourceDataSnapshot: {}, sourceStatus: 'blocked', missingRequiredFields: ['manager assignment'], warnings: [] };
  }
  const { data, error } = await input.supabase
    .from('client_canonical_source_data')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .eq('client_user_id', input.clientUserId)
    .eq('source_round_label', input.roundLabel)
    .maybeSingle();
  if (error || !data) {
    return { managerUserId: input.managerUserId, clientUserId: input.clientUserId, roundLabel: input.roundLabel, canonicalData: {}, sourceDataSnapshot: {}, sourceStatus: 'draft', missingRequiredFields: ['consumer.full_name', 'account.creditor_name', 'account.account_number'], warnings: ['Source data has not been normalized for this round yet.'] };
  }
  return {
    managerUserId: String(data.manager_user_id),
    clientUserId: String(data.client_user_id),
    roundLabel: String(data.source_round_label),
    canonicalData: data.canonical_data && typeof data.canonical_data === 'object' ? data.canonical_data : {},
    sourceDataSnapshot: data.source_data_snapshot && typeof data.source_data_snapshot === 'object' ? data.source_data_snapshot : {},
    sourceStatus: data.source_status === 'ready' ? 'ready' : data.source_status === 'blocked' ? 'blocked' : 'draft',
    missingRequiredFields: Array.isArray(data.missing_required_fields) ? data.missing_required_fields.map(String) : [],
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : []
  };
}

export async function buildClientCanonicalSourceData(input: { supabase: ClientTemplateDbClient; managerUserId: string; clientUserId: string; roundLabel: string; rawSourceData: Record<string, unknown> }) {
  const canonicalData = normalizeSourceToCanonicalFields({ ...input.rawSourceData, roundLabel: input.roundLabel });
  const missingRequiredFields = detectMissingRequiredCanonicalFields({ canonicalData });
  const sourceStatus = missingRequiredFields.length ? 'blocked' : 'ready';
  const { data, error } = await input.supabase
    .from('client_canonical_source_data')
    .upsert({ manager_user_id: input.managerUserId, client_user_id: input.clientUserId, source_round_label: input.roundLabel, canonical_data: canonicalData, source_data_snapshot: input.rawSourceData, missing_required_fields: missingRequiredFields, source_status: sourceStatus, warnings: [], updated_by: input.clientUserId, updated_at: new Date().toISOString() }, { onConflict: 'manager_user_id,client_user_id,source_round_label' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export { readCanonicalValue };
