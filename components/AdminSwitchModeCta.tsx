'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSwitchModeCta() {
  const pathname = usePathname();
  if (!pathname?.startsWith('/admin')) return null;

  return <Link
    href="/manager-workspace"
    data-manager-canonical-switch="true"
    data-manager-switch-visible-slot="fixed-admin-failsafe"
    data-manager-switch-target="/manager-workspace"
    data-manager-switch-target-label="Manager workspace"
    aria-label="Switch mode to Manager workspace"
    style={{
      position: 'fixed',
      left: 24,
      top: 204,
      zIndex: 2147483000,
      width: 258,
      minHeight: 64,
      display: 'grid',
      gridTemplateColumns: '14px minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: 12,
      padding: '14px 15px',
      borderRadius: 20,
      color: '#fff',
      textDecoration: 'none',
      background: 'linear-gradient(135deg, #111827 0%, #2563eb 48%, #7c3aed 100%)',
      border: '1px solid rgba(255,255,255,.32)',
      boxShadow: '0 18px 38px rgba(37, 99, 235, .38)',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      visibility: 'visible',
      opacity: 1
    }}
  >
    <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: '#bbf7d0', boxShadow: '0 0 0 5px rgba(187,247,208,.18)' }} />
    <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
      <strong style={{ fontSize: 13, lineHeight: 1.05, letterSpacing: '.04em', textTransform: 'uppercase' }}>Switch mode</strong>
      <small style={{ color: 'rgba(255,255,255,.92)', fontSize: 12, lineHeight: 1.2 }}>Manager workspace</small>
    </span>
    <span aria-hidden="true" style={{ color: 'rgba(255,255,255,.96)', fontWeight: 950, fontSize: 18 }}>→</span>
  </Link>;
}
