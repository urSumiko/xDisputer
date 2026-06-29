'use client';

import { useEffect } from 'react';

const WORKSPACE_PREFERENCES_KEY = 'lettergenerator-workspace-preferences-v1';

type PayrollProfile = {
  employmentType: 'full_time' | 'output_based';
  isOutputBased: boolean;
  isFullTime: boolean;
};

function readPreferences() {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_PREFERENCES_KEY) || '{}') as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function writePerOutputDefault(value: boolean) {
  const current = readPreferences();
  if (current.perOutputGenerationDefault === value) return;
  localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify({ ...current, perOutputGenerationDefault: value }));
}

function normalizeProfile(payload: unknown): PayrollProfile | null {
  if (!payload || typeof payload !== 'object' || !('profile' in payload)) return null;
  const profile = (payload as { profile?: Partial<PayrollProfile> }).profile;
  if (!profile) return null;
  const employmentType = profile.employmentType === 'output_based' ? 'output_based' : 'full_time';
  return { employmentType, isOutputBased: employmentType === 'output_based', isFullTime: employmentType === 'full_time' };
}

function setText(node: Element | null, value: string) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setCardHidden(card: HTMLElement, hidden: boolean) {
  if (card.hidden !== hidden) card.hidden = hidden;
  if (hidden) {
    if (card.getAttribute('aria-hidden') !== 'true') card.setAttribute('aria-hidden', 'true');
    if (card.style.display !== 'none') card.style.display = 'none';
  } else {
    if (card.hasAttribute('aria-hidden')) card.removeAttribute('aria-hidden');
    if (card.style.display) card.style.removeProperty('display');
  }
}

function setInputLocked(input: HTMLInputElement | null, checked: boolean | null, disabled: boolean) {
  if (!input) return;
  if (checked !== null && input.checked !== checked) input.checked = checked;
  if (input.disabled !== disabled) input.disabled = disabled;
  if (disabled) {
    if (input.getAttribute('aria-disabled') !== 'true') input.setAttribute('aria-disabled', 'true');
  } else if (input.hasAttribute('aria-disabled')) {
    input.removeAttribute('aria-disabled');
  }
}

function syncClientIntentCard(profile: PayrollProfile) {
  const card = document.querySelector<HTMLElement>('[data-output-activity-client-intent="true"]');
  if (!card) return;

  if (card.dataset.clientOutputProfile !== profile.employmentType) card.dataset.clientOutputProfile = profile.employmentType;
  const title = card.querySelector('strong');
  const copy = card.querySelector('p');
  const input = card.querySelector<HTMLInputElement>('input[type="checkbox"]');
  const labelText = card.querySelector('label span');

  if (profile.isOutputBased) {
    card.classList.add('locked');
    card.classList.remove('optional');
    setCardHidden(card, true);
    setText(title, 'Per-output profile');
    setText(copy, 'Every generated letter is automatically sent for manager confirmation.');
    setInputLocked(input, true, true);
    setText(labelText, 'Per-output required');
    return;
  }

  setCardHidden(card, false);
  card.classList.add('optional');
  card.classList.remove('locked');
  setText(title, 'Full-time per-output add-on');
  setText(copy, 'Your profile is full-time. Generate as fixed-salary work by default, or mark this packet as a per-output add-on for manager confirmation.');
  setInputLocked(input, null, false);
  setText(labelText, 'Make this packet per-output');
}

export default function ClientPayrollProfileSyncMount() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let profileCache: PayrollProfile | null = null;
    let raf = 0;

    const scheduleCardSync = () => {
      if (!profileCache || cancelled || raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!cancelled && profileCache) syncClientIntentCard(profileCache);
      });
    };

    async function sync() {
      const response = await fetch('/api/client/payroll-profile', { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-store' } });
      if (!response.ok) return;
      const profile = normalizeProfile(await response.json().catch(() => null));
      if (!profile || cancelled) return;

      profileCache = profile;
      if (document.body.dataset.clientPayrollEmploymentType !== profile.employmentType) {
        document.body.dataset.clientPayrollEmploymentType = profile.employmentType;
      }
      if (profile.isOutputBased) writePerOutputDefault(true);
      syncClientIntentCard(profile);

      if (!observer) {
        observer = new MutationObserver((mutations) => {
          if (!mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) => node instanceof HTMLElement && (node.matches?.('[data-output-activity-client-intent="true"]') || Boolean(node.querySelector?.('[data-output-activity-client-intent="true"]')))))) return;
          scheduleCardSync();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }

    void sync().catch(() => undefined);

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  return null;
}
