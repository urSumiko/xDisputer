import type { ReactNode } from 'react';
import ConsoleNavLink from '../ConsoleNavLink';
import NotificationBell from '../notifications/NotificationBell';

const workspaceNav = [
  { href: '/master/ui-workspace', label: 'UI Workspace', active: true },
  { href: '/master/ui-workspace?panel=global-controls', label: 'Global controls' },
  { href: '/master/ui-workspace?panel=global-content', label: 'Global content' },
  { href: '/master/ui-workspace?panel=layouts', label: 'Layout controls' },
  { href: '/master/ui-workspace?panel=elements', label: 'Elements' },
  { href: '/master/ui-workspace?panel=inspector', label: 'Inspector' },
  { href: '/master/ui-workspace?panel=publish', label: 'Publish center' }
];

type Props = {
  email: string;
  children: ReactNode;
};

function initialFromEmail(email: string) {
  return (email.trim()[0] || 'm').toLowerCase();
}

export default function MasterWorkspaceFrame({ email, children }: Props) {
  return <main className="admin-monitor-page native-console master-ui-workspace-route" data-master-workspace-frame="true" data-console-role="master" data-console-mode="workspace">
    <aside className="admin-monitor-sidebar native-console-sidebar master-ui-workspace-sidebar" data-master-workspace-sidebar="true" data-console-sidebar="true">
      <div className="admin-monitor-brand"><span>xD</span><div><strong>xDisputer</strong><small>Master workspace</small></div></div>
      <div className="admin-sidebar-section-title">Master workspace</div>
      <nav aria-label="Master workspace navigation" data-master-workspace-nav="true">
        {workspaceNav.map((item) => <ConsoleNavLink key={item.href} href={item.href} className={item.active ? 'active' : ''}>{item.label}</ConsoleNavLink>)}
      </nav>
      <section className="console-sidebar-mode-switch" data-console-mode-switch="sidebar-bottom" data-master-workspace-switch="true" aria-label="Master Console to UI Workspace">
        <div><span>Master Console to UI Workspace</span><strong>Return to Master Console</strong><small>Go back to monitoring, account control, reports, audit, and system health.</small></div>
        <ConsoleNavLink href="/master" className="console-sidebar-mode-switch-button" data-master-canonical-switch="true" data-master-switch-visible-slot="sidebar-bottom" data-master-switch-target="/master" data-master-switch-target-label="Master Console"><span>Master Console</span><em aria-hidden="true">up</em></ConsoleNavLink>
      </section>
    </aside>
    <section className="admin-monitor-main native-console-main master-ui-workspace-main" data-console-main="true" data-console-component="MasterWorkspaceMain" data-console-header-grid="true">
      <div className="manager-header-account-dock master-workspace-account-rail" data-manager-account-anchor="header-ratio-grid" data-master-workspace-account-rail="true"><NotificationBell /><div className="manager-header-account-avatar" aria-label="Master account avatar">{initialFromEmail(email)}</div></div>
      <header className="admin-monitor-header native-command-hero master-ui-workspace-hero" data-console-header-primary="true"><div><p>Master workspace</p><h1>UI Workspace.</h1><span>Dedicated master workspace for global controls, UI content, layout behavior, elements, inspection, and publishing.</span></div></header>
      {children}
    </section>
  </main>;
}
