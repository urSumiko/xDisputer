#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };
const mustNot = (source, marker, label) => { if (source.includes(marker)) failures.push(label); };
const mustAllNot = (sources, marker, label) => {
  for (const [name, source] of Object.entries(sources)) {
    if (source.includes(marker)) failures.push(`${label}: ${name}`);
  }
};

const files = {
  layout: read('app/layout.tsx'),
  generationRoute: read('app/api/generation-runs/route.ts'),
  notificationsRoute: read('app/api/notifications/route.ts'),
  notificationsApi: read('src/features/notifications/notification-api-service.ts'),
  notificationService: read('lib/notifications/notification-service.ts'),
  ownedHook: read('src/features/notifications/useOwnedNotifications.ts'),
  dock: read('components/notifications/OwnedNotificationDock.tsx'),
  badge: read('components/notifications/OutputActivityUnreadBadgeMount.tsx'),
  outputRefresh: read('components/notifications/OutputActivityRealtimeRefreshMount.tsx'),
  autoRouteRefresh: read('components/console/AutoRouteRefresh.tsx'),
  outputPage: read('app/admin/output-activity-v2/page.tsx'),
  outputApi: read('app/api/manager/output-activity/route.ts'),
  outputService: read('lib/saas/manager-user-settings.ts'),
  outputCss: read('app/output-activity-flow.css'),
  payrollMount: read('components/client/ClientPayrollProfileSyncMount.tsx'),
  payrollRoute: read('app/api/client/payroll-profile/route.ts'),
  canonicalMigration: read('supabase/migrations/20260622141000_canonical_output_activity_notification_sync_v2.sql'),
  payrollFixMigration: read('supabase/migrations/20260622143000_fix_client_payroll_profile_ambiguous_manager_id.sql')
};

must(files.layout, 'ClientPayrollProfileSyncMount', 'layout must mount payroll profile sync');
must(files.layout, 'OutputActivityUnreadBadgeMount', 'layout must mount output activity unread badge');
must(files.layout, 'OutputActivityRealtimeRefreshMount', 'layout must mount output activity refresh bridge');

must(files.generationRoute, 'syncGeneratedOutputEverywhere', 'generation route must use one canonical sync helper');
must(files.generationRoute, "rpc('sync_generation_output_activity_v1'", 'generation route must call generation sync RPC');
must(files.generationRoute, "rpc('sync_manager_output_activity_notifications_v1'", 'generation route must call manager notification repair RPC');
mustNot(files.generationRoute, "from('manager_disputer_output_approvals').insert", 'generation route must not manually insert output activity rows');
mustNot(files.generationRoute, "from('notifications').insert", 'generation route must not manually insert notification rows');

must(files.notificationsRoute, "export const dynamic = 'force-dynamic'", 'notifications route must be dynamic');
must(files.notificationsRoute, 'syncErrorMessage', 'notifications route must return sync diagnostics');
must(files.notificationsApi, "rpc('sync_manager_recent_generation_output_activity_v1'", 'notification API must heal manager output activity before read');
must(files.notificationsApi, "rpc('sync_manager_output_activity_notifications_v1'", 'notification API must repair manager notifications before read');
must(files.notificationService, "recipient_user_id", 'notification service must read direct current-user rows');
must(files.notificationService, "recipient_role", 'notification service may read role fallback for legacy rows');
must(files.notificationService, ".select('id,title,body,href,severity,read_at,created_at')", 'notification reads must use canonical columns');

must(files.ownedHook, 'useSyncExternalStore', 'owned notification hook must use a shared external store');
must(files.ownedHook, 'xdisputer:notifications-refreshed', 'owned notification hook must emit data-change event');
must(files.ownedHook, 'removeChannel(channel)', 'owned notification hook must clean only its own channel');
must(files.ownedHook, 'warmupTimer', 'owned notification hook must include short warmup polling');
must(files.ownedHook, 'steadyTimer', 'owned notification hook must include slow fallback polling');
must(files.dock, 'useOwnedNotifications', 'notification dock must use owned notification hook');
must(files.badge, 'useOwnedNotifications', 'output activity unread badge must use owned notification hook');
must(files.badge, 'requestAnimationFrame', 'badge DOM patch must be frame-bounded');
must(files.outputRefresh, 'xdisputer:notifications-refreshed', 'output activity refresh bridge must react to notification data changes');
must(files.outputRefresh, 'removeChannel(channel)', 'output activity refresh bridge must clean only its own channel');
must(files.autoRouteRefresh, 'xdisputer:notifications-refreshed', 'auto route refresh must be event/focus driven');
mustNot(files.autoRouteRefresh, 'setInterval', 'auto route refresh must not permanently poll RSC pages');

must(files.outputPage, 'listManagerOutputApprovals(supabase, user.id, [], filter)', 'output activity page must query all manager rows, not active-client page ids');
must(files.outputApi, 'listManagerOutputApprovals(supabase, user.id, [], filter)', 'manager output activity JSON endpoint must query all manager rows');
must(files.outputApi, "export const dynamic = 'force-dynamic'", 'manager output activity API must be dynamic');
must(files.outputService, 'if (ids.length) query = query.in', 'output service must only apply disputer id filter when ids are explicitly provided');
must(files.outputPage, 'output-activity-title-actions', 'output activity page must render decisions in the header action cluster');
must(files.outputPage, '<DecisionForm row={row} rateAmount={rateAmount} />', 'output activity decision control must be before the per-output badge');
must(files.outputPage, 'data-output-count={row.output_count || 0}', 'output activity must preserve output count as data instead of a duplicated visible field');
mustNot(files.outputPage, 'routeInfo(', 'output activity row must not render duplicated generated-letter output detail');
mustNot(files.outputPage, '<b>Output</b>', 'output activity row must not show duplicated Output field in metadata grid');
must(files.outputCss, '--output-activity-flow-contract: header-actions-no-duplicated-output-field;', 'output activity CSS contract must document header actions and removed output field');
must(files.outputCss, '.output-activity-title-actions', 'output activity CSS must own the header action cluster');
must(files.outputCss, '.output-decision-form-inline', 'output activity CSS must support compact inline decisions');

must(files.payrollRoute, 'readPayrollProfileFallback', 'payroll profile route must have server fallback');
must(files.payrollRoute, 'syncWarning', 'payroll profile route must return sync warning instead of hard failing when fallback works');
must(files.payrollMount, 'requestAnimationFrame', 'payroll sync must be frame-bounded');
must(files.payrollMount, 'addedNodes', 'payroll sync observer must only react to newly added relevant nodes');
must(files.payrollMount, 'setText', 'payroll sync must be idempotent');

must(files.canonicalMigration, 'manager_output_approvals_generation_run_id_unique', 'canonical migration must enforce one activity per generation run');
must(files.canonicalMigration, 'notifications_output_activity_href_unique', 'canonical migration must enforce one notification per recipient href');
must(files.payrollFixMigration, 'mus.manager_id', 'payroll fix migration must qualify manager_user_settings.manager_id');
must(files.payrollFixMigration, 'p.manager_id', 'payroll fix migration must qualify profiles.manager_id');

mustAllNot(files, 'removeAllChannels', 'shared browser clients must not remove all channels');

if (failures.length) {
  console.error(`notification-output-activity-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('notification-output-activity-guard: ok');
