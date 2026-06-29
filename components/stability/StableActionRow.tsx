'use client';

import type { ReactNode } from 'react';

type StableActionRowProps = {
  children: ReactNode;
  align?: 'start' | 'end' | 'between';
  className?: string;
};

export default function StableActionRow({ children, align = 'end', className = '' }: StableActionRowProps) {
  return <div className={`stable-action-row stable-action-${align} ${className}`.trim()}>{children}</div>;
}
