# Frontend and Backend Organization Canvas

## Goal

Make xDisputer easier to modify with precision: every UI, function, database change, and workflow should have one owner, one contract, one guard, and one recovery command.

## Current gap detected

1. **UI geometry drift**
   - New UI elements can enter normal page flow and push existing layouts.
   - Example: notification dock affected console header because ownership was split between shell and account rail.

2. **Backend schema drift**
   - Frontend/API code can assume a database column exists before SQL has been run in Supabase.
   - Example: notifications queried optional columns before the live schema was updated.

3. **Duplicated workflow ownership**
   - Access control and payroll/output activity overlapped.
   - Correct ownership: access controls account relation/status; output activity controls generated-output confirmation and payday extras.

4. **Guard drift**
   - Some guards expected old wording such as Payroll after the product language changed to Output Activity.
   - Guards must be updated in the same patch as the feature contract.

5. **Global CSS overload**
   - Many root-level CSS files can override each other without clear ownership.
   - New UI should prefer component-contained geometry or feature-owned CSS with explicit markers.

## Target architecture rule

Every change must follow this chain:

```text
Request -> canvas -> owner file -> service contract -> UI geometry contract -> guard -> SQL if needed -> Codespace verification -> auto report
```

## Frontend standard

- Account rail owns account menu and notification dock.
- Console shell owns only layout slots and mode switching.
- Feature pages own content cards and workflow copy.
- Root CSS should only define global contracts, not one-off layout fixes.
- Any popover/floating UI must be absolute/fixed and must not push page content.

## Backend standard

- Route handlers should call service/helper functions, not contain repeated business rules.
- Any new database column must have a safe fallback until SQL is applied.
- Any table change must include `notify pgrst, 'reload schema';` in SQL.
- Notification and output activity must tolerate old schemas when safe.

## Manager/disputer workflow ownership

| Workflow | Owner | Rule |
| --- | --- | --- |
| Account status | Access control | Approve, pause, unlink, reactivate. |
| Generated output | Output Activity | Pending output activity is created after successful generation. |
| Manager decision | Output Activity | Confirm, return/reject, mark paid. |
| Payday computation | Output Activity | Base salary + approved extra output pay. |
| User notice | Notification service | Manager and disputer receive decision notifications. |

## Implementation phases

### Phase 1: Stabilize current error

- Fix notification query-builder order.
- Fallback when optional notification columns are missing.
- Keep one notification dock owner: account rail.
- Update guards to current product wording.

### Phase 2: Add repo precision audit

- Add scanner that checks duplicate ownership, unsafe query order, optional-schema assumptions, and CSS ownership drift.
- Use it before large UI/backend changes.

### Phase 3: Split large files by feature

- Break large console and workspace components into feature-owned components.
- Keep old routes as thin composition layers only.

### Phase 4: Database contract registry

- Track which SQL is required per feature.
- Keep manual SQL editor blocks in documentation when Supabase CLI is not used.

## Verification

```bash
npm run manager-console:guard
npm run ui-intelligence:guard
npm run ui-source:guard
npm run typecheck
npm run build
```
