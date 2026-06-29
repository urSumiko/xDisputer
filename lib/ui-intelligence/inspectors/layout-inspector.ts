import type { UIContract, UIInspectionFinding, UIIntelligenceSourceMap } from '../types';

const LAYOUT_MARKERS = ['data-console-shell', 'data-console-main', 'data-console-header-grid', 'data-console-layout-ratio', 'data-console-account-menu'];
const LAYOUT_FORBIDDEN = ['ControlConsoleShell', 'admin-monitor-account', 'grid-template-columns: minmax(0, 1fr) clamp(88px', 'data-manager-canonical-switch="true"'];

export function inspectLayoutContracts(contracts: UIContract[], sources: UIIntelligenceSourceMap): UIInspectionFinding[] {
  const findings: UIInspectionFinding[] = [];
  const layoutContracts = contracts.filter((contract) => contract.kind === 'layout' || contract.kind === 'account' || contract.kind === 'style');

  layoutContracts.forEach((contract) => {
    const combinedSource = contract.sourceFiles.map((file) => sources[file] || '').join('\n');
    LAYOUT_MARKERS.forEach((marker) => {
      if (contract.requiredMarkers.includes(marker) && !combinedSource.includes(marker)) {
        findings.push({
          id: `${contract.id}:layout:missing:${marker}`,
          severity: 'error',
          contractId: contract.id,
          title: 'Layout marker missing',
          description: `${marker} is required to prove the route is using the canonical layout.`,
          expectedPattern: marker,
          recommendedAction: `Add ${marker} to the registered ${contract.label} source path.`
        });
      }
    });

    LAYOUT_FORBIDDEN.forEach((pattern) => {
      if (combinedSource.includes(pattern)) {
        findings.push({
          id: `${contract.id}:layout:forbidden:${pattern}`,
          severity: 'critical',
          contractId: contract.id,
          title: 'Legacy layout pattern detected',
          description: `${pattern} can cause mixed shell rendering, ratio drift, duplicated account UI, or corrupted account rails.`,
          detectedPattern: pattern,
          recommendedAction: 'Remove the legacy layout pattern and route through ConsoleShell plus the final account rail contract.'
        });
      }
    });
  });

  return findings;
}

export function expectedHeaderRatio() {
  return {
    desktop: '75 / 25',
    tablet: 'header dominant with account rail >= 220px',
    mobile: 'compact account rail with readable header'
  };
}
