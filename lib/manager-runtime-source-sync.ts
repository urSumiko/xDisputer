export const MANAGER_SWITCH_CONTRACT_VERSION = 'manager-visible-switch-nav-contract-v3';

export type ManagerRuntimeSourceSyncCheck = {
  key: string;
  ok: boolean;
  label: string;
};

export type ManagerRuntimeSourceSyncSnapshot = {
  contractVersion: string;
  runtimeCommit: string;
  nodeEnv: string;
  checks: ManagerRuntimeSourceSyncCheck[];
  allPassed: boolean;
};

export function runtimeCommitLabel() {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local-dev';
}

export function managerRuntimeSourceSyncSnapshot(checks: ManagerRuntimeSourceSyncCheck[]): ManagerRuntimeSourceSyncSnapshot {
  return {
    contractVersion: MANAGER_SWITCH_CONTRACT_VERSION,
    runtimeCommit: runtimeCommitLabel(),
    nodeEnv: process.env.NODE_ENV || 'unknown',
    checks,
    allPassed: checks.every((check) => check.ok)
  };
}
