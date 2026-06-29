'use client';

import { memo, type CSSProperties, type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  eyebrow: string;
  title: string;
  summary: string;
  actionLabel?: string;
  trigger?: ReactNode;
  triggerClassName?: string;
  headerAction?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
};

type ViewportSize = {
  width: number;
  height: number;
};

function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function TableFlyout({
  eyebrow,
  title,
  summary,
  actionLabel = 'Manage',
  trigger,
  triggerClassName,
  headerAction,
  closeLabel = 'Close',
  children
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
    setViewport(getViewportSize());
  }, []);

  useEffect(() => {
    if (!open) return;

    function onResize() {
      setViewport(getViewportSize());
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    onResize();
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isWideConsole = viewport.width >= 980;
  const isShortScreen = viewport.height > 0 && viewport.height < 720;
  const sidebarOffset = isWideConsole ? 260 : 0;

  const overlayStyle = useMemo<CSSProperties>(() => ({
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: sidebarOffset,
    zIndex: 90,
    display: 'flex',
    alignItems: isShortScreen ? 'flex-start' : 'center',
    justifyContent: 'center',
    padding: isWideConsole ? '24px 48px' : '12px',
    background: 'transparent',
    backdropFilter: 'none',
    pointerEvents: 'auto'
  }), [isShortScreen, isWideConsole, sidebarOffset]);

  const cardStyle = useMemo<CSSProperties>(() => ({
    width: isWideConsole ? 'min(760px, calc(100vw - 360px))' : 'min(94vw, 720px)',
    maxHeight: isShortScreen ? 'calc(100dvh - 24px)' : 'min(720px, calc(100dvh - 64px))',
    overflow: 'hidden',
    border: '2px solid rgba(37, 99, 235, .44)',
    borderRadius: 24,
    background: '#fff',
    boxShadow: '0 30px 90px rgba(15, 23, 42, .26), 0 0 0 5px rgba(37, 99, 235, .10)'
  }), [isShortScreen, isWideConsole]);

  const bodyStyle = useMemo<CSSProperties>(() => ({
    maxHeight: isShortScreen ? 'calc(100dvh - 135px)' : 'min(560px, calc(100dvh - 190px))',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch'
  }), [isShortScreen]);

  const headerActionNode = headerAction ? <span key="table-flyout-header-action" className="table-flyout-header-action-slot">{headerAction}</span> : null;
  const closeNode = <button key="table-flyout-close" type="button" className="table-flyout-close danger" onClick={() => setOpen(false)} aria-label={closeLabel}>×</button>;

  const flyout = open ? <div className="table-flyout-overlay table-flyout-overlay-clear" style={overlayStyle} role="presentation" onMouseDown={() => setOpen(false)}>
    <section className="table-flyout-card table-flyout-card-live table-flyout-card-active" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header className="table-flyout-main-header" style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '1px solid #e3e9f2' }}>
        <div>
          <p>{eyebrow}</p>
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="table-flyout-header-actions">
          {headerActionNode}
          {closeNode}
        </div>
      </header>
      <div className="table-flyout-body" style={bodyStyle}>
        {children}
      </div>
    </section>
  </div> : null;

  return <>
    <button type="button" className={`table-flyout-summary-card ${triggerClassName || ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
      {trigger || <><span>{summary}</span><small>{actionLabel}</small></>}
    </button>
    {mounted && flyout ? createPortal(flyout, document.body) : null}
  </>;
}

export default memo(TableFlyout);
