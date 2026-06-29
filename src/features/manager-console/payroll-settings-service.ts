export type PayrollFormInput = {
  profileId: string;
  employmentType: string;
  isRegular: string;
  baseSalary: FormDataEntryValue | null;
  salary: FormDataEntryValue | null;
  perOutputRate: FormDataEntryValue | null;
  rate: FormDataEntryValue | null;
  paydayFrequency: FormDataEntryValue | null;
  notes: FormDataEntryValue | null;
};

function clean(value: FormDataEntryValue | null | string, max = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeEmploymentType(input: PayrollFormInput) {
  const requestedType = clean(input.employmentType);
  if (requestedType === 'full_time' || requestedType === 'output_based') return requestedType;
  return clean(input.isRegular) === 'true' ? 'full_time' : 'output_based';
}

export function readPayrollForm(formData: FormData): PayrollFormInput {
  return {
    profileId: clean(formData.get('profileId'), 80),
    employmentType: clean(formData.get('employmentType')),
    isRegular: clean(formData.get('isRegular')),
    baseSalary: formData.get('baseSalary'),
    salary: formData.get('salary'),
    perOutputRate: formData.get('perOutputRate'),
    rate: formData.get('rate'),
    paydayFrequency: formData.get('paydayFrequency'),
    notes: formData.get('notes')
  };
}

export function buildManagerPayrollSettingsRecord(input: PayrollFormInput, managerId: string) {
  const employmentType = normalizeEmploymentType(input);
  const perOutputRate = numberValue(input.perOutputRate || input.rate);
  const baseSalary = employmentType === 'output_based' ? 0 : numberValue(input.baseSalary || input.salary);

  return {
    manager_id: managerId,
    user_id: input.profileId,
    employment_type: employmentType,
    is_regular: employmentType === 'full_time',
    base_salary: baseSalary,
    per_output_rate: perOutputRate,
    salary: baseSalary,
    rate: perOutputRate,
    payday_frequency: clean(input.paydayFrequency) || 'manual',
    notes: clean(input.notes, 300) || null,
    updated_at: new Date().toISOString()
  };
}
