'use client';

import { useState } from 'react';

function messageFromRedirect(url: string) {
  try {
    const target = new URL(url);
    const control = target.searchParams.get('control');
    const message = target.searchParams.get('message');

    return {
      ok: control !== 'error',
      message: message || null
    };
  } catch {
    return { ok: true, message: null };
  }
}

export default function OptimisticControlForm({
  profileId,
  intent,
  label,
  primary = false,
  successLabel = 'Updated'
}: {
  profileId: string;
  intent: string;
  label: string;
  primary?: boolean;
  successLabel?: string;
}) {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'pending') return;

    setState('pending');
    setMessage('');

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/control/profile', {
        method: 'POST',
        body: formData
      });

      const redirected = messageFromRedirect(response.url);

      if (!response.ok || !redirected.ok) {
        throw new Error(redirected.message || 'Action failed.');
      }

      setState('success');
      setMessage(redirected.message || successLabel);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Action failed.');
    }
  }

  return (
    <form action="/api/control/profile" method="post" onSubmit={submit} className="optimistic-control-form">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className={`admin-action-button ${primary ? 'primary' : ''}`} disabled={state === 'pending'}>
        {state === 'pending' ? `${label}...` : state === 'success' ? successLabel : label}
      </button>
      {message && <span className={`admin-control-note ${state}`}>{message}</span>}
    </form>
  );
}
