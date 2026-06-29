'use client';

import { useEffect } from 'react';
import { useOwnedNotifications } from '../../src/features/notifications/useOwnedNotifications';

const OUTPUT_ACTIVITY_HREF = '/admin/output-activity-v2';

function outputActivityTargets() {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href^="${OUTPUT_ACTIVITY_HREF}"],a[href*="${OUTPUT_ACTIVITY_HREF}"]`))
    .filter((target) => target.textContent?.toLowerCase().includes('output activity'));
}

function clearBadges() {
  document.querySelectorAll('[data-output-activity-unread-badge="true"]').forEach((node) => node.remove());
  document.querySelectorAll('[data-output-activity-unread-count]').forEach((node) => node.removeAttribute('data-output-activity-unread-count'));
}

function badgesAlreadyApplied(targets: HTMLAnchorElement[], count: number) {
  if (count < 1) return document.querySelectorAll('[data-output-activity-unread-badge="true"]').length === 0;
  if (targets.length < 1) return false;
  return targets.every((target) => target.dataset.outputActivityUnreadCount === String(count) && target.querySelector('[data-output-activity-unread-badge="true"]')?.textContent === (count > 9 ? '9+' : String(count)));
}

function applyBadge(count: number) {
  const targets = outputActivityTargets();
  if (badgesAlreadyApplied(targets, count)) return;
  clearBadges();
  if (count < 1) return;

  for (const target of targets) {
    target.dataset.outputActivityUnreadCount = String(count);
    const badge = document.createElement('span');
    badge.dataset.outputActivityUnreadBadge = 'true';
    badge.textContent = count > 9 ? '9+' : String(count);
    target.appendChild(badge);
  }
}

function mutationAddsOutputActivityTarget(mutation: MutationRecord) {
  return Array.from(mutation.addedNodes).some((node) => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.matches?.(`a[href^="${OUTPUT_ACTIVITY_HREF}"],a[href*="${OUTPUT_ACTIVITY_HREF}"]`)) return true;
    return Boolean(node.querySelector?.(`a[href^="${OUTPUT_ACTIVITY_HREF}"],a[href*="${OUTPUT_ACTIVITY_HREF}"]`));
  });
}

export default function OutputActivityUnreadBadgeMount() {
  const { outputActivityUnreadCount } = useOwnedNotifications();

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        applyBadge(outputActivityUnreadCount);
      });
    };

    schedule();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(mutationAddsOutputActivityTarget)) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      clearBadges();
    };
  }, [outputActivityUnreadCount]);

  return null;
}
