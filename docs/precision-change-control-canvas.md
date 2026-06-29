# Precision Change Control Canvas

## Goal

Make every website change small, inspectable, reversible, and easy to modify.

## Observed issue

The notification dock rendered as normal page content, so it pushed the console layout instead of staying inside the right-side account rail. The notification query also expected a column that was not present in the live database yet.

## Required contracts for future changes

1. Data contract: SQL shape, compatibility path, and schema reload SQL.
2. Service contract: helper functions that tolerate older database shape when safe.
3. UI geometry contract: components must not affect page flow unless they are intended content.
4. Guard contract: a script should verify route, UI, and service wiring.
5. Recovery contract: provide Codespace command, SQL command, and auto-report command.

## Current correction

- Notification reads retry without optional href when needed.
- Notification writes retry without optional href when needed.
- Notification dock now carries contained geometry in the component.
- Successful generated output creates pending manager output activity.
- Manager output decision route notifies the disputer.

## Verification

```bash
npm run manager-console:guard
npm run ui-source:guard
npm run typecheck
npm run build
```
