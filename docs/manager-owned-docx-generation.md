# Manager-Owned Dynamic DOCX Generation

## Objective

Uploaded manager DOCX files are now treated as the source of truth for body text, styling, static sections, dynamic fields, repeated entity blocks, affidavit mapping, and future template domains.

## Core rule

Preserve manager-authored DOCX content by default. Mutate only mapped fields and resolved entity zones. Block only when a required entity zone or required affidavit mapping is unresolved.

## Runtime flow

1. Inspect the dynamic template contract.
2. Build the manager-owned template runtime contract.
3. Classify static and custom blocks.
4. Resolve field bindings.
5. Resolve entity repeat blocks.
6. Evaluate affidavit readiness.
7. Merge manager-owned warnings into the render plan.
8. Render through the DOCX layout renderer.
9. Validate and grade the output.

## Manager intent model

- PRESERVE
- REMOVE
- MAKE_OPTIONAL
- MAKE_DYNAMIC
- REPEAT_FOR_ENTITY
- USE_AS_STYLE_SEED
- REQUIRES_REVIEW

## Database tables

- template_static_block_rules
- template_field_bindings
- template_entity_block_rules
- template_domain_contracts

## Future domains

The same contract model supports bankruptcy, ChexSystems, debt validation, and custom manager templates without creating separate renderers.

## Guard

Run:

```bash
npm run manager-owned-docx:guard
```
