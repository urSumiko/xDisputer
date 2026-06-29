'use client';

import type { UserFacingError } from '../lib/user-facing-error';

type Props = {
  issue: UserFacingError | null;
  onClose: () => void;
  onNavigate?: (panel: NonNullable<UserFacingError['suggestedPanel']>) => void;
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  display: 'flex',
  justifyContent: 'flex-end',
  background: 'rgba(8,20,41,.30)',
  backdropFilter: 'blur(2px)'
} as const;

const panelStyle = {
  width: 'min(520px, calc(100vw - 28px))',
  height: '100%',
  padding: '26px',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  background: 'var(--surface)',
  color: 'var(--text)',
  boxShadow: '-24px 0 70px rgba(8,20,41,.22)',
  overflowY: 'auto'
} as const;

const chipStyle = {
  width: 'fit-content',
  padding: '6px 10px',
  borderRadius: '999px',
  background: 'var(--danger-soft)',
  color: 'var(--danger)',
  fontSize: '11px',
  fontWeight: 760,
  letterSpacing: '.12em',
  textTransform: 'uppercase'
} as const;

const actionStyle = {
  minHeight: '44px',
  borderRadius: '12px',
  padding: '10px 14px',
  color: '#fff',
  background: 'var(--text)',
  fontWeight: 700
} as const;

const secondaryStyle = {
  minHeight: '44px',
  borderRadius: '12px',
  padding: '10px 14px',
  color: 'var(--text)',
  background: 'var(--surface-hover)',
  fontWeight: 700
} as const;

export default function UserErrorFlyout({ issue, onClose, onNavigate }: Props) {
  if (!issue) return null;

  return <div style={overlayStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="user-error-title" aria-describedby="user-error-main-cause">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <p style={chipStyle}>{issue.category} · {issue.severity}</p>
          <h2 id="user-error-title" style={{ marginTop: 14, fontSize: 28, lineHeight: 1.04, letterSpacing: '-.04em' }}>{issue.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close error details" style={{ ...secondaryStyle, minWidth: 44, padding: 0 }}>×</button>
      </div>

      <section style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--danger-soft)' }}>
        <strong style={{ display: 'block', color: 'var(--danger)', marginBottom: 8 }}>{issue.headline}</strong>
        <p id="user-error-main-cause" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>{issue.mainCause}</p>
      </section>

      <section>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>What to do next</h3>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, color: 'var(--text-soft)', lineHeight: 1.5 }}>
          {issue.whatToDo.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <details style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 14, background: 'var(--surface-subtle)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Technical details</summary>
        <pre style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text-soft)', fontSize: 12, lineHeight: 1.45 }}>{issue.technicalDetails}</pre>
      </details>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
        {issue.suggestedPanel && onNavigate && <button type="button" style={actionStyle} onClick={() => onNavigate(issue.suggestedPanel!)}>Open {issue.suggestedPanel}</button>}
        <button type="button" style={secondaryStyle} onClick={onClose}>Close</button>
      </div>
    </aside>
  </div>;
}
