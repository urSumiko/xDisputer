import type { FeatureContract, UIInspectionFinding, UIIntelligenceSourceMap } from '../types';

export type ActiveFunctionProof = {
  active: boolean;
  entryRoute: string;
  sourceFile: string;
  dependencies: string[];
  lastKnownGuard: string;
  failurePoints: string[];
};

export function inspectFeatureFunctions(features: FeatureContract[], sources: UIIntelligenceSourceMap): UIInspectionFinding[] {
  const findings: UIInspectionFinding[] = [];

  features.forEach((feature) => {
    feature.sourceFiles.forEach((sourceFile) => {
      const source = sources[sourceFile];
      if (!source) {
        findings.push({
          id: `${feature.id}:function:missing-source:${sourceFile}`,
          severity: 'critical',
          contractId: feature.id,
          title: 'Active function source missing',
          description: `${feature.label} declares ${sourceFile}, but the file was not found in the source map.`,
          sourceFile,
          recommendedAction: 'Restore the missing source or remove this feature dependency from the manifest.'
        });
      }
    });

    feature.apiRoutes.forEach((apiRoute) => {
      const expectedPath = `app${apiRoute}/route.ts`;
      if (!sources[expectedPath]) {
        findings.push({
          id: `${feature.id}:function:missing-api:${apiRoute}`,
          severity: 'error',
          contractId: feature.id,
          title: 'Active API route missing',
          description: `${feature.label} needs ${apiRoute}, but ${expectedPath} was not available.`,
          sourceFile: expectedPath,
          recommendedAction: 'Create the API route or update the feature contract.'
        });
      }
    });
  });

  return findings;
}

export function activeFunctionProof(feature: FeatureContract): ActiveFunctionProof {
  return {
    active: feature.status === 'active',
    entryRoute: feature.entryRoutes[0] || '/',
    sourceFile: feature.sourceFiles[0] || 'unknown',
    dependencies: feature.dependencies,
    lastKnownGuard: feature.uiContracts.join(', '),
    failurePoints: [...feature.apiRoutes, ...feature.databaseObjects, ...feature.sourceFiles]
  };
}
