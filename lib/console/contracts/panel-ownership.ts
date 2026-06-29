import { CONSOLE_TRANSFORMATION_PANELS, type ConsoleDomain } from './navigation-manifest';

export type PanelOwnershipSummary = {
  domain: ConsoleDomain;
  totalPanels: number;
  capabilityKeys: string[];
  routes: string[];
};

export function summarizePanelOwnership(domain: ConsoleDomain): PanelOwnershipSummary {
  const panels = CONSOLE_TRANSFORMATION_PANELS.filter((panel) => panel.domain === domain);
  return {
    domain,
    totalPanels: panels.length,
    capabilityKeys: panels.map((panel) => panel.capability),
    routes: panels.map((panel) => panel.href)
  };
}

export function findDuplicatePanelProcesses() {
  const processOwners = new Map<string, string[]>();
  for (const panel of CONSOLE_TRANSFORMATION_PANELS) {
    for (const processName of panel.wiredProcesses) {
      const key = processName.toLowerCase().trim();
      processOwners.set(key, [...(processOwners.get(key) || []), panel.id]);
    }
  }
  return Array.from(processOwners.entries())
    .filter(([, owners]) => owners.length > 1)
    .map(([processName, owners]) => ({ processName, owners }));
}

export function panelsByCapabilityPrefix(prefix: string) {
  return CONSOLE_TRANSFORMATION_PANELS.filter((panel) => panel.capability.startsWith(prefix));
}
