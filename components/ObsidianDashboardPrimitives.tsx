import type { ReactNode } from 'react';

export function ObsidianStatCard({ label, value, trend, children }: { label: string; value: string; trend?: string; children?: ReactNode }) {
  return (
    <article className="obsidian-stat-card">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      {trend && <span>{trend}</span>}
      {children}
    </article>
  );
}

export function ObsidianPanel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`obsidian-panel ${className}`}>
      <header>
        {eyebrow && <p>{eyebrow}</p>}
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

export function ObsidianStatusBadge({ status }: { status: string }) {
  return <span className={`obsidian-status-badge ${status.toLowerCase()}`}>{status}</span>;
}
