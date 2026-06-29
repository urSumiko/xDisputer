'use client';

import type { ReactNode } from 'react';

type StableCardTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

type StableCardProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: StableCardTone;
  className?: string;
  state?: 'loading' | 'empty' | 'ready' | 'saving' | 'error';
};

export default function StableCard({ eyebrow, title, description, actions, children, tone = 'neutral', className = '', state = 'ready' }: StableCardProps) {
  return (
    <section className={`stable-card stable-card-${tone} ${className}`.trim()} data-stable-state={state}>
      <header className="stable-card-header">
        <div className="stable-card-copy">
          {eyebrow ? <p className="stable-card-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="stable-card-description">{description}</p> : null}
        </div>
        {actions ? <div className="stable-card-actions">{actions}</div> : null}
      </header>
      {children ? <div className="stable-card-body">{children}</div> : null}
    </section>
  );
}
