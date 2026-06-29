import { requireRole } from '../../../lib/saas/session';
import { requireWorkspaceAccess } from '../../../lib/saas/access-entitlement';

const rounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];

function statusLabel(value: boolean) {
  return value ? 'Saved to Supabase' : 'Missing';
}

export default async function WorkspaceTemplateStatusPage() {
  await requireWorkspaceAccess();
  const { user, profile, supabase } = await requireRole('client');

  const { data: assets, error: assetsError } = await supabase
    .from('template_assets')
    .select('id, round_label, template_kind, letter_type, exhibit_kind, original_filename, version_number, is_active, created_at')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const { data: runs, error: runsError } = await supabase
    .from('generation_runs')
    .select('id, client_name, round_label, output_status, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <main className="admin-monitor-page native-console system-runtime-page">
      <aside className="admin-monitor-sidebar native-console-sidebar">
        <div className="admin-monitor-brand">
          <span>xD</span>
          <div><strong>xDisputer</strong><small>Client storage</small></div>
        </div>

        <div className="admin-sidebar-section-title">Workspace</div>
        <nav aria-label="Workspace storage navigation">
          <a href="/workspace">Workspace</a>
          <a className="active" href="/workspace/template-status">Template storage</a>
        </nav>

        <div className="admin-monitor-account">
          <strong>{profile?.email || user.email || 'Client account'}</strong>
          <small>Current template owner</small>
        </div>
      </aside>

      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>Client template storage</p>
            <h1>Your Supabase templates.</h1>
            <span>This page confirms what is saved to your signed-in user account, not another client or master account.</span>
          </div>
        </header>

        <section className="admin-power-grid">
          <article className="admin-monitor-card native-operation-card">
            <div className="admin-monitor-card-header">
              <div><p>Database owner</p><h2>Signed-in user</h2></div>
              <span>owner_id</span>
            </div>
            <div className="admin-power-list">
              <span><strong>Email</strong><br />{user.email || 'No email available'}</span>
              <span><strong>User ID</strong><br />{user.id}</span>
            </div>
          </article>

          <article className="admin-monitor-card native-operation-card">
            <div className="admin-monitor-card-header">
              <div><p>Saved records</p><h2>Supabase status</h2></div>
              <span>{assets?.length || 0} active</span>
            </div>
            <div className="admin-power-list">
              <span><strong>Templates</strong><br />{assetsError ? assetsError.message : `${assets?.length || 0} active template record(s) saved to Supabase.`}</span>
              <span><strong>Generation history</strong><br />{runsError ? runsError.message : `${runs?.length || 0} recent generation run(s) saved.`}</span>
            </div>
          </article>
        </section>

        <section className="admin-monitor-card native-operation-card">
          <div className="admin-monitor-card-header">
            <div><p>Round coverage</p><h2>Templates saved by round</h2></div>
            <span>client owned</span>
          </div>

          <div className="admin-monitor-table-wrap">
            <table className="admin-monitor-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Dispute</th>
                  <th>Late Payment</th>
                  <th>FCRA</th>
                  <th>Attachment</th>
                  <th>Affidavit</th>
                  <th>FTC</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => {
                  const active = assets || [];
                  const hasDispute = active.some((item) => item.round_label === round && item.template_kind === 'LETTER' && item.letter_type === 'DISPUTE');
                  const hasLate = active.some((item) => item.round_label === round && item.template_kind === 'LETTER' && item.letter_type === 'LATE_PAYMENT');
                  const hasFcra = active.some((item) => item.round_label === round && item.template_kind === 'EXHIBIT' && item.exhibit_kind === 'FCRA');
                  const hasAttachment = active.some((item) => item.round_label === round && item.template_kind === 'EXHIBIT' && item.exhibit_kind === 'ATTACHMENT');
                  const hasAffidavit = active.some((item) => item.round_label === round && item.template_kind === 'EXHIBIT' && item.exhibit_kind === 'AFFIDAVIT');
                  const hasFtc = active.some((item) => item.round_label === round && item.template_kind === 'EXHIBIT' && item.exhibit_kind === 'FTC');

                  return (
                    <tr key={round}>
                      <td><strong>{round}</strong></td>
                      <td>{statusLabel(hasDispute)}</td>
                      <td>{statusLabel(hasLate)}</td>
                      <td>{statusLabel(hasFcra)}</td>
                      <td>{statusLabel(hasAttachment)}</td>
                      <td>{statusLabel(hasAffidavit)}</td>
                      <td>{statusLabel(hasFtc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-monitor-card native-operation-card">
          <div className="admin-monitor-card-header">
            <div><p>Saved template files</p><h2>Active Supabase records</h2></div>
            <span>{assets?.length || 0} records</span>
          </div>

          <div className="admin-monitor-table-wrap">
            <table className="admin-monitor-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Round</th>
                  <th>Kind</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {assets?.length ? assets.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.original_filename}</strong></td>
                    <td data-label="Round">{item.round_label}</td>
                    <td data-label="Kind">{item.template_kind}</td>
                    <td data-label="Type">{item.letter_type || item.exhibit_kind}</td>
                    <td data-label="Version">v{item.version_number}</td>
                    <td data-label="Saved">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="admin-monitor-empty">
                      No Supabase templates saved for this account yet. Upload from Workspace → Templates.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-monitor-card native-operation-card">
          <div className="admin-monitor-card-header">
            <div><p>Generation history</p><h2>Recent runs</h2></div>
            <span>{runs?.length || 0} runs</span>
          </div>

          <div className="admin-monitor-table-wrap">
            <table className="admin-monitor-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Round</th>
                  <th>Status</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {runs?.length ? runs.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.client_name || 'Unknown client'}</strong></td>
                    <td data-label="Round">{item.round_label}</td>
                    <td data-label="Status">{item.output_status}</td>
                    <td data-label="Saved">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="admin-monitor-empty">
                      No generation runs saved for this client account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
