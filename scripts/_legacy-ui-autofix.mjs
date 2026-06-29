#!/usr/bin/env node

export function assertLegacyUiAutofixAllowed(scriptName) {
  if (process.env.XDISPUTER_ALLOW_LEGACY_UI_AUTOFIX === '1') return;
  console.error(`Legacy UI autofix is disabled: ${scriptName}`);
  console.error('Use explicit source edits plus guards. To run a one-time emergency autofix, set XDISPUTER_ALLOW_LEGACY_UI_AUTOFIX=1.');
  process.exit(1);
}
