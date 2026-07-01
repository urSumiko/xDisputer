#!/usr/bin/env node
import fs from 'node:fs';

const checks = [
  {
    file: 'components/ConsoleNavLink.tsx',
    required: [
      'suppressHydrationWarning',
      'data-console-nav-hydration="stable"',
      'data-console-nav-label="true"',
      'removeAttribute(\'data-output-activity-unread-count\')'
    ],
    reason: 'Console nav labels must be hydration-stable and must not accept pre-hydration unread-count DOM mutations.'
  },
  {
    file: 'src/features/notifications/useOwnedNotifications.ts',
    required: [
      'useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)',
      'function getServerSnapshot()',
      'EMPTY_SNAPSHOT'
    ],
    reason: 'Notification snapshots must keep server and first client render identical.'
  }
];

const failures = [];
for (const check of checks) {
  const text = fs.existsSync(check.file) ? fs.readFileSync(check.file, 'utf8') : '';
  if (!text) {
    failures.push(`${check.file}: file is missing.`);
    continue;
  }

  for (const token of check.required) {
    if (!text.includes(token)) failures.push(`${check.file}: missing hydration guard token ${JSON.stringify(token)}. ${check.reason}`);
  }
}

if (failures.length) {
  console.error('Hydration integrity guard failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Hydration integrity guard passed.');
