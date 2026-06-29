import type { DesignToken, DesignTokenScope } from './types';

export const CANVAS_0_DESIGN_TOKENS: readonly DesignToken[] = [
  {
    name: '--xds-shell-sidebar-width',
    value: '18rem',
    scope: 'global',
    description: 'Canonical sidebar width used by master and manager workspace shells.'
  },
  {
    name: '--xds-shell-radius',
    value: '1.25rem',
    scope: 'global',
    description: 'Shared panel radius for console and workspace cards.'
  },
  {
    name: '--xds-shell-gap',
    value: '1rem',
    scope: 'global',
    description: 'Default shell gap between navigation, header, and main content.'
  },
  {
    name: '--xds-master-accent',
    value: 'master-control-plane',
    scope: 'workspace',
    description: 'Semantic token for master workspace control-plane affordances.'
  },
  {
    name: '--xds-manager-accent',
    value: 'manager-execution-plane',
    scope: 'workspace',
    description: 'Semantic token for manager workspace execution-plane affordances.'
  },
  {
    name: '--xds-client-accent',
    value: 'client-experience-plane',
    scope: 'workspace',
    description: 'Semantic token for client workspace consumption and notification affordances.'
  },
  {
    name: '--xds-notification-anchor-size',
    value: '2.5rem',
    scope: 'component',
    description: 'Shared anchor size for future notification bell and popover trigger.'
  }
] as const;

export class DesignTokenRegistry {
  private readonly tokens = new Map<string, DesignToken>();

  constructor(seedTokens: readonly DesignToken[] = CANVAS_0_DESIGN_TOKENS) {
    for (const token of seedTokens) {
      this.tokens.set(token.name, token);
    }
  }

  list(scope?: DesignTokenScope): readonly DesignToken[] {
    const tokens = Array.from(this.tokens.values());
    return scope ? tokens.filter((token) => token.scope === scope) : tokens;
  }

  get(name: string): DesignToken | undefined {
    return this.tokens.get(name);
  }

  upsert(token: DesignToken): readonly DesignToken[] {
    this.tokens.set(token.name, token);
    return this.list(token.scope);
  }

  require(name: string): DesignToken {
    const token = this.get(name);

    if (!token) {
      throw new Error(`Missing design token: ${name}`);
    }

    return token;
  }
}

export function createDesignTokenRegistry(seedTokens?: readonly DesignToken[]): DesignTokenRegistry {
  return new DesignTokenRegistry(seedTokens);
}
