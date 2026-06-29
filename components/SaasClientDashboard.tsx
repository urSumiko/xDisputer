import Link from 'next/link';
import type { IntegrationHealthItem } from '../lib/saas/integration-health';
import { ObsidianPanel, ObsidianStatCard, ObsidianStatusBadge } from './ObsidianDashboardPrimitives';

export type SaasClientDashboardProps = {
  email?: string | null;
  integrations: IntegrationHealthItem[];
};

export default function SaasClientDashboard({ email, integrations }: SaasClientDashboardProps) {
  const connectedCount = integrations.filter((item) => item.status === 'connected').length;

  return (
    <div className="obsidian-dashboard-grid">
      <ObsidianStatCard label="Account" value={email || 'Client'} trend="Active" />
      <ObsidianStatCard label="Platform" value={`${connectedCount}/${integrations.length}`} trend="Connected" />
      <ObsidianStatCard label="Workspace" value="Ready" trend="Protected" />

      <ObsidianPanel title="Document operations" eyebrow="Primary workflow" className="obsidian-panel-large">
        <div className="obsidian-action-panel">
          <div>
            <h4>Prepare packets inside a protected SaaS workspace.</h4>
            <p>Your account is connected to Supabase Auth. Launch the document engine only when you are ready to work.</p>
          </div>
          <Link href="/client/workspace" className="obsidian-primary-link">Open document workspace</Link>
        </div>
      </ObsidianPanel>

      <ObsidianPanel title="Integration status" eyebrow="Connected platform">
        <div className="obsidian-list-stack">
          {integrations.map((item) => (
            <article key={item.id} className="obsidian-list-row">
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <ObsidianStatusBadge status={item.status} />
            </article>
          ))}
        </div>
      </ObsidianPanel>

      <ObsidianPanel title="Recent activity" eyebrow="Audit-ready workflow">
        <div className="obsidian-empty-state">
          <strong>No recent packet activity yet</strong>
          <p>Activity will appear here once database-backed cases, filings, and workspace runs are created.</p>
        </div>
      </ObsidianPanel>
    </div>
  );
}
