'use client';

import { useEffect, useState } from 'react';
import { saveWorkspacePreferences, type WorkspacePreferences } from '../lib/workspace-preferences';

type PayrollProfile = {
  employmentType: 'full_time' | 'output_based';
  isOutputBased: boolean;
  isFullTime: boolean;
  baseSalary: number;
  perOutputRate: number;
  managerId: string | null;
};

type Props = {
  preferences: WorkspacePreferences;
  onChange: (next: WorkspacePreferences) => void;
};

function normalizeProfile(payload: unknown): PayrollProfile {
  const profile = payload && typeof payload === 'object' && 'profile' in payload ? (payload as { profile?: Partial<PayrollProfile> }).profile : null;
  const employmentType = profile?.employmentType === 'output_based' ? 'output_based' : 'full_time';
  return {
    employmentType,
    isOutputBased: employmentType === 'output_based',
    isFullTime: employmentType === 'full_time',
    baseSalary: Number(profile?.baseSalary || 0),
    perOutputRate: Number(profile?.perOutputRate || 0),
    managerId: typeof profile?.managerId === 'string' ? profile.managerId : null
  };
}

export default function ClientPerOutputIntentCard({ preferences, onChange }: Props) {
  const [profile, setProfile] = useState<PayrollProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/client/payroll-profile', { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-store' } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled) return;
        const next = normalizeProfile(payload);
        setProfile(next);
        setLoading(false);
        if (next.isOutputBased && preferences.perOutputGenerationDefault !== true) {
          onChange(saveWorkspacePreferences({ ...preferences, perOutputGenerationDefault: true }));
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [onChange, preferences]);

  const forcedPerOutput = profile?.isOutputBased === true;
  const checked = forcedPerOutput || preferences.perOutputGenerationDefault;

  if (loading) {
    return <section className="client-per-output-intent-card loading" data-output-activity-client-intent="true"><div><strong>Output salary mode</strong><p>Checking your manager payroll profile before generation…</p></div><span className="client-output-mode-chip">Loading</span></section>;
  }

  if (forcedPerOutput) {
    return <section className="client-per-output-intent-card locked" data-output-activity-client-intent="true" data-client-output-profile="output-based"><div><strong>Per-output salary confirmation</strong><p>Your manager set your profile as per-output. Every generated letter is automatically sent for manager confirmation before salary is added.</p></div><span className="client-output-mode-chip locked">Per-output required</span></section>;
  }

  return <section className="client-per-output-intent-card optional" data-output-activity-client-intent="true" data-client-output-profile="full-time"><div><strong>Full-time salary mode</strong><p>Your profile is full-time. Generate as fixed-salary work by default, or mark this packet as a per-output add-on for manager confirmation.</p></div><label><input type="checkbox" checked={checked} onChange={(event) => onChange(saveWorkspacePreferences({ ...preferences, perOutputGenerationDefault: event.target.checked }))} /><span>Make this packet per-output</span></label></section>;
}
