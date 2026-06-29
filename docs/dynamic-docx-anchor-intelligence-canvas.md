# xDisputer Dynamic DOCX Anchor Intelligence Canvas

## Problem

Manager-owned DOCX templates are editable. A manager may remove or rewrite static sections, rename headings, or reorder content. Generation must not fail only because one exact heading is missing.

## New rule

```txt
Exact anchor missing does not mean template broken.
Exact anchor missing means run anchor intelligence.
```

## Runtime ladder

```txt
1. Manager-pinned rule
2. DOCX content control or bookmark
3. Exact alias heading
4. Semantic alias heading
5. Account paragraph pattern
6. Safe fallback before signature
7. Manager repair task
```

## Core files

```txt
lib/dynamic-template-intelligence/anchor-alias-registry.ts
lib/dynamic-template-intelligence/docx-structure-reader.ts
lib/dynamic-template-intelligence/semantic-section-detector.ts
lib/dynamic-template-intelligence/insertion-zone-resolver.ts
lib/dynamic-template-intelligence/template-contract-validator.ts
lib/dynamic-template-intelligence/generation-repair-planner.ts
lib/dynamic-template-intelligence/template-diff-analyzer.ts
lib/dynamic-template-intelligence/template-version-policy.ts
lib/dynamic-template-intelligence/docx-paragraph-inserter.ts
```

## Database

```txt
template_anchor_rules
template_validation_events
```

## User-facing repair language

```txt
Template needs anchor mapping.
The manager edited this DOCX and the account insertion zone is no longer pinned.
Open Template Studio to confirm the correct insertion zone or allow the system to auto-create the missing account section.
```

## Guard

```bash
npm run dynamic-template:anchor-guard
```

## Definition of done

```txt
Manager can remove static blocks.
Manager can rewrite headings.
Generated account blocks can still find a safe insertion zone.
Weak anchors become repair tasks.
Future template families use the same resolver.
```
