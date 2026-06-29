import type { UIContract } from '../types';

export type UIDependencyNode = {
  id: string;
  label: string;
  sourceFiles: string[];
  routes: string[];
  dependencies: string[];
  propagationGroup?: string;
};

export type UIDependencyEdge = {
  from: string;
  to: string;
  reason: string;
};

export type UIDependencyGraph = {
  nodes: UIDependencyNode[];
  edges: UIDependencyEdge[];
};

export function buildDependencyGraph(contracts: UIContract[]): UIDependencyGraph {
  const nodes = contracts.map((contract) => ({
    id: contract.id,
    label: contract.label,
    sourceFiles: contract.sourceFiles,
    routes: contract.connectedRoutes,
    dependencies: contract.dependencies,
    propagationGroup: contract.propagationGroup
  }));

  const edges: UIDependencyEdge[] = [];
  contracts.forEach((contract) => {
    contract.dependencies.forEach((dependency) => {
      const matching = contracts.find((candidate) => candidate.label === dependency || candidate.id === dependency.toLowerCase().replace(/\s+/g, '-'));
      if (matching) edges.push({ from: contract.id, to: matching.id, reason: `${contract.label} depends on ${dependency}.` });
    });
    if (contract.propagationGroup) {
      contracts
        .filter((candidate) => candidate.id !== contract.id && candidate.propagationGroup === contract.propagationGroup)
        .forEach((candidate) => edges.push({ from: contract.id, to: candidate.id, reason: `Shared propagation group ${contract.propagationGroup}.` }));
    }
  });

  return { nodes, edges };
}

export function affectedBySourceFile(contracts: UIContract[], sourceFile: string) {
  return contracts.filter((contract) => contract.sourceFiles.some((file) => sourceFile === file || sourceFile.startsWith(file.replace(/\*$/, ''))));
}
