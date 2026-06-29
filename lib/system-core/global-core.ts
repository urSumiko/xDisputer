import { ComponentIdentityRegistry, createComponentIdentityRegistry } from './component-registry';
import { createDesignTokenRegistry, DesignTokenRegistry } from './design-tokens';
import { createSystemEventBus, SystemEventBus } from './event-bus';
import { getPermissionsForRole } from './rbac';
import { createWorkspaceContext, validateWorkspaceContext } from './workspace';
import type {
  AuthenticatedActor,
  ComponentIdentity,
  DesignToken,
  SystemCoreSnapshot,
  WorkspaceContext
} from './types';

export type SystemCoreInput = {
  readonly actor: AuthenticatedActor;
  readonly workspace?: WorkspaceContext;
  readonly designTokens?: readonly DesignToken[];
  readonly components?: readonly ComponentIdentity[];
};

export type PropagationResult = {
  readonly propagationGroup: string;
  readonly affectedComponentIds: readonly string[];
};

export class SystemCore {
  readonly events: SystemEventBus;
  readonly designTokens: DesignTokenRegistry;
  readonly components: ComponentIdentityRegistry;

  private workspaceContext: WorkspaceContext;

  constructor(input: SystemCoreInput) {
    this.events = createSystemEventBus();
    this.designTokens = createDesignTokenRegistry(input.designTokens);
    this.components = createComponentIdentityRegistry(input.components);
    this.workspaceContext = input.workspace ?? createWorkspaceContext({ actor: input.actor });

    const decision = validateWorkspaceContext(this.workspaceContext);
    if (!decision.allowed) {
      this.events.publish('rbac.permission.denied', {
        actor: this.workspaceContext.actor,
        permission: `read:${this.workspaceContext.workspaceKind}_workspace`,
        reason: decision.reason
      });
    }
  }

  get workspace(): WorkspaceContext {
    return this.workspaceContext;
  }

  setWorkspace(next: WorkspaceContext): void {
    const decision = validateWorkspaceContext(next);

    if (!decision.allowed) {
      this.events.publish('rbac.permission.denied', {
        actor: next.actor,
        permission: `read:${next.workspaceKind}_workspace`,
        reason: decision.reason
      });
      throw new Error(decision.reason);
    }

    const previous = this.workspaceContext;
    this.workspaceContext = next;
    this.events.publish('workspace.context.changed', { previous, next });
  }

  upsertDesignToken(token: DesignToken): void {
    this.designTokens.upsert(token);
    this.events.publish('design.tokens.changed', {
      scope: token.scope,
      tokenNames: [token.name]
    });
  }

  registerComponent(component: ComponentIdentity): void {
    const operation = this.components.register(component);
    this.events.publish('component.registry.changed', {
      componentId: component.id,
      operation
    });
  }

  propagateGlobalRule(propagationGroup: string): PropagationResult {
    const affectedComponentIds = this.components
      .list({ propagationGroup })
      .map((component) => component.id);

    this.events.publish('global.rule.propagated', {
      source: 'global',
      propagationGroup,
      affectedComponentIds
    });

    return { propagationGroup, affectedComponentIds };
  }

  snapshot(): SystemCoreSnapshot {
    return {
      workspace: this.workspaceContext,
      permissions: getPermissionsForRole(this.workspaceContext.actor.role),
      designTokens: this.designTokens.list(),
      components: this.components.list()
    };
  }
}

export function createSystemCore(input: SystemCoreInput): SystemCore {
  return new SystemCore(input);
}
