export type ThemeGovernanceRole = 'global' | 'client' | 'manager' | 'master' | 'auth';

export type ThemeGovernanceIssueKind =
  | 'theme'
  | 'surface'
  | 'interaction-performance'
  | 'layout'
  | 'loading'
  | 'backend'
  | 'accessibility'
  | 'unknown';

export type ThemeGovernanceDecision = {
  kind: ThemeGovernanceIssueKind;
  ownerFile: string;
  reason: string;
  requiredGuards: string[];
  shouldNotDo: string[];
};

export type ThemeGovernanceCanvas = {
  id: string;
  title: string;
  goal: string;
  sourceOfTruth: string[];
  roles: ThemeGovernanceRole[];
  globalTokens: string[];
  customizationHooks: string[];
  workflow: string[];
  performanceModel: {
    loadsFirst: string[];
    loadsLater: string[];
    cached: string[];
    paginated: string[];
    refreshed: string[];
    fallback: string[];
  };
  antiPatterns: string[];
};

export const XDISPUTER_THEME_GOVERNANCE_CANVAS: ThemeGovernanceCanvas = {
  id: 'xdisputer-unified-native-ui-governance',
  title: 'xDisputer Unified UX Theme Governance Canvas',
  goal: 'Keep client, manager, master, auth, template, source, and output surfaces inside one native xDisputer product language with one base theme, one shared surface layer, one instant interaction layer, and one final layout layer.',
  sourceOfTruth: [
    'app/layout.tsx',
    'app/root-css-contracts.css',
    'app/root-css-console-shell.css',
    'app/root-css-client-portal.css',
    'app/ui-theme-contracts.css',
    'app/unified-surface-contracts.css',
    'app/instant-interaction-performance.css',
    'app/ui-layout-contracts.css',
    'app/native-client-console.css',
    'scripts/theme-consistency-guard.mjs',
    'scripts/theme-governance-contract-guard.mjs',
    'docs/ux-theme-governance-canvas.md',
    'docs/unified-triad-surface-canvas.md',
    'docs/native-ui-unification-canvas.md'
  ],
  roles: ['global', 'client', 'manager', 'master', 'auth'],
  globalTokens: [
    '--x-color-bg',
    '--x-color-surface',
    '--x-color-text',
    '--x-color-primary',
    '--x-color-success',
    '--x-color-warning',
    '--x-color-danger',
    '--x-radius-lg',
    '--x-space-4',
    '--x-transition-fast',
    '--x-unified-surface-contract',
    '--x-shell-sidebar-width',
    '--x-console-sidebar-width',
    '--x-surface-radius',
    '--x-instant-duration',
    '--x-float-y'
  ],
  customizationHooks: [
    'data-theme-contract="xdisputer-unified"',
    'data-ui-scope="global"',
    'data-ui-quality="production"',
    'data-motion-contract="safe"',
    'data-theme-surface="card"',
    'data-theme-action="primary"',
    'data-theme-action="secondary"',
    'data-theme-control="input"',
    'data-theme-status="success|warning|danger"',
    'data-theme-loading="skeleton"',
    'data-theme-custom="client|manager|master|auth"',
    'data-console-role="manager|master|client"'
  ],
  workflow: [
    'Classify the UI problem before coding.',
    'Use ui-theme-contracts.css for shared visual tokens, inputs, buttons, status, and loading.',
    'Use unified-surface-contracts.css for shared sidebars, headers, cards, chips, borders, filters, tables, and overflow behavior.',
    'Use native-client-console.css only to keep client shell aligned with manager/master native console behavior.',
    'Use instant-interaction-performance.css for hover, tap, loading, and sluggishness fixes.',
    'Use ui-layout-contracts.css for final geometry: grid, flex, spacing, overflow, responsive order.',
    'Use component code only when render state, data shape, or interaction logic is wrong.',
    'Use Supabase or route code only when auth, data, RLS, storage, or backend permissions are the root cause.',
    'Do not reintroduce role-theme forks, obsidian shell styling, or compact shell overlays.'
  ],
  performanceModel: {
    loadsFirst: ['root layout', 'root CSS bundles', 'theme tokens', 'shared surface behavior', 'instant interaction layer', 'final layout contracts', 'visible route shell'],
    loadsLater: ['role-specific data', 'dashboard counts', 'paginated datasets', 'generated outputs'],
    cached: ['static CSS', 'static JS chunks', 'deterministic shell markup'],
    paginated: ['account directories', 'client datasets', 'manager outputs', 'audit logs'],
    refreshed: ['route-scoped datasets after mutations', 'auth/session state after login/logout', 'generation output after successful run'],
    fallback: ['skeleton loading shell', 'alert panel', 'disabled blocker state', 'empty dataset state']
  },
  antiPatterns: [
    'Do not create a new global theme per route.',
    'Do not reintroduce client aurora, manager graphite, or master executive theme forks.',
    'Do not load obsidian or compact shell CSS into the root console bundle.',
    'Do not use transition-property: all.',
    'Do not rely on expensive backdrop-filter or heavy blur for core cards.',
    'Do not hardcode one-off colors when a token exists.',
    'Do not solve backend/auth/RLS errors with CSS.',
    'Do not put final layout geometry into the theme contract.',
    'Do not animate every dense manager/master card on page load.',
    'Do not create different sidebar/header/card/chip behavior per role unless the function requires it.'
  ]
};

export function classifyThemeGovernanceIssue(input: string): ThemeGovernanceDecision {
  const normalized = input.toLowerCase();

  if (/(sluggish|lag|float|hover|tap|instant|delay|interaction performance|slow animation|manager slow|master slow)/.test(normalized)) {
    return {
      kind: 'interaction-performance',
      ownerFile: 'app/instant-interaction-performance.css',
      reason: 'The issue changes perceived interaction speed or dense console motion, so it belongs to the instant interaction layer.',
      requiredGuards: ['npm run responsive:guard', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not animate every dense console card.', 'Do not use transition-property: all.', 'Do not add JavaScript animation for simple hover feedback.']
    };
  }

  if (/(surface behavior|side navigation|sidebar behavior|header orientation|borders|card behavior|chips|badges|labels|compact|filter toolbar|pager|table overflow|overflow drift|native surface|one layout behaviour|one layout behavior|unified surface|three theme|3 theme|triad|client aurora|manager graphite|master executive)/.test(normalized)) {
    return {
      kind: 'surface',
      ownerFile: 'app/unified-surface-contracts.css',
      reason: 'The issue changes shared UI behavior or retires old role-theme forks, so it belongs to the unified native surface layer.',
      requiredGuards: ['npm run responsive:guard', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not create a role-specific duplicate surface system.', 'Do not reintroduce legacy triad theme forks.', 'Do not override final grid ownership here.']
    };
  }

  if (/(color|theme|button|input|shadow|radius|typography|font|status|loading|skeleton|motion|transition)/.test(normalized)) {
    return {
      kind: 'theme',
      ownerFile: 'app/ui-theme-contracts.css',
      reason: 'The issue changes reusable visual tone, so it belongs to the unified theme contract.',
      requiredGuards: ['npm run theme:guard', 'npm run responsive:guard', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not add a route-specific global theme.', 'Do not use transition-property: all.', 'Do not hardcode one-off colors.']
    };
  }

  if (/(grid|layout|flex|position|responsive|column|row|width|height|spacing collapse)/.test(normalized)) {
    return {
      kind: 'layout',
      ownerFile: 'app/ui-layout-contracts.css',
      reason: 'The issue changes final geometry or responsive structure, so it belongs to the final layout contract.',
      requiredGuards: ['npm run layout:guard', 'npm run responsive:guard', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not hide overflow as a substitute for fixing layout ownership.', 'Do not add fixed desktop-only widths.', 'Do not move business logic into CSS.']
    };
  }

  if (/(spinner|pending|optimistic|refresh)/.test(normalized)) {
    return {
      kind: 'loading',
      ownerFile: 'component owner + app/ui-theme-contracts.css',
      reason: 'The issue affects perceived performance and needs component state plus theme loading hooks.',
      requiredGuards: ['npm run theme:guard', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not block the full page for small async updates.', 'Do not load every row into the browser.', 'Do not add unnecessary dependencies.']
    };
  }

  if (/(supabase|auth|rls|database|storage|api|server|permission|session|invalid api key)/.test(normalized)) {
    return {
      kind: 'backend',
      ownerFile: 'app/api/*, lib/saas/*, lib/supabase/*, or Supabase SQL',
      reason: 'The issue is caused by runtime data/auth/backend state, not visual styling.',
      requiredGuards: ['npm run supabase:doctor', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not hide backend errors with CSS.', 'Do not expose service role keys in frontend code.', 'Do not bypass RLS.']
    };
  }

  if (/(contrast|focus|keyboard|aria|screen reader|reduced motion|accessibility)/.test(normalized)) {
    return {
      kind: 'accessibility',
      ownerFile: 'app/ui-theme-contracts.css + component owner',
      reason: 'The issue affects accessible operation and must preserve focus, contrast, and reduced-motion behavior.',
      requiredGuards: ['npm run theme:guard', 'npm run typecheck', 'npm run build'],
      shouldNotDo: ['Do not remove focus-visible outlines.', 'Do not rely on color alone for status.', 'Do not force motion for reduced-motion users.']
    };
  }

  return {
    kind: 'unknown',
    ownerFile: 'inspect current component owner first',
    reason: 'The issue is not yet classified. Inspect the route, component, CSS owner, and runtime state before coding.',
    requiredGuards: ['npm run theme:guard', 'npm run layout:guard', 'npm run responsive:guard', 'npm run typecheck', 'npm run build'],
    shouldNotDo: ['Do not guess the owner file.', 'Do not rewrite working components blindly.', 'Do not skip validation.']
  };
}

export function themeGovernanceChecklist(role: ThemeGovernanceRole) {
  return [
    `Use the global xDisputer theme contract for ${role}.`,
    'Use the unified native surface layer before adding one-off role styling.',
    'Use the unified surface contract for shared sidebars, headers, cards, chips, filters, tables, borders, and overflow behavior.',
    'Use the native client console alignment layer only for client-shell sync work.',
    'Use the instant interaction layer for float, tap feedback, and sluggishness fixes.',
    'Use approved theme tokens for color, spacing, depth, typography, and motion.',
    'Use data-theme-custom only for local role emphasis.',
    'Use ui-layout-contracts.css for final geometry changes.',
    'Keep loading feedback instant and lightweight.',
    'Run theme, responsive, typecheck, and build validation before accepting the change.'
  ];
}
