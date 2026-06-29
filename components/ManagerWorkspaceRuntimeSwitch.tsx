'use client';

import { useEffect, useState } from 'react';

function isAdminOperationsPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin?') || pathname.startsWith('/admin/');
}

export default function ManagerWorkspaceRuntimeSwitch() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function sync() {
      const pathname = window.location.pathname;
      setVisible(isAdminOperationsPath(pathname));
    }

    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  if (!visible) return null;

  return <a
    href="/manager-workspace"
    className="manager-workspace-runtime-switch"
    data-manager-runtime-switch="true"
    aria-label="Open Manager Workspace"
  >
    <span>Switch mode</span>
    <strong>Manager Workspace</strong>
    <i aria-hidden="true">→</i>
    <style>{`
      .manager-workspace-runtime-switch {
        position: fixed;
        right: max(18px, env(safe-area-inset-right));
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 2147483647;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas: 'eyebrow arrow' 'title arrow';
        align-items: center;
        gap: 2px 14px;
        min-width: min(310px, calc(100vw - 32px));
        padding: 14px 16px;
        border-radius: 18px;
        color: #eff6ff;
        text-decoration: none;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        box-shadow: 0 22px 54px rgba(15, 23, 42, .28), 0 0 0 1px rgba(255,255,255,.18) inset;
        transform: translateZ(0);
      }
      .manager-workspace-runtime-switch span {
        grid-area: eyebrow;
        font-size: 11px;
        font-weight: 850;
        letter-spacing: .13em;
        text-transform: uppercase;
        color: rgba(239,246,255,.82);
      }
      .manager-workspace-runtime-switch strong {
        grid-area: title;
        font-size: 15px;
        line-height: 1.1;
        letter-spacing: -.025em;
      }
      .manager-workspace-runtime-switch i {
        grid-area: arrow;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: #1d4ed8;
        background: #eff6ff;
        font-style: normal;
        font-weight: 950;
      }
      .manager-workspace-runtime-switch:hover,
      .manager-workspace-runtime-switch:focus-visible {
        transform: translateY(-2px);
        box-shadow: 0 26px 64px rgba(15, 23, 42, .34), 0 0 0 1px rgba(255,255,255,.2) inset;
      }
    `}</style>
  </a>;
}
