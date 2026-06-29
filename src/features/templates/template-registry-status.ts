export type TemplateRegistryCheckStatus = 'pass' | 'fail';

export type TemplateRegistryStatusCheck = {
  name: string;
  status: TemplateRegistryCheckStatus;
  message: string;
};

export type TemplateRegistryStatus = {
  status: TemplateRegistryCheckStatus;
  checks: TemplateRegistryStatusCheck[];
};

export function summarizeTemplateRegistryStatus(checks: TemplateRegistryStatusCheck[]): TemplateRegistryStatus {
  return {
    status: checks.some((item) => item.status === 'fail') ? 'fail' : 'pass',
    checks
  };
}
