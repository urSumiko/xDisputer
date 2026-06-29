import type { ReactNode } from 'react';

export type ConsoleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
  copyClassName?: string;
  secondaryClassName?: string;
  secondary?: ReactNode;
};

function join(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(' ');
}

export default function ConsoleHeader({ eyebrow, title, description, className, copyClassName, secondaryClassName, secondary }: ConsoleHeaderProps) {
  const hasSecondary = Boolean(secondary);
  return <header className={join('admin-monitor-header', 'native-command-hero', 'console-header-card', className)} data-console-component="ConsoleHeader" data-console-header="true" data-console-header-primary="true" data-console-header-aside={hasSecondary ? 'true' : 'false'}>
    <div className={join('console-header-copy', copyClassName)}>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </div>
    {hasSecondary ? <div className={join('console-header-secondary', secondaryClassName)}>{secondary}</div> : null}
  </header>;
}
