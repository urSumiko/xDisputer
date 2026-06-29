import type { ManagerTemplateBlock, ManagerTemplateStructureMap } from './template-structure-map';

export type ManagerTemplateIntent = 'PRESERVE' | 'REMOVE' | 'MAKE_OPTIONAL' | 'MAKE_DYNAMIC' | 'REPEAT_FOR_ENTITY' | 'USE_AS_STYLE_SEED' | 'REQUIRES_REVIEW';

export type StaticBlockRuleDraft = {
  blockKey: string;
  blockKind: ManagerTemplateBlock['kind'];
  paragraphStart: number;
  paragraphEnd: number;
  managerIntent: ManagerTemplateIntent;
  preserveWhenEmpty: boolean;
  appliesToFutureVersions: boolean;
  sampleText: string;
  reason: string;
};

function intentForBlock(block: ManagerTemplateBlock): ManagerTemplateIntent {
  if (block.kind === 'DYNAMIC_FIELD') return 'MAKE_DYNAMIC';
  if (block.kind === 'REPEATING_ENTITY_BLOCK') return 'REPEAT_FOR_ENTITY';
  if (block.kind === 'UNKNOWN_MANAGER_CUSTOM_TEXT') return 'PRESERVE';
  if (block.kind === 'STATIC_OPTIONAL') return 'MAKE_OPTIONAL';
  return 'PRESERVE';
}

export function classifyStaticPreservationRules(map: ManagerTemplateStructureMap): StaticBlockRuleDraft[] {
  return map.blocks.map((block) => ({
    blockKey: block.blockKey,
    blockKind: block.kind,
    paragraphStart: block.paragraphStart,
    paragraphEnd: block.paragraphEnd,
    managerIntent: intentForBlock(block),
    preserveWhenEmpty: block.preserveByDefault,
    appliesToFutureVersions: false,
    sampleText: block.sampleText,
    reason: block.reason
  }));
}

export function preservedManagerBlocks(map: ManagerTemplateStructureMap) {
  return classifyStaticPreservationRules(map).filter((rule) => rule.managerIntent === 'PRESERVE' || rule.managerIntent === 'USE_AS_STYLE_SEED');
}

export function staticPreservationSummary(map: ManagerTemplateStructureMap) {
  const rules = classifyStaticPreservationRules(map);
  return {
    totalBlocks: rules.length,
    preservedBlocks: rules.filter((rule) => rule.managerIntent === 'PRESERVE').length,
    optionalBlocks: rules.filter((rule) => rule.managerIntent === 'MAKE_OPTIONAL').length,
    dynamicBlocks: rules.filter((rule) => rule.managerIntent === 'MAKE_DYNAMIC').length,
    repeatingBlocks: rules.filter((rule) => rule.managerIntent === 'REPEAT_FOR_ENTITY').length,
    unknownCustomBlocks: rules.filter((rule) => rule.blockKind === 'UNKNOWN_MANAGER_CUSTOM_TEXT').length
  };
}
