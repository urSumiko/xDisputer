export type RepositoryContractCriticality = 'P0' | 'P1' | 'P2';

export type RepositoryContractArea = {
  id: string;
  title: string;
  criticality: RepositoryContractCriticality;
  ownerFiles: string[];
  guardScripts: string[];
  runtimeSurfaces: string[];
  noConflictRules: string[];
};

export const REPOSITORY_CONTRACT_MAP: RepositoryContractArea[] = [
  {
    id: 'workspace-shell',
    title: 'Disputer workspace shell, sidebar, sticky header, account rail, and popovers',
    criticality: 'P0',
    ownerFiles: [
      'components/LetterGeneratorWorkspaceV2.tsx',
      'components/console/AccountMenu.tsx',
      'app/root-css-console-shell.css',
      'app/account-bell-avatar-row.css',
      'app/console-sticky-compact-header.css'
    ],
    guardScripts: [
      'scripts/console-shell-contract-guard.mjs',
      'scripts/ui-layout-contract-guard.mjs',
      'scripts/ui-collapse-contract-guard.mjs'
    ],
    runtimeSurfaces: ['app/workspace/page.tsx', 'app/admin/page.tsx', 'app/master/page.tsx'],
    noConflictRules: [
      'Account rail positioning is owned by AccountMenu and account-bell-avatar-row.css only.',
      'Sticky header rules must not be patched from packet-editor or supporting-document CSS files.',
      'New global CSS fixes must name the owning surface and must not override unrelated console shells.'
    ]
  },
  {
    id: 'template-generation',
    title: 'DOCX template inspection, rendering, proof validation, and generated output integrity',
    criticality: 'P0',
    ownerFiles: [
      'lib/template-execution/template-execution-orchestrator.ts',
      'lib/template-execution/dynamic-template-engine.ts',
      'lib/template-execution/render-proof-gate.ts',
      'lib/dynamic-template/render-orchestrator.ts',
      'lib/dynamic-template/docx-layout-renderer-v2.ts',
      'lib/docx-renderer.ts',
      'lib/supplemental-template-renderer.ts'
    ],
    guardScripts: [
      'scripts/template-execution-guard.mjs',
      'scripts/dynamic-template-v2-regression.mjs',
      'scripts/dynamic-template-anchor-guard.mjs'
    ],
    runtimeSurfaces: ['components/LetterGeneratorWorkspaceV2.tsx', 'components/OutputReviewWorkspace.tsx'],
    noConflictRules: [
      'Every engine path must pass the same render-proof gate before returning a DOCX blob.',
      'Legacy fallback may be used only when it returns proof-clean output.',
      'Template preservation problems must be blocked before final ZIP or PDF packaging.'
    ]
  },
  {
    id: 'final-packet-output',
    title: 'Editable DOCX packet, Supporting Documents PDF, merged bureau PDF ZIP, and conversion policy',
    criticality: 'P0',
    ownerFiles: [
      'lib/ordered-packet-archive.ts',
      'lib/final-pdf-package-builder.ts',
      'lib/final-pdf-packet.ts',
      'lib/pdf-conversion-policy.ts',
      'lib/packet-renderer.ts',
      'components/OutputReviewWorkspace.tsx',
      'components/SimpleDocxEditor.tsx'
    ],
    guardScripts: [
      'scripts/template-execution-guard.mjs',
      'scripts/repository-contract-map-guard.mjs'
    ],
    runtimeSurfaces: ['app/api/convert/docx-to-pdf/route.ts', 'components/OutputReviewWorkspace.tsx'],
    noConflictRules: [
      'Merged PDF ZIP must be built from the same ReviewOutput records as the Editable DOCX packet.',
      'DOCX to PDF conversion must try the deterministic server converter first.',
      'Browser fallback is a development compatibility path and must be disabled for deterministic production output.'
    ]
  },
  {
    id: 'database-rpc-contract',
    title: 'Supabase tables, RPCs, storage buckets, entitlement checks, output activity, and notifications',
    criticality: 'P0',
    ownerFiles: [
      'lib/supabase/db-rpc-contract.ts',
      'lib/supabase/server.ts',
      'lib/supabase/admin.ts',
      'lib/saas/access-entitlement.ts',
      'app/api/generation-runs/route.ts',
      'app/api/notifications/route.ts',
      'src/features/notifications/notification-api-service.ts'
    ],
    guardScripts: ['scripts/db-rpc-contract-guard.mjs', 'scripts/check-env-contract.mjs', 'scripts/connector-inheritance-guard.mjs'],
    runtimeSurfaces: ['app/api/generation-runs/route.ts', 'app/api/template-assets/route.ts', 'app/api/notifications/route.ts'],
    noConflictRules: [
      'Critical RPC drift must be surfaced as a contract issue instead of silently behaving like success.',
      'Service-role mutations must remain server-only and must never enter client components.',
      'Database migrations must be idempotent and safe to re-run.'
    ]
  },
  {
    id: 'notifications',
    title: 'Bell notifications, output activity sync, read state, realtime, and polling fallback',
    criticality: 'P1',
    ownerFiles: [
      'components/notifications/OwnedNotificationDock.tsx',
      'src/features/notifications/useOwnedNotifications.ts',
      'lib/notifications/notification-service.ts',
      'src/features/notifications/notification-api-service.ts'
    ],
    guardScripts: ['scripts/notification-output-activity-guard.mjs', 'scripts/notification-ui-frontend-guard.mjs'],
    runtimeSurfaces: ['app/api/notifications/route.ts', 'app/api/notifications/read/route.ts', 'app/api/notifications/read/clear/route.ts'],
    noConflictRules: [
      'DB notification rows are preferred over virtual fallbacks when sync RPCs are available.',
      'Client notifications for output decisions must not expose dead Open buttons.',
      'Local storage can cache display state, but DB read state remains the durable source.'
    ]
  },
  {
    id: 'manager-reporting',
    title: 'Manager reports, payroll, per-output approvals, and Per Boss reporting',
    criticality: 'P1',
    ownerFiles: [
      'lib/manager-console/manager-reporting.ts',
      'lib/manager-console/boss-reporting-contract.ts',
      'components/manager/ManagerReportControls.tsx',
      'app/api/manager/report-export/route.ts'
    ],
    guardScripts: ['scripts/manager-report-workflow-guard.mjs', 'scripts/db-rpc-contract-guard.mjs'],
    runtimeSurfaces: ['app/admin/page.tsx', 'app/api/manager/report-export/route.ts'],
    noConflictRules: [
      'Boss assignment must become structured data and must not permanently depend on notes parsing.',
      'Report export sheets must reuse the same typed report data as the UI.',
      'Payroll output totals must separate base salary, approved output pay, and pending output pay.'
    ]
  }
];

export function repositoryContractById(id: string) {
  return REPOSITORY_CONTRACT_MAP.find((area) => area.id === id) || null;
}

export function repositoryContractSummary() {
  return {
    version: '2026-06-30.repository-contract-map.v1',
    areaCount: REPOSITORY_CONTRACT_MAP.length,
    p0Areas: REPOSITORY_CONTRACT_MAP.filter((area) => area.criticality === 'P0').map((area) => area.id),
    ownerFiles: Array.from(new Set(REPOSITORY_CONTRACT_MAP.flatMap((area) => area.ownerFiles))).sort(),
    guardScripts: Array.from(new Set(REPOSITORY_CONTRACT_MAP.flatMap((area) => area.guardScripts))).sort()
  };
}
