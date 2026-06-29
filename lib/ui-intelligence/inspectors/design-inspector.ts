import type { UIContract, UIInspectionFinding, UIIntelligenceSourceMap } from '../types';

function makeFinding(contract: UIContract, index: number, title: string, description: string, sourceFile: string, severity: UIInspectionFinding['severity'] = 'error'): UIInspectionFinding {
  return {
    id: `${contract.id}:design:${index}`,
    severity,
    contractId: contract.id,
    title,
    description,
    sourceFile,
    recommendedAction: `Update ${sourceFile} so it follows the ${contract.label} design contract.`
  };
}

export function inspectDesignContracts(contracts: UIContract[], sources: UIIntelligenceSourceMap): UIInspectionFinding[] {
  const findings: UIInspectionFinding[] = [];

  contracts.forEach((contract) => {
    contract.sourceFiles.forEach((sourceFile) => {
      const source = sources[sourceFile];
      if (!source) {
        findings.push(makeFinding(contract, findings.length, 'Missing design source file', `Required source file ${sourceFile} was not available for inspection.`, sourceFile, 'critical'));
        return;
      }

      contract.requiredMarkers.forEach((marker) => {
        if (!source.includes(marker)) {
          findings.push(makeFinding(contract, findings.length, 'Missing required UI marker', `${marker} is required so runtime tooling can detect and verify this UI contract.`, sourceFile));
        }
      });

      contract.forbiddenPatterns.forEach((pattern) => {
        if (source.includes(pattern)) {
          findings.push({
            ...makeFinding(contract, findings.length, 'Forbidden design pattern detected', `${pattern} should not appear inside ${contract.label}.`, sourceFile, 'critical'),
            detectedPattern: pattern,
            expectedPattern: contract.allowedCustomizations.join(', ')
          });
        }
      });
    });
  });

  return findings;
}
