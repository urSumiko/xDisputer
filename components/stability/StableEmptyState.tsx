'use client';

import type { ReactNode } from 'react';

type StableEmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'info' | 'warning' | 'error' | 'success';
  className?: string;
};

export default function StableEmptyState(props: StableEmptyStateProps) {
  const { title, description, actions, tone = 'neutral', className = '' } = props;
  return (
    <div className={`stable-empty-state stable-empty-${tone} ${className}`.trim()}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="stable-empty-actions">{actions}</div> : null}
    </div>
  );
}
