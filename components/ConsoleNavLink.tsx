'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { warmControlRoute } from './control/controlConsoleCache';

function labelText(children: ReactNode) {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  return 'Console navigation';
}

function currentHref(pathname: string, searchParams: { toString(): string } | null) {
  const query = searchParams?.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

function normalizeHref(href: string) {
  if (typeof window === 'undefined') return href;
  try {
    const url = new URL(href, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

type ConsoleNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'onClick'> & {
  href: string;
  children: ReactNode;
};

export default function ConsoleNavLink({ href, className, children, ...anchorProps }: ConsoleNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const normalizedHref = useMemo(() => normalizeHref(href), [href]);
  const activeHref = useMemo(() => currentHref(pathname, searchParams), [pathname, searchParams]);
  const optimisticActive = optimisticHref === normalizedHref && activeHref !== normalizedHref;

  useEffect(() => {
    if (optimisticHref && activeHref === optimisticHref) setOptimisticHref(null);
  }, [activeHref, optimisticHref]);

  function warm() {
    warmControlRoute(href, router.prefetch);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return;
    startTransition(() => setOptimisticHref(normalizedHref));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xdisputer:control-nav-start', { detail: { href, label: labelText(children), source: 'ConsoleNavLink' } }));
    }
  }

  const classes = [className, optimisticActive ? 'active optimistic' : '', isPending ? 'nav-pending' : ''].filter(Boolean).join(' ').trim() || undefined;

  return <Link {...anchorProps} href={href} className={classes} onClick={handleClick} onMouseEnter={warm} onFocus={warm} prefetch>{children}</Link>;
}
