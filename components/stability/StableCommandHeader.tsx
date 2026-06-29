'use client';

import type { ReactNode } from 'react';

type StableCommandHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function StableCommandHeader({ eyebrow, title, description, actions, className = '' }: StableCommandHeaderProps) {
  return (
    <header className={`stable-command-header ${className}`.trim()}>
      <div className="stable-command-copy">
        {eyebrow ? <p className="stable-command-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="stable-command-description">{description}</p> : null}
      </div>
      {actions ? <div className="stable-command-actions">{actions}</div> : null}
    </header>
  );
}
