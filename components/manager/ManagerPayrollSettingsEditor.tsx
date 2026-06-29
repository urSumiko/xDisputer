'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type EmploymentType = 'full_time' | 'output_based';

type Props = {
  profileId: string;
  initialEmploymentType: EmploymentType;
  initialBaseSalary: number;
  initialPerOutputRate: number;
  initialNotes?: string | null;
};

const METADATA_CARD_SELECTOR = '.manager-console-user-card';

function moneyInput(value: number) {
  return Number.isFinite(value) ? String(Math.max(0, value)) : '0';
}

const CARD_CLICK_BLOCKERS = [
  'a',
  'button',
  'form',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  'details',
  '[data-ignore-card-metadata-open="true"]',
  '.manager-console-status-actions',
  '.manager-user-settings-details',
  '.manager-user-settings-modal-backdrop'
].join(',');

function shouldIgnoreCardOpen(target: EventTarget | null, card: HTMLElement) {
  if (!(target instanceof HTMLElement)) return true;

  const blocker = target.closest<HTMLElement>(CARD_CLICK_BLOCKERS);
  if (blocker && blocker !== card) return true;

  const nestedButtonRole = target.closest<HTMLElement>('[role="button"]');
  return Boolean(nestedButtonRole && nestedButtonRole !== card);
}

export default function ManagerPayrollSettingsEditor({ profileId, initialEmploymentType, initialBaseSalary, initialPerOutputRate, initialNotes }: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(initialEmploymentType);
  const [fullTimeSalary, setFullTimeSalary] = useState(moneyInput(initialBaseSalary));
  const salaryLocked = employmentType === 'output_based';

  useEffect(() => {
    const root = rootRef.current;
    const card = root?.closest<HTMLElement>(METADATA_CARD_SELECTOR);
    if (!card) return undefined;

    const previousTabIndex = card.getAttribute('tabindex');
    const previousRole = card.getAttribute('role');
    const previousAriaLabel = card.getAttribute('aria-label');
    const hadTabIndex = card.hasAttribute('tabindex');
    const hadRole = card.hasAttribute('role');
    const hadAriaLabel = card.hasAttribute('aria-label');

    card.classList.add('manager-metadata-card-trigger');
    card.setAttribute('data-metadata-card-trigger', 'true');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Open user metadata settings');
    if (!hadTabIndex) card.setAttribute('tabindex', '0');

    const handleCardClick = (event: MouseEvent) => {
      if (shouldIgnoreCardOpen(event.target, card)) return;
      setOpen(true);
    };

    const handleCardKeyDown = (event: KeyboardEvent) => {
      if (event.target !== card) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      setOpen(true);
    };

    card.addEventListener('click', handleCardClick);
    card.addEventListener('keydown', handleCardKeyDown);

    return () => {
      card.removeEventListener('click', handleCardClick);
      card.removeEventListener('keydown', handleCardKeyDown);
      card.classList.remove('manager-metadata-card-trigger');
      card.removeAttribute('data-metadata-card-trigger');
      if (hadRole && previousRole !== null) card.setAttribute('role', previousRole); else card.removeAttribute('role');
      if (hadAriaLabel && previousAriaLabel !== null) card.setAttribute('aria-label', previousAriaLabel); else card.removeAttribute('aria-label');
      if (hadTabIndex && previousTabIndex !== null) card.setAttribute('tabindex', previousTabIndex);
      if (!hadTabIndex) card.removeAttribute('tabindex');
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const modal = <div className="manager-user-settings-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
    <form action="/api/manager-console/payroll" method="post" className="manager-user-settings-form manager-user-settings-modal" role="dialog" aria-modal="true" aria-label="User metadata settings" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="metadata-modal-close" aria-label="Close metadata editor" onClick={() => setOpen(false)}>×</button>
      <input type="hidden" name="profileId" value={profileId} />
      <label className="client-status-job-field" htmlFor={`${id}-employment`}>
        <span>Client status / job description</span>
        <select
          id={`${id}-employment`}
          name="employmentType"
          value={employmentType}
          onChange={(event) => {
            const next = event.target.value === 'output_based' ? 'output_based' : 'full_time';
            setEmploymentType(next);
          }}
        >
          <option value="full_time">Full-time</option>
          <option value="output_based">Per-output</option>
        </select>
      </label>
      <label className="manager-user-settings-notes" htmlFor={`${id}-notes`}>
        <span>Note</span>
        <input id={`${id}-notes`} name="notes" defaultValue={initialNotes || ''} placeholder="Optional manager note" />
      </label>
      <p className="metadata-rule-hint">Per-output users require manager confirmation for every generated output. Full-time users keep fixed salary and can receive confirmed per-output add-ons.</p>
      {salaryLocked && <input type="hidden" name="baseSalary" value="0" />}
      <label className={`metadata-salary-field ${salaryLocked ? 'is-locked' : ''}`} htmlFor={`${id}-salary`}>
        <span>Salary</span>
        <input
          id={`${id}-salary`}
          name="baseSalary"
          inputMode="decimal"
          value={salaryLocked ? '0' : fullTimeSalary}
          disabled={salaryLocked}
          aria-disabled={salaryLocked}
          placeholder={salaryLocked ? 'Blocked for per-output profile' : undefined}
          onChange={(event) => setFullTimeSalary(event.target.value)}
        />
        <small>{salaryLocked ? 'Blocked because this client is per-output only.' : 'Fixed salary for full-time profile.'}</small>
      </label>
      <label className="metadata-output-rate-field" htmlFor={`${id}-rate`}>
        <span>Output per rate</span>
        <input id={`${id}-rate`} name="perOutputRate" inputMode="decimal" defaultValue={moneyInput(initialPerOutputRate)} />
      </label>
      <button type="submit" className="admin-action-button primary">Save metadata</button>
    </form>
  </div>;

  return <div ref={rootRef} className="manager-user-settings-details manager-user-settings-client-modal manager-user-settings-card-trigger-only" data-ignore-card-metadata-open="true" aria-hidden="true">
    {open && typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
  </div>;
}
