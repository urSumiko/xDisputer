import { requireRole } from '../../../lib/saas/session';

type PageProps = {
  searchParams?: Promise<{
    round?: string | string[];
    control?: string | string[];
    message?: string | string[];
  }>;
};

const rounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SystemTemplatesPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const activeRound = rounds.includes(stringParam(params.round) || '') ? stringParam(params.round)! : '2nd Round';
  const control = stringParam(params.control);
  const message = stringParam(params.message);

  const { user, profile, supabase } = await requireRole('master');

  const { data: assets, error } = await supabase
    .from('template_assets')
    .select('*')
    .eq('round_label', activeRound)
    .order('created_at', { ascending: false });

  return (
    <main className="admin-monitor-page native-console system-template-page">
      <aside className="admin-monitor-sidebar native-console-sidebar">
        <div className="admin-monitor-brand">
          <span>xD</span>
          <div><strong>xDisputer</strong><small>Template registry</small></div>
        </div>

        <div className="admin-sidebar-section-title">Templates</div>
        <nav aria-label="Template registry navigation">
          {rounds.map((round) => (
            <a key={round} className={activeRound === round ? 'active' : ''} href={`/system/templates?round=${encodeURIComponent(round)}`}>{round}</a>
          ))}
          <a href="/system/confirm">Auto confirm</a>
          <a href="/system/health">System health</a>
          <a href="/master?panel=reports">Master reports</a>
        </nav>

        <div className="admin-monitor-account">
          <strong>{profile?.email || user.email || 'Master account'}</strong>
          <small>Owner account</small>
          <form action="/auth/sign-out" method="post"><button type="submit">Sign out</button></form>
        </div>
      </aside>

      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>Template registry</p>
            <h1>{activeRound} templates.</h1>
            <span>Upload controlled templates to Supabase Storage and register active metadata for each round.</span>
          </div>
        </header>

        {control && (
          <section className={`admin-monitor-card admin-feedback-card ${control === 'ok' ? 'success' : 'error'}`}>
            <strong>{control === 'ok' ? 'Template saved' : 'Template upload failed'}</strong>
            <span>{message || 'No details provided.'}</span>
          </section>
        )}

        <section className="admin-power-grid">
          <article className="admin-monitor-card native-operation-card">
            <div className="admin-monitor-card-header">
              <div><p>Upload</p><h2>Letter template</h2></div>
              <span>DOCX</span>
            </div>
            <form action="/api/template-assets" method="post" encType="multipart/form-data" className="admin-power-list">
              <input type="hidden" name="round" value={activeRound} />
              <input type="hidden" name="templateKind" value="LETTER" />
              <label>Letter type</label>
              <select name="letterType" required>
                <option value="DISPUTE">Dispute Letter</option>
                <option value="LATE_PAYMENT">Late Payment Letter</option>
              </select>
              <input name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              <button type="submit" className="admin-action-button primary">Upload letter template</button>
            </form>
          </article>

          <article className="admin-monitor-card native-operation-card">
            <div className="admin-monitor-card-header">
              <div><p>Upload</p><h2>Packet exhibit</h2></div>
              <span>PDF / DOCX</span>
            </div>
            <form action="/api/template-assets" method="post" encType="multipart/form-data" className="admin-power-list">
              <input type="hidden" name="round" value={activeRound} />
              <input type="hidden" name="templateKind" value="EXHIBIT" />
              <label>Exhibit type</label>
              <select name="exhibitKind" required>
                <option value="FCRA">FCRA Legal Exhibit PDF</option>
                <option value="ATTACHMENT">Attachment PDF</option>
                <option value="AFFIDAVIT">Affidavit DOCX</option>
                <option value="FTC">FTC Identity Theft Report DOCX</option>
              </select>
              <input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              <button type="submit" className="admin-action-button primary">Upload exhibit template</button>
            </form>
          </article>
        </section>

        <section className="admin-monitor-card native-operation-card">
          <div className="admin-monitor-card-header">
            <div><p>Registry</p><h2>Active and historical templates</h2></div>
            <span>{assets?.length || 0} records</span>
          </div>

          {error ? (
            <div className="admin-monitor-empty">Could not load templates: {error.message}</div>
          ) : (
            <div className="admin-monitor-table-wrap">
              <table className="admin-monitor-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Round</th>
                    <th>Kind</th>
                    <th>Type</th>
                    <th>Version</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets?.length ? assets.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.original_filename}</strong><small>{item.storage_path}</small></td>
                      <td>{item.round_label}</td>
                      <td>{item.template_kind}</td>
                      <td>{item.letter_type || item.exhibit_kind}</td>
                      <td>v{item.version_number}</td>
                      <td><span className={`admin-status-badge ${item.is_active ? 'active' : 'disabled'}`}>{item.is_active ? 'active' : 'inactive'}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="admin-monitor-empty">No templates registered for this round yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
