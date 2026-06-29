import type { DynamicTemplateContractV2, DynamicTemplateUnsupportedZone } from './contract-v2';

export type DynamicTemplateAdvancedZoneDecision = {
  status: 'CLEAR' | 'WARNING' | 'BLOCKED';
  blockers: string[];
  warnings: string[];
  zones: DynamicTemplateUnsupportedZone[];
};

const unsupportedRequiredZones = new Set(['ALT_CHUNK']);
const cautionZones = new Set(['TEXT_BOX', 'DRAWING', 'CONTENT_CONTROL', 'UNKNOWN']);

function zoneLabel(zone: DynamicTemplateUnsupportedZone) {
  return `${zone.zone} in ${zone.partName}`;
}

export function evaluateDynamicTemplateAdvancedZones(contract: DynamicTemplateContractV2): DynamicTemplateAdvancedZoneDecision {
  if (!contract.unsupportedZones.length) {
    return { status: 'CLEAR', blockers: [], warnings: [], zones: [] };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  contract.unsupportedZones.forEach((zone) => {
    const aliases = zone.requiredFieldAliases.filter(Boolean);
    const label = zoneLabel(zone);

    if (unsupportedRequiredZones.has(zone.zone) && aliases.length) {
      blockers.push(`${label} contains required placeholder candidate(s): ${aliases.join(', ')}.`);
      return;
    }

    if (cautionZones.has(zone.zone)) {
      warnings.push(`${label} requires layout review before promoting renderer-v2 for this template.`);
      return;
    }

    warnings.push(`${label} was detected and should be reviewed.`);
  });

  return {
    status: blockers.length ? 'BLOCKED' : warnings.length ? 'WARNING' : 'CLEAR',
    blockers,
    warnings,
    zones: contract.unsupportedZones
  };
}

export function dynamicTemplateAdvancedZoneManifest(decision: DynamicTemplateAdvancedZoneDecision) {
  return {
    dynamicTemplateAdvancedZones: {
      status: decision.status,
      blockers: decision.blockers,
      warnings: decision.warnings,
      zones: decision.zones.map((zone) => ({
        partName: zone.partName,
        zone: zone.zone,
        requiredFieldAliases: zone.requiredFieldAliases,
        warning: zone.warning
      }))
    }
  };
}
