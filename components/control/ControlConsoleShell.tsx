'use client';

import { useMemo, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import ConsoleNavLink from '../ConsoleNavLink';
import ControlNavigationTelemetry, { type ControlNavItem } from './ControlNavigationTelemetry';

type Props = {
  scope: 'master' | 'manager';
  brandLabel: string;
  brandSubtitle: string;
  sectionLabel?: string;
  accountEmail: string;
  accountLabel: string;
  navItems: ControlNavItem[];
  mainClassName?: string;
  children: ReactNode;
};

function routeKey(pathname: string, searchParams: { toString(): string } | null) {
  const query = searchParams?.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function navKey(href: string) {
  if (typeof window === 'undefined') return href;
  try {
    const url = new URL(href, window.location.origin);
    return url.search ? `${url.pathname}${url.search}` : url.pathname;
  } catch {
    return href;
  }
}

function isActiveNav(href: string, currentRoute: string, allHrefs: string[]) {
  const key = navKey(href);
  if (currentRoute === key) return true;
  const hasExactQueryMatch = allHrefs.some((item) => navKey(item) === currentRoute && navKey(item).includes('?'));
  if (hasExactQueryMatch) return false;
  return !key.includes('?') && currentRoute.startsWith(`${key}/`);
}

export default function ControlConsoleShell({
  scope,
  brandLabel,
  brandSubtitle,
  sectionLabel = 'Operations',
  navItems,
  mainClassName = '',
  children
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRoute = useMemo(() => routeKey(pathname, searchParams), [pathname, searchParams]);
  const hrefs = useMemo(() => navItems.map((item) => item.href), [navItems]);
  const consoleClass = scope === 'master' ? 'master-ops-console' : 'manager-ops-console';

  return <main className={`admin-monitor-page native-console ${consoleClass} ${mainClassName}`} data-control-console={scope}>
    <ControlNavigationTelemetry scope={scope} navItems={navItems} />
    <aside className="admin-monitor-sidebar native-console-sidebar">
      <div className="admin-monitor-brand">
        <span>xD</span>
        <div><strong>{brandLabel}</strong><small>{brandSubtitle}</small></div>
      </div>

      <div className="admin-sidebar-section-title">{sectionLabel}</div>
      <nav aria-label={`${scope} navigation`}>
        {navItems.map((item) => <ConsoleNavLink key={item.href} href={item.href} className={isActiveNav(item.href, currentRoute, hrefs) ? 'active' : undefined}>{item.label}</ConsoleNavLink>)}
      </nav>
    </aside>

    <section className="admin-monitor-main native-console-main">
      {children}
    </section>
  </main>;
}
