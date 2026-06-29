export type PerformanceProfileId = 'staticGlobal' | 'sessionPrivate' | 'workspaceLive' | 'noStore';

export type PerformanceProfile = {
  id: PerformanceProfileId;
  serverFirst: boolean;
  clientIslandOnly: boolean;
  streamed: boolean;
  cacheHint: 'static' | 'private' | 'live' | 'none';
  summary: string;
};

export const performanceProfiles: Record<PerformanceProfileId, PerformanceProfile> = {
  staticGlobal: {
    id: 'staticGlobal',
    serverFirst: true,
    clientIslandOnly: false,
    streamed: false,
    cacheHint: 'static',
    summary: 'Global config that can be reused broadly.'
  },
  sessionPrivate: {
    id: 'sessionPrivate',
    serverFirst: true,
    clientIslandOnly: false,
    streamed: true,
    cacheHint: 'private',
    summary: 'Signed-in account data rendered from the server boundary.'
  },
  workspaceLive: {
    id: 'workspaceLive',
    serverFirst: true,
    clientIslandOnly: true,
    streamed: true,
    cacheHint: 'live',
    summary: 'Workspace data with small interactive islands.'
  },
  noStore: {
    id: 'noStore',
    serverFirst: true,
    clientIslandOnly: true,
    streamed: true,
    cacheHint: 'none',
    summary: 'Fresh operation state or generated document state.'
  }
} as const;

export function getPerformanceProfile(id: PerformanceProfileId): PerformanceProfile {
  return performanceProfiles[id];
}
