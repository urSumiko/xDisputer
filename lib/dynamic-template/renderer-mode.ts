export type DynamicTemplateRendererMode = 'LEGACY_STABLE' | 'CONTRACT_V2_DIAGNOSTIC' | 'DOCX_LAYOUT_V2';

const allowedModes: DynamicTemplateRendererMode[] = ['LEGACY_STABLE', 'CONTRACT_V2_DIAGNOSTIC', 'DOCX_LAYOUT_V2'];

function normalizeMode(value: string | null | undefined): DynamicTemplateRendererMode | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
  return allowedModes.includes(normalized as DynamicTemplateRendererMode) ? normalized as DynamicTemplateRendererMode : null;
}

export function resolveDynamicTemplateRendererMode(input?: {
  requestHeader?: string | null;
  explicitMode?: string | null;
}): DynamicTemplateRendererMode {
  return normalizeMode(input?.explicitMode)
    || normalizeMode(input?.requestHeader)
    || normalizeMode(process.env.DYNAMIC_TEMPLATE_RENDERER_MODE)
    || normalizeMode(process.env.NEXT_PUBLIC_DYNAMIC_TEMPLATE_RENDERER_MODE)
    || 'CONTRACT_V2_DIAGNOSTIC';
}

export function dynamicRendererModePolicy(mode: DynamicTemplateRendererMode) {
  if (mode === 'DOCX_LAYOUT_V2') {
    return {
      mode,
      useStableRenderer: false,
      collectContractV2Diagnostics: true,
      buildRenderPlan: true,
      allowDocxLayoutRendererV2: true,
      warning: 'DOCX_LAYOUT_V2 is enabled. Only use after regression tests confirm layout preservation.'
    };
  }

  if (mode === 'CONTRACT_V2_DIAGNOSTIC') {
    return {
      mode,
      useStableRenderer: true,
      collectContractV2Diagnostics: true,
      buildRenderPlan: true,
      allowDocxLayoutRendererV2: false,
      warning: 'Stable renderer remains active; v2 diagnostics and render plans are collected for proof and upgrade readiness.'
    };
  }

  return {
    mode,
    useStableRenderer: true,
    collectContractV2Diagnostics: false,
    buildRenderPlan: false,
    allowDocxLayoutRendererV2: false,
    warning: 'Legacy stable renderer only; v2 diagnostics disabled.'
  };
}

export function assertDocxLayoutRendererV2Allowed(mode: DynamicTemplateRendererMode) {
  const policy = dynamicRendererModePolicy(mode);
  if (!policy.allowDocxLayoutRendererV2) {
    throw new Error(`DOCX layout renderer v2 is not enabled. Current mode: ${mode}.`);
  }
  return policy;
}
