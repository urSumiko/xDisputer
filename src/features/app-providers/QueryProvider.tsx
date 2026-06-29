'use client';

import { createContext, useMemo, type ReactNode } from 'react';

type QueryProviderState = {
  provider: 'xdisputer-query-foundation';
  tanstackReady: boolean;
  staleTimeMs: number;
};

export const QueryProviderContext = createContext<QueryProviderState>({
  provider: 'xdisputer-query-foundation',
  tanstackReady: false,
  staleTimeMs: 30_000
});

export default function QueryProvider({ children }: { children: ReactNode }) {
  const value = useMemo<QueryProviderState>(() => ({
    provider: 'xdisputer-query-foundation',
    tanstackReady: false,
    staleTimeMs: 30_000
  }), []);

  return <QueryProviderContext.Provider value={value}>{children}</QueryProviderContext.Provider>;
}
