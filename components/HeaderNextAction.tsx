'use client';

import type { HeaderNextAction as HeaderNextActionModel } from '../lib/next-action-contract';

type Props = {
  action: HeaderNextActionModel;
  status?: string;
  statusTone?: 'info' | 'success' | 'error';
};

export default function HeaderNextAction({ action, status, statusTone = 'info' }: Props) {
  const hasStatus = Boolean(status?.trim());

  return (
    <div
      className={`header-next-action ${action.state} ${hasStatus ? `with-status ${statusTone}` : ''}`}
      aria-label={`Next workflow action: ${action.progressLabel}, ${action.title}. ${action.detail}`}
    >
      <span className="runtime-chip-dot" aria-hidden="true" />
      <span className="runtime-chip-label">{action.progressLabel}</span>
      <span className="runtime-chip-title">{action.title}</span>
      <span className="runtime-chip-detail">{action.detail}</span>
    </div>
  );
}
