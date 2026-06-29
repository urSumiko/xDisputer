export type AccountScope = 'public' | 'client' | 'manager' | 'master';

export type ScopeRule = {
  scope: AccountScope;
  label: string;
  portal: boolean;
  templates: boolean;
  assignments: boolean;
  globalControls: boolean;
  globalContent: boolean;
};

export const scopeRules: Record<AccountScope, ScopeRule> = {
  public: { scope: 'public', label: 'Public', portal: false, templates: false, assignments: false, globalControls: false, globalContent: false },
  client: { scope: 'client', label: 'Client', portal: true, templates: false, assignments: false, globalControls: false, globalContent: false },
  manager: { scope: 'manager', label: 'Manager', portal: true, templates: true, assignments: true, globalControls: false, globalContent: false },
  master: { scope: 'master', label: 'Master', portal: true, templates: true, assignments: true, globalControls: true, globalContent: true }
} as const;

export function scopeMatches(allowed: readonly AccountScope[], activeScope: AccountScope): boolean {
  return allowed.includes('public') || allowed.includes(activeScope);
}
