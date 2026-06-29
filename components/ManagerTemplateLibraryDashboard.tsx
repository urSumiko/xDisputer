'use client';

export default function ManagerTemplateLibraryDashboard() {
  return <section className="admin-monitor-main native-console-main">
    <header className="admin-monitor-header native-command-hero master-compact-hero">
      <div>
        <p>Manager template library</p>
        <h1>Default templates for assigned clients.</h1>
        <span>Managers upload once. Clients use the active manager defaults.</span>
      </div>
    </header>
    <section className="admin-monitor-card native-operation-card">
      <div className="admin-monitor-card-header">
        <div><p>Manager-controlled templates</p><h2>Active library</h2></div>
        <span>read-only for clients</span>
      </div>
      <p>Use the Templates workspace to upload or replace manager defaults. Assigned clients cannot upload templates and will generate from these active defaults.</p>
      <a className="admin-action-button primary" href="/workspace">Open Templates workspace</a>
    </section>
  </section>;
}
