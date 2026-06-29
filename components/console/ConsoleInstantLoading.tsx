type ConsoleInstantLoadingProps = {
  role: 'manager' | 'master';
  title: string;
  description: string;
  datasetLabel?: string;
};

const navItems = ['Monitoring', 'Accounts', 'Reports', 'Audit', 'System'];

function SkeletonLine({ wide = false }: { wide?: boolean }) {
  return <span className={`console-loading-line ${wide ? 'wide' : ''}`} data-theme-loading="skeleton" />;
}

function SkeletonCard({ index }: { index: number }) {
  return <article className="console-loading-card" style={{ animationDelay: `${index * 35}ms` }} data-theme-surface="card" data-console-instant-card="true">
    <SkeletonLine />
    <SkeletonLine wide />
    <div className="console-loading-row"><SkeletonLine /><SkeletonLine /></div>
  </article>;
}

export default function ConsoleInstantLoading({ role, title, description, datasetLabel = 'Dataset' }: ConsoleInstantLoadingProps) {
  return <main className={`admin-monitor-page native-console console-instant-loading ${role === 'master' ? 'master-ops-console' : 'manager-ops-console'}`} data-theme-custom={role === 'master' ? 'master' : 'manager'} data-console-shell="true" data-console-instant-loading="true" data-console-role={role} data-console-mode="operations" data-console-layout-ratio="75/25" aria-busy="true">
    <aside className="admin-monitor-sidebar native-console-sidebar" data-layout-contract="console-sidebar" data-console-sidebar="true" aria-label={`${role} loading navigation`}>
      <div className="admin-monitor-brand"><span>xD</span><div><strong>xDisputer</strong><small>{role === 'master' ? 'Master console' : 'Manager console'}</small></div></div>
      <div className="admin-sidebar-section-title">Loading workspace</div>
      <nav aria-label="Loading navigation" data-console-sidebar-nav="true">{navItems.map((item) => <span key={item} className="console-loading-nav-item" data-theme-loading="skeleton">{item}</span>)}</nav>
      <section className="console-sidebar-mode-switch" aria-label="Loading switch mode"><div><span>Preparing</span><strong>{role === 'master' ? 'Governance' : 'Operations'}</strong><small>Console shell is visible while panel data streams in.</small></div></section>
    </aside>
    <section className="admin-monitor-main native-console-main" data-console-main="true" data-console-header-grid="true" data-console-has-header="true">
      <div className="manager-header-account-dock console-loading-account" data-manager-account-anchor="header-ratio-grid" data-console-account-menu="true"><span data-theme-loading="skeleton" /><span data-theme-loading="skeleton" /></div>
      <header className="console-header-card console-loading-hero" data-console-header-primary="true"><div><p>{role === 'master' ? 'Master operations' : 'Manager operations'}</p><h1>{title}</h1><span>{description}</span></div></header>
      <section className="admin-monitor-stats" aria-label="Loading metrics">{[0, 1, 2, 3].map((item) => <article key={item} data-theme-loading="skeleton"><p>Loading</p><strong>—</strong></article>)}</section>
      <section className="admin-power-grid" aria-label={`${datasetLabel} loading`}>{[0, 1].map((item) => <SkeletonCard key={item} index={item} />)}</section>
    </section>
  </main>;
}
