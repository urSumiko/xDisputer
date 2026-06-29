import type { UIContract, UIInspectionFinding, UIIntelligenceSourceMap } from '../types';

const UX_RULES = [
  { id: 'account-settings-only', forbidden: ['Manage accounts', 'System health', 'data-manager-canonical-switch="true"'], message: 'Account menu must contain active account settings and session security, not shortcut navigation.' },
  { id: 'switch-mode-sidebar', required: ['data-console-mode-switch="sidebar-bottom"'], message: 'Switch Mode must be visible at the bottom of the sidebar.' },
  { id: 'debug-proof', required: ['headerAccountWidthRatio', 'detectionMode'], message: 'Runtime debugger must expose useful proof for layout troubleshooting.' }
];

export function inspectUXContracts(contracts: UIContract[], sources: UIIntelligenceSourceMap): UIInspectionFinding[] {
  const findings: UIInspectionFinding[] = [];

  UX_RULES.forEach((rule) => {
    const source = Object.values(sources).join('\n');
    rule.required?.forEach((required) => {
      if (!source.includes(required)) {
        findings.push({
          id: `ux:${rule.id}:missing:${required}`,
          severity: 'error',
          contractId: 'ux-global',
          title: 'UX requirement missing',
          description: rule.message,
          expectedPattern: required,
          recommendedAction: 'Wire the required UX marker into the global console shell or runtime debugger.'
        });
      }
    });
    rule.forbidden?.forEach((forbidden) => {
      if (source.includes(forbidden)) {
        findings.push({
          id: `ux:${rule.id}:forbidden:${forbidden}`,
          severity: 'warning',
          contractId: 'ux-global',
          title: 'UX shortcut or duplicate detected',
          description: rule.message,
          detectedPattern: forbidden,
          recommendedAction: 'Remove shortcuts or duplicated UI from the account/settings context.'
        });
      }
    });
  });

  contracts.forEach((contract) => {
    if (contract.scope === 'custom' && !contract.allowedCustomizations.length) {
      findings.push({
        id: `${contract.id}:ux:custom-reason-missing`,
        severity: 'warning',
        contractId: contract.id,
        title: 'Custom UI lacks allowed customization list',
        description: 'Custom UI must declare what is intentionally allowed so it does not leak into global design logic.',
        recommendedAction: `Add allowedCustomizations to ${contract.id}.`
      });
    }
  });

  return findings;
}
