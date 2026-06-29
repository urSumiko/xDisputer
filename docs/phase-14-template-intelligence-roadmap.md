# Phase 14 — Template Intelligence Roadmap

Goal: make generated output consistent even when uploaded templates use different formatting, sections, wording, and order.

Core rule: template layout is dynamic, but template intent must be stable.

## Analogy

A template is a custom envelope design. The design can change, but the delivery slots must remain known: client identity, address, date, bureau, account name, account number, account text, and custom fields.

## Implemented foundation

- `lib/template-governance.ts`
- `lib/docx-text-audit.ts`
- `buildTemplateGovernance(contract)`
- `evaluateSourceCompleteness(input)`
- `auditRenderedText(input)`
- generation repair integration in `scripts/repair-letter-workspace-contracts.mjs`

## Phase 14A — Contract hardening

Turn every uploaded template contract into a governance result:

- status
- risk
- confidence
- detected intent slots
- missing intent slots
- required fields
- optional fields
- custom fields
- loop fields
- what-if warnings
- storage policy

## Phase 14B — Active template resolver

Generation must use the newest active template for:

- owner
- round
- template kind
- letter type or exhibit type

Old versions should be archived and not used unless explicitly restored.

## Phase 14C — Source Data completeness

Status: integrated into generation preflight repair.

Before generation, verify:

- client name exists
- address exists
- account rows exist
- account names exist
- account numbers exist
- required custom fields exist

If required values are missing, generation is blocked before rendering.

## Phase 14D — Post-render audit

Status: integrated into letter rendering repair.

After each letter render, verify:

- no unresolved placeholders remain
- client name appears
- account names appear
- account numbers appear

A letter with audit blockers is not added to the output set, and route coverage keeps the run from being marked review-ready.

## Phase 14E — Reports and explainability

Each generation run should explain:

- active template used
- contract version
- source completeness result
- render audit result
- blockers
- warnings
- why output is ready or blocked

## Phase 14F — Free-tier storage policy

Keep storage compact:

- latest active template
- one rollback version
- metadata for older versions when useful
- delete older storage files after safe replacement
- do not persist generated output unless needed
- keep reports as lightweight JSON

## What-if rules

- If the template design changes but intent slots remain, generation should still work.
- If account number is removed, preflight should block or mark needs review.
- If custom fields are added, Source Data must provide them when required.
- If cloud sync fails, local template should still be usable with a warning.
- If user logs in elsewhere, cloud active template should recover the template.
- If free-tier storage grows, archive old records and delete old files.
- If source data is incomplete, block before generation.
- If render leaves placeholders, block after generation.

## Acceptance criteria

- New uploads do not break old logic if intent slots are present.
- Latest active template is always selected.
- Missing client or account data is caught before generation.
- Rendered outputs are audited before being marked ready.
- Storage remains free-tier safe.
