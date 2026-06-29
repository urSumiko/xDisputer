# Notification UI FBIS Canvas

## Problem

The notification bell and account avatar were visually disconnected in the account rail, and the notification service could expose database schema drift such as `notifications.recipient_role` not existing.

## Traceability

Owner chain:

```text
AccountMenu -> NotificationDock -> notification-service -> notification-write-service -> notification schema migration -> notification-ui guard
```

## Behavior Control ECS

- Account rail owns the bell and avatar row.
- ConsoleShell must not render notification UI directly.
- Direct notifications by `recipient_user_id` must work even when role-wide notifications are unavailable.
- Role-wide notifications through `recipient_role` are optional until the live database is migrated.

## Impact Prediction CIG

This feature affects Client, Manager, and Master account rails because they all share `AccountMenu`.

## Structure Isolation FBIS

- Layout isolation: `app/notification-account-rail.css`
- UI owner: `components/notifications/NotificationDock.tsx`
- Shell owner: `components/console/AccountMenu.tsx`
- Data owner: `lib/notifications/*`
- Guard owner: `scripts/notification-ui-frontend-guard.mjs`

## Rule

The bell must render before the avatar in one horizontal row, stay inside the account rail, and open a bounded popover without pushing page content.
