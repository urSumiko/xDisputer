'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  email?: string | null;
  displayName?: string | null;
};

function displayNameFromIdentity(displayName?: string | null, email?: string | null) {
  const clean = displayName?.trim().replace(/\s+/g, ' ');
  if (clean) return clean;
  return email?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Client account';
}

export default function ClientMenuPopover({ email, displayName }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const resolvedDisplayName = displayNameFromIdentity(displayName, email);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return <div ref={rootRef} className="client-menu-root" data-client-menu-popover="true" data-client-menu-state={open ? 'open' : 'closed'}>
    <button type="button" className="topbar-icon-button client-menu-button" aria-haspopup="dialog" aria-expanded={open} aria-controls="xdisputer-client-menu-popover" aria-label="Open client workspace menu" onClick={() => setOpen((value) => !value)}>Menu</button>
    {open ? <div id="xdisputer-client-menu-popover" className="client-menu-popover" role="dialog" aria-label="Client workspace menu">
      <div className="client-menu-popover-topline"><span>{resolvedDisplayName}</span><button type="button" aria-label="Close client menu" onClick={() => setOpen(false)}>Close</button></div>
      <a href="/workspace">Workspace</a>
      <a href="/account-pending">Account status</a>
    </div> : null}
  </div>;
}
