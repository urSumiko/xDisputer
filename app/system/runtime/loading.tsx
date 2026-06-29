export default function SystemRuntimeLoading() {
  return (
    <main className="admin-monitor-page native-console master-ops-console">
      <section className="admin-monitor-main native-console-main">
        <header className="admin-monitor-header native-command-hero master-compact-hero">
          <div>
            <p>System runtime</p>
            <h1>Loading runtime status.</h1>
            <span>Preparing diagnostics...</span>
          </div>
        </header>
        <section className="admin-monitor-card native-operation-card console-loading-panel" />
      </section>
    </main>
  );
}
