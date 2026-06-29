'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import NotificationDock from '../notifications/OwnedNotificationDock';

type ConsoleRole = 'manager' | 'master' | 'client';
type ConsoleMode = 'operations' | 'workspace';

type Props = {
  role: ConsoleRole;
  mode: ConsoleMode;
  email?: string | null;
  displayName?: string | null;
  accountLabel: string;
  switchTarget: string;
  switchTargetLabel: string;
};

function cleanDisplayName(value?: string | null) {
  return value?.trim().replace(/\s+/g, ' ') || '';
}

function initialFromDisplayName(value?: string | null) {
  const clean = cleanDisplayName(value);
  if (!clean) return 'x';
  return clean[0]?.toLowerCase() || 'x';
}

function displayNameFromIdentity(displayName?: string | null, email?: string | null) {
  const explicit = cleanDisplayName(displayName);
  if (explicit) return explicit;
  const value = email?.trim();
  if (!value) return 'Signed-in account';
  const localPart = value.split('@')[0] || value;
  return localPart.replace(/[._-]+/g, ' ');
}

function roleLabel(role: ConsoleRole, mode: ConsoleMode) {
  if (role === 'client') return 'Client workspace account';
  if (role === 'master') return mode === 'workspace' ? 'Master UI workspace account' : 'Master governance account';
  return mode === 'workspace' ? 'Manager workspace account' : 'Manager operations account';
}

function surfaceLabel(role: ConsoleRole, mode: ConsoleMode) {
  if (role === 'client') return 'Client packet workspace';
  if (role === 'master') return mode === 'workspace' ? 'UI workspace control' : 'Governance monitoring';
  return mode === 'workspace' ? 'Workspace authoring' : 'Operations monitoring';
}

function displayNameFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  if (params.get('account_settings') !== 'saved') return '';
  return cleanDisplayName(params.get('account_settings_name'));
}

export default function AccountMenu({ role, mode, email, displayName, accountLabel }: Props) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(() => displayNameFromIdentity(displayName, email));
  const popoverId = useMemo(() => `xdisputer-account-popover-${role}-${mode}`, [role, mode]);
  const resolvedDisplayName = useMemo(() => displayNameFromIdentity(localDisplayName || displayName, email), [localDisplayName, displayName, email]);
  const initial = useMemo(() => initialFromDisplayName(resolvedDisplayName), [resolvedDisplayName]);
  const safeNext = pathname || '/';

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const nextName = displayNameFromIdentity(displayName, email);
    setLocalDisplayName((current) => cleanDisplayName(current) || nextName);
  }, [displayName, email]);

  useEffect(() => {
    const savedName = displayNameFromUrl();
    if (savedName) setLocalDisplayName(savedName);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return <div ref={rootRef} className="manager-header-account-dock" data-console-component="AccountMenu" data-console-account-menu="true" data-console-account-role={role} data-console-mode={mode} data-manager-account-menu="true" data-manager-account-anchor="header-ratio-grid" data-manager-account-layout="compact-sticky-bell-avatar-row" data-manager-account-state={open ? 'open' : 'closed'} data-manager-account-popover-align="same-rail">
    <NotificationDock />
    <button type="button" className="manager-header-account-avatar" aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} aria-label={`Open ${accountLabel} account settings`} onClick={() => setOpen((value) => !value)}>{initial}</button>
    {open ? <div id={popoverId} className="manager-account-popover" data-console-account-popover="true" data-manager-account-popover="true" data-manager-account-popover-align="same-rail" role="dialog" aria-label={`${accountLabel} settings`}>
      <div className="manager-account-popover-topline"><span>{email || accountLabel}</span><button type="button" className="manager-account-close" aria-label="Close account settings" onClick={() => setOpen(false)}>×</button></div>
      <section className="manager-account-identity-panel"><div className="manager-account-avatar-large" aria-hidden="true">{initial}</div><h2>{resolvedDisplayName}</h2><p>{roleLabel(role, mode)}</p></section>
      <section className="manager-account-function-panel" aria-label="Current account context">
        <div><strong>Current surface</strong><span>{surfaceLabel(role, mode)}</span></div>
        <div><strong>Access role</strong><span>{role}</span></div>
        <div><strong>Account email</strong><span>{email || 'Not available'}</span></div>
      </section>
      <form className="manager-account-settings-form" action="/api/account/profile" method="post">
        <input type="hidden" name="next" value={safeNext} />
        <label><span>Display name</span><input name="full_name" defaultValue={resolvedDisplayName} maxLength={120} placeholder="Account display name" /></label>
        <button type="submit">Save account settings</button>
      </form>
      <section className="manager-account-session-panel" aria-label="Session security"><div><strong>Session security</strong><span>End the active browser session for this account.</span></div><form className="manager-account-signout" action="/auth/sign-out" method="post"><button type="submit">Sign out securely</button></form></section>
    </div> : null}
  </div>;
}
