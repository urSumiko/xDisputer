'use client';

import { useState } from 'react';

type Props = {
  inviteCode: string;
  inviteLink: string;
};

export default function ManagerInvitePanel({ inviteCode, inviteLink }: Props) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  async function copy(value: string, kind: 'code' | 'link') {
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return <section className="admin-monitor-card native-operation-card manager-invite-card" data-manager-invite-panel="stable">
    <div className="manager-invite-panel manager-invite-panel-v2">
      <div className="manager-invite-copy">
        <p>Invite code</p>
        <strong>{inviteCode || 'Not created'}</strong>
        <span>Share this short code when the full link is inconvenient.</span>
      </div>
      <div className="manager-invite-copy manager-invite-link-copy">
        <p>Invite link</p>
        <strong>{inviteLink || 'Create or rotate invite from the manager account.'}</strong>
        <span>New Disputers can use this link to request access under your manager workspace.</span>
      </div>
      <div className="manager-console-actions-row manager-console-top-actions manager-invite-actions">
        {inviteCode ? <button type="button" className="admin-action-button" onClick={() => void copy(inviteCode, 'code')}>{copied === 'code' ? 'Code copied' : 'Copy code'}</button> : null}
        {inviteLink ? <button type="button" className="admin-action-button" onClick={() => void copy(inviteLink, 'link')}>{copied === 'link' ? 'Link copied' : 'Copy link'}</button> : null}
        {inviteLink ? <a className="admin-action-button primary" href={inviteLink}>Open invite</a> : null}
        <form action="/api/manager/rotate-invite" method="post"><button type="submit" className="admin-action-button">Rotate code</button></form>
      </div>
    </div>
  </section>;
}
