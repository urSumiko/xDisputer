import type { SystemEventName, SystemEventPayload, SystemEventPayloadMap } from './types';

type SystemEventHandler<TName extends SystemEventName> = (payload: SystemEventPayload<TName>) => void;
type AnySystemEventHandler = (payload: SystemEventPayload<SystemEventName>) => void;

type HandlerRegistry = Partial<Record<SystemEventName, Set<AnySystemEventHandler>>>;

export type EventUnsubscribe = () => void;

export class SystemEventBus {
  private readonly handlers: HandlerRegistry = {};

  subscribe<TName extends SystemEventName>(
    eventName: TName,
    handler: SystemEventHandler<TName>
  ): EventUnsubscribe {
    const currentHandlers = this.handlers[eventName] ?? new Set<AnySystemEventHandler>();
    const storedHandler = handler as AnySystemEventHandler;

    currentHandlers.add(storedHandler);
    this.handlers[eventName] = currentHandlers;

    return () => {
      currentHandlers.delete(storedHandler);
      if (currentHandlers.size === 0) {
        delete this.handlers[eventName];
      }
    };
  }

  publish<TName extends SystemEventName>(eventName: TName, payload: SystemEventPayloadMap[TName]): void {
    const currentHandlers = this.handlers[eventName];

    if (!currentHandlers) {
      return;
    }

    Array.from(currentHandlers).forEach((handler) => {
      (handler as SystemEventHandler<TName>)(payload);
    });
  }

  clear(): void {
    for (const eventName of Object.keys(this.handlers) as SystemEventName[]) {
      delete this.handlers[eventName];
    }
  }
}

export function createSystemEventBus(): SystemEventBus {
  return new SystemEventBus();
}
