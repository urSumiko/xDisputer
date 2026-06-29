import { Suspense } from 'react';
import './root-css-workspace-foundation.css';
import './root-css-template-pipeline.css';
import './root-css-client-portal.css';
import './root-css-console-shell.css';
import './root-css-contracts.css';
import './account-menu-ratio-system.css';
import './final-console-account-rail.css';
import './client-account-popover-ratio.css';
import './account-popover-compact-retirement.css';
import './template-workspace-hubs.css';
import './manager-template-library-upload.css';
import './manager-template-test-lab.css';
import './template-workflow-framework.css';
import './client-template-runtime.css';
import './dynamic-template-intelligence.css';
import './final-responsive-integrity.css';
import './responsive-layout-stability-system.css';
import './manager-owned-docx-studio.css';
import './account-bell-avatar-row.css';
import './ui-theme-contracts.css';
import './ui-layout-contracts.css';
import './console-sticky-compact-header.css';
import './sticky-header-visibility.css';
import './console-navigation-polish.css';
import './account-record-density.css';
import './manager-account-header-actions.css';
import './master-account-directory-polish.css';
import './manager-payroll-modal.css';
import './output-activity-flow.css';
import './manager-report-workflow.css';
import './client-payroll-profile-flow.css';
import './output-activity-unread-badge.css';
import './access-state-lightweight.css';
import './stable-ui-primitives.css';
import './workflow-header-slim.css';
import './supporting-documents-layout-polish.css';
import './supporting-documents-wide-stage.css';
import './supporting-documents-runtime-wide-fix.css';
import './console-debug-overlay.css';
import './supporting-documents-center-canvas-contract.css';
import ControlNavGlobalTelemetry from '../components/control/ControlNavGlobalTelemetry';
import RenderDebuggerMount from '../components/console/RenderDebuggerMount';
import OutputActivityRealtimeRefreshMount from '../components/notifications/OutputActivityRealtimeRefreshMount';
import OutputActivityUnreadBadgeMount from '../components/notifications/OutputActivityUnreadBadgeMount';
import GlobalTopbarActionsMount from '../components/shell/GlobalTopbarActionsMount';
import ClientPayrollProfileSyncMount from '../components/client/ClientPayrollProfileSyncMount';
import QueryProvider from '../src/features/app-providers/QueryProvider';
import { XDISPUTER_RUNTIME_SYNC } from '../lib/runtime-source-sync';

export const metadata = {
  title: 'xDisputer',
  description: 'Secure document operations SaaS'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-xdisputer-runtime-marker={XDISPUTER_RUNTIME_SYNC.marker}><body data-theme-contract="xdisputer-unified" data-ui-scope="global" data-ui-quality="production" data-motion-contract="safe" data-xdisputer-runtime-marker={XDISPUTER_RUNTIME_SYNC.marker} data-terminology-contract={XDISPUTER_RUNTIME_SYNC.terminologyContract}><QueryProvider><ControlNavGlobalTelemetry /><GlobalTopbarActionsMount /><ClientPayrollProfileSyncMount /><OutputActivityRealtimeRefreshMount /><OutputActivityUnreadBadgeMount />{children}<Suspense fallback={null}><RenderDebuggerMount /></Suspense></QueryProvider></body></html>;
}
