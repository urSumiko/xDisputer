'use client';

import type { ReactNode } from 'react';
import StableEmptyState from './StableEmptyState';

type PageState = 'loading' | 'empty' | 'ready' | 'saving' | 'error';

type PageStateBoundaryProps = {
  state: PageState;
  children: ReactNode;
  loading?: ReactNode;
  empty?: ReactNode;
  error?: ReactNode;
  saving?: ReactNode;
  className?: string;
};

function DefaultLoading() {
  return <div className="stable-skeleton-card" aria-busy="true"><span /><span /><span /></div>;
}

export default function PageStateBoundary({ state, children, loading, empty, error, saving, className = '' }: PageStateBoundaryProps) {
  if (state === 'loading') return <div className={`page-state-boundary ${className}`.trim()} data-page-state="loading">{loading || <DefaultLoading />}</div>;
  if (state === 'empty') return <div className={`page-state-boundary ${className}`.trim()} data-page-state="empty">{empty || <StableEmptyState title="Nothing to show yet" description="This section is ready and waiting for data." />}</div>;
  if (state === 'error') return <div className={`page-state-boundary ${className}`.trim()} data-page-state="error">{error || <StableEmptyState tone="error" title="This section could not load" description="Refresh the page or try again." />}</div>;
  if (state === 'saving') return <div className={`page-state-boundary ${className}`.trim()} data-page-state="saving">{saving || children}</div>;
  return <div className={`page-state-boundary ${className}`.trim()} data-page-state="ready">{children}</div>;
}
