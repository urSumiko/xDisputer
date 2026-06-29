import { redirect } from 'next/navigation';
import { requireAuth } from '../../../lib/saas/session';

export default async function ManagerTemplateLibraryPage() {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) redirect(session.dashboardPath);

  return <main className="admin-monitor-page native-console system-template-page">
    <section className="admin-monitor-main native-console-main">
      <header className="admin-monitor-header native-command-hero master-compact-hero">
        <div>
          <p>Manager template library</p>
          <h1>Default templates for assigned clients.</h1>
          <span>Managers upload once. Every assigned client generates with active manager template versions.</span>
        </div>
      </header>
      <section className="admin-monitor-card native-operation-card">
        <div className="admin-monitor-card-header">
          <div><p>Manager-controlled templates</p><h2>Use Templates workspace</h2></div>
          <span>Active defaults</span>
        </div>
        <p>Open the Templates workspace to upload, replace, and remove active manager defaults. Client users have read-only access and cannot upload templates.</p>
        <a className="admin-action-button primary" href="/workspace">Open Templates workspace</a>
      </section>
    </section>
  </main>;
}
