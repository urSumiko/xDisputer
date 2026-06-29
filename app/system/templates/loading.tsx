export default function SystemTemplatesLoading() {
  return (
    <main className="admin-monitor-page native-console master-ops-console">
      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>System templates</p>
            <h1>Loading template registry.</h1>
            <span>Preparing active Supabase template metadata...</span>
          </div>
        </header>
        <section className="admin-monitor-card native-operation-card console-loading-panel" />
      </section>
    </main>
  );
}
