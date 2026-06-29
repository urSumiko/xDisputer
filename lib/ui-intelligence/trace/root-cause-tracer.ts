import type { RootCauseTrace, UIContract, UIInspectionFinding } from '../types';

function traceId(problem: string) {
  return `trace-${problem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'unknown'}`;
}

function inferLikelyRoot(problem: string, findings: UIInspectionFinding[]) {
  const lowered = problem.toLowerCase();
  const critical = findings.find((finding) => finding.severity === 'critical');
  if (critical?.sourceFile) return critical.sourceFile;
  if (lowered.includes('ratio') || lowered.includes('header') || lowered.includes('avatar')) return 'app/final-console-account-rail.css';
  if (lowered.includes('shell') || lowered.includes('layout')) return 'components/console/ConsoleShell.tsx';
  if (lowered.includes('save') || lowered.includes('account')) return 'app/api/account/profile/route.ts';
  if (lowered.includes('template') || lowered.includes('mapping')) return 'lib/templates/contracts/canonical-field-registry.ts';
  return findings[0]?.sourceFile || 'unknown';
}

export function traceRootCause(problem: string, contracts: UIContract[], findings: UIInspectionFinding[], route?: string): RootCauseTrace {
  const rootFile = inferLikelyRoot(problem, findings);
  const responsible = contracts.find((contract) => contract.sourceFiles.includes(rootFile) || contract.connectedRoutes.includes(route || '')) || contracts[0];
  const relevantFindings = findings.filter((finding) => !responsible || finding.contractId === responsible.id).slice(0, 5);

  const chain: RootCauseTrace['chain'] = [
    {
      layer: 'route',
      file: route,
      evidence: route ? `Problem reported on ${route}.` : 'No route provided; trace starts from global contracts.',
      status: route ? 'warning' : 'unknown'
    },
    {
      layer: 'component',
      file: responsible?.sourceFiles[0],
      evidence: responsible ? `${responsible.label} is the nearest registered contract.` : 'No matching contract found.',
      status: responsible ? 'warning' : 'unknown'
    },
    ...relevantFindings.map((finding) => ({
      layer: 'script' as const,
      file: finding.sourceFile,
      evidence: `${finding.title}: ${finding.description}`,
      status: finding.severity === 'critical' || finding.severity === 'error' ? 'blocked' as const : 'warning' as const
    })),
    {
      layer: 'cache',
      evidence: 'If source is correct but UI is unchanged, clear .next, restart dev server, and hard-refresh browser.',
      status: 'warning'
    }
  ];

  return {
    traceId: traceId(problem),
    problem,
    route,
    activeFunction: responsible?.connectedProcesses[0],
    likelyRootFile: rootFile,
    responsibleContract: responsible?.id,
    chain,
    conclusion: relevantFindings.length ? 'The issue is tied to one or more contract findings and should be fixed at the registered source file.' : 'No critical source finding was found; verify runtime CSS and stale cache next.',
    actionPlan: [
      `Inspect ${rootFile}.`,
      'Update the registered UI contract rather than a one-off route override.',
      'Run npm run ui-intelligence:guard and npm run console-shell:guard.',
      'Clear .next and restart the Codespaces dev server.',
      'Use xDisputer debug panel to confirm computed grid, markers, and width ratio.'
    ]
  };
}
