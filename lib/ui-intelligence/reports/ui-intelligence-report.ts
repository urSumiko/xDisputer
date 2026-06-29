import type { FeatureContract, UIContract, UIInspectionFinding, UIIntelligenceReport, UIIntelligenceSourceMap, UIIntelligenceStatus } from '../types';
import { inspectDesignContracts } from '../inspectors/design-inspector';
import { inspectLayoutContracts } from '../inspectors/layout-inspector';
import { inspectUXContracts } from '../inspectors/ux-inspector';
import { inspectFeatureFunctions } from '../inspectors/function-inspector';

function statusFromFindings(findings: UIInspectionFinding[]): UIIntelligenceStatus {
  if (findings.some((finding) => finding.severity === 'critical')) return 'blocked';
  if (findings.some((finding) => finding.severity === 'error' || finding.severity === 'warning')) return 'warning';
  return 'healthy';
}

function propagationGroups(contracts: UIContract[]) {
  return contracts.reduce<Record<string, string[]>>((groups, contract) => {
    if (!contract.propagationGroup) return groups;
    groups[contract.propagationGroup] = [...(groups[contract.propagationGroup] || []), contract.id];
    return groups;
  }, {});
}

export function buildUIIntelligenceReport(contracts: UIContract[], features: FeatureContract[], sources: UIIntelligenceSourceMap): UIIntelligenceReport {
  const findings = [
    ...inspectDesignContracts(contracts, sources),
    ...inspectLayoutContracts(contracts, sources),
    ...inspectUXContracts(contracts, sources),
    ...inspectFeatureFunctions(features, sources)
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: statusFromFindings(findings),
    contracts: contracts.map((contract) => {
      const contractFindings = findings.filter((finding) => finding.contractId === contract.id);
      return {
        id: contract.id,
        label: contract.label,
        status: statusFromFindings(contractFindings),
        findings: contractFindings
      };
    }),
    findings,
    globalContracts: contracts.filter((contract) => contract.scope === 'global').map((contract) => contract.id),
    domainContracts: contracts.filter((contract) => contract.scope === 'domain').map((contract) => contract.id),
    routeContracts: contracts.filter((contract) => contract.scope === 'route').map((contract) => contract.id),
    customContracts: contracts.filter((contract) => contract.scope === 'custom').map((contract) => contract.id),
    propagationGroups: propagationGroups(contracts)
  };
}

export function formatUIIntelligenceReport(report: UIIntelligenceReport) {
  const lines = [
    `UI Intelligence Report`,
    `Status: ${report.status}`,
    `Generated: ${report.generatedAt}`,
    ``,
    `Global contracts: ${report.globalContracts.join(', ') || 'none'}`,
    `Domain contracts: ${report.domainContracts.join(', ') || 'none'}`,
    `Route contracts: ${report.routeContracts.join(', ') || 'none'}`,
    `Custom contracts: ${report.customContracts.join(', ') || 'none'}`,
    ``
  ];

  report.contracts.forEach((contract) => {
    const icon = contract.status === 'healthy' ? '✅' : contract.status === 'blocked' ? '❌' : '⚠️';
    lines.push(`${icon} ${contract.id}: ${contract.status}`);
    contract.findings.forEach((finding) => lines.push(`  - [${finding.severity}] ${finding.title}: ${finding.recommendedAction}`));
  });

  if (!report.findings.length) lines.push('✅ No UI intelligence findings.');
  return lines.join('\n');
}
