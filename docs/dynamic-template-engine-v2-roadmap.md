# Dynamic Template Engine v2 Roadmap

_Last updated: 2026-06-14 Asia/Manila_

## Priority goal

Make every accepted uploaded template render with consistent business logic while preserving the uploaded template's own layout, styling, tables, colors, font sizes, spacing, and placement.

This roadmap is intentionally strict. A phase is not considered complete until its acceptance checks pass.

## Core rule

```text
Never rebuild a user template unless the template explicitly defines a generated block.
Always mutate the uploaded DOCX in place.
When repeating data, clone the nearest styled prototype block or table row.
```

## Whole-packet scope

Editable DOCX components covered by Dynamic Template Engine v2:

- Dispute Letter DOCX
- Late Payment Letter DOCX
- Affidavit DOCX
- FTC Identity Theft Report DOCX

Static insert-only PDF components covered by packet policy:

- FCRA Legal Exhibit PDF
- Attachment PDF

## Current problem statement

The current system can accept and render dynamic templates, but output consistency is not strong enough when a materially different template is uploaded into another round slot, for example using a Final Round dispute template in a First Round dispute slot.

Observed failures to eliminate:

- Some source content is not mapped.
- Some fields render in the wrong location.
- Some template colors are not preserved.
- Some font sizes and text styles are not preserved.
- Some table layouts are not preserved.
- Repeating account content does not always follow the uploaded template structure.
- The template's visual layout can feel rebuilt instead of preserved.

## Definitions

| Term | Meaning |
| --- | --- |
| Canonical field | Stable business field such as `client.name`, `bureau.name`, `accounts.dispute`, or `letter.date`. |
| Alias | Alternative template placeholder name mapped to a canonical field, such as `consumer_name` -> `client.name`. |
| Render plan | Deterministic list of inline replacements, block repeats, table-row clones, and conditional removals before DOCX mutation. |
| Prototype block | Existing styled paragraph group or table row in the uploaded template that should be cloned for repeated data. |
| Layout-preserving render | Renderer changes placeholder content only and preserves all unaffected DOCX XML/style structure. |

## Strict phase tracker

| Phase | Status | Target | Exit criteria |
| --- | --- | --- | --- |
| 0 | Coded foundation | Existing upload gate, active template storage, preflight, manifest, and Supabase activation | Existing typecheck/build/guard pass. |
| 1 | Wired scaffold | Contract v2 scanner | Scanner exists and upload/preflight now store/read v2 diagnostics. Full strict activation enforcement remains pending. |
| 2 | Wired scaffold | Canonical field registry v2 | Registry defines required/optional/repeating/conditional fields for Dispute Letter, Late Payment Letter, Affidavit, FTC, FCRA, and Attachment. |
| 3 | Scaffold coded | Mapping engine v2 | `lib/dynamic-template/mapping-engine.ts` builds source-aware render plans with blockers, warnings, field values, repeat counts, and table-row clone operations. UI renderer integration remains pending. |
| 4 | Mode-gated | Layout-preserving DOCX renderer v2 | Renderer mode gate exists. Actual DOCX layout renderer implementation remains pending behind explicit mode. |
| 5 | Pending | Render validation and proof manifest | Output records unresolved placeholders, repeated counts, field counts, renderer version, contract version, and template hash. |
| 6 | Pending | Regression test pack | Test 1st/2nd/3rd/Final templates, cross-round uploads, tables, colors, missing anchors, and invalid templates. |

## Phase 1: Contract v2 scanner

### Goal

Know exactly what a template can render before accepting it.

### Build

- `lib/dynamic-template/contract-v2.ts`
- Canonical placeholder parser.
- Alias parser.
- Repeating block marker parser.
- Table-row marker detector.
- Header/footer scanner.
- Unsupported location detector.
- Round wording compatibility warnings.
- Upload route storage in `validation_json.dynamicTemplateEngineV2`.
- Preflight reader for `validationJson.dynamicTemplateEngineV2.contract`.

### Acceptance checks

- A Final Round dispute template uploaded to a First Round slot is allowed if the canonical dispute contract passes.
- A template with required account data but no account anchor is blocked.
- A template with account placeholders inside a table row records the row as a prototype row.
- Header/footer placeholders are detected.
- Unsupported required fields block activation.
- Unsupported optional fields warn only.

### What-if rules

| What if | Expected behavior |
| --- | --- |
| Template wording changes | Allow. Wording is not logic. |
| Template section order changes | Allow if canonical anchors still exist. |
| Client field appears in header | Allow if renderable. |
| Account block is a table row | Allow and mark as table-row prototype. |
| Account block is missing | Block for dispute/late-payment routes that require accounts. |
| Unknown required field exists | Block until mapped. |
| Unknown optional field exists | Warn and preserve or omit according to policy. |

## Phase 2: Canonical field registry v2

### Goal

One source of truth for all template fields and aliases.

### Build

- `lib/dynamic-template/field-registry.ts`
- Field definitions: required, optional, repeating, conditional.
- Alias definitions.
- Document-kind requirements.
- Round-specific warning rules.
- Custom field policy.

### Acceptance checks

- `client.name`, `client.addressLines`, `letter.date`, `bureau.name`, and `bureau.addressLines` are consistently defined.
- `accounts.dispute` is required for dispute account routes.
- `accounts.latePayments` is required for late-payment routes.
- Affidavit DOCX requires `client.name`, `client.addressLines`, `client.ssnMasked`, `letter.date`, `affidavit.state`, `affidavit.county`, and `accounts.dispute`.
- FTC DOCX supports client identity, FTC report fields, FTC statement, and affected account repeats.
- Optional fields can be blank without breaking render.
- Required custom fields block until mapped or supplied.

## Phase 3: Mapping engine v2

### Goal

Convert source data into a deterministic render plan before the renderer touches DOCX.

### Build

- `lib/dynamic-template/mapping-engine.ts`
- Canonical source value resolver.
- Alias resolver.
- Custom field resolver.
- Bureau-aware field resolver.
- Account-aware repeated block resolver.
- Conditional section resolver.
- Render-plan diagnostics.

### Acceptance checks

- Pre-render plan lists every field that will render.
- Pre-render plan lists every missing field.
- Pre-render plan lists every repeated block and expected repeat count.
- Pre-render plan lists table rows to clone.
- No renderer is called if required fields are unresolved.

## Phase 4: Layout-preserving DOCX renderer v2

### Goal

Preserve the uploaded template exactly except for intended replacements.

### Build

- `lib/dynamic-template/docx-layout-renderer-v2.ts`
- Run-level replacement.
- Split-run placeholder repair.
- Multiline replacement preserving paragraph style.
- Paragraph-block clone rendering.
- Table-row clone rendering preserving cell widths, borders, shading, and text style.
- Conditional section removal.
- Header/footer replacement.

### Acceptance checks

- Font size is preserved.
- Text color is preserved.
- Highlight/background is preserved.
- Table widths and borders are preserved.
- Account rows clone the template row style.
- Placeholder markers are removed after rendering.
- Static PDFs are inserted unchanged.

## Phase 5: Render validation and proof manifest

### Goal

Detect when output did not follow the template.

### Build

- Post-render unresolved placeholder scan.
- Render proof manifest additions.
- Renderer version field.
- Contract version field.
- Mapping version field.
- Field count summary.
- Repeat count summary.
- Warning/blocker summary.

### Acceptance checks

- Manifest records template asset ID, content hash, contract version, mapping version, and renderer version.
- Manifest records unresolved required placeholders as blockers.
- Manifest records repeated account count.
- Manifest records all warnings.

## Phase 6: Regression test pack

### Goal

Prevent output regressions when templates change.

### Test matrix

| Template case | Expected result |
| --- | --- |
| 1st Round dispute template | Valid render. |
| 2nd Round dispute template | Valid render. |
| 3rd Round dispute template | Valid render. |
| Final Round dispute template in First Round slot | Valid render with round wording warning only. |
| Template with styled table rows | Table row clone preserves style. |
| Template with colored placeholders | Replacement preserves color. |
| Template with missing account anchor | Block. |
| Template with unknown required field | Block. |
| Template with optional unknown field | Warn. |
| Static PDF exhibit | Insert unchanged. |

## Immediate coding order

1. Create `lib/dynamic-template/field-registry.ts`. **Done.**
2. Create `lib/dynamic-template/contract-v2.ts`. **Done.**
3. Add contract-v2 diagnostics without replacing current renderer. **Done through `app/api/template-assets/diagnostics/route.ts`.**
4. Add upload/preflight warnings based on contract-v2. **Done.**
5. Create render-plan builder. **Done through `lib/dynamic-template/mapping-engine.ts`.**
6. Add renderer-v2 behind a feature flag or explicit renderer mode. **Done through `lib/dynamic-template/renderer-mode.ts`; renderer implementation still pending.**
7. Promote renderer-v2 only after regression tests pass.

## Non-negotiable implementation rules

1. Do not remove the existing stable renderer until v2 passes regression tests.
2. Do not accept a template with missing required canonical anchors.
3. Do not silently render unknown required fields blank.
4. Do not rebuild table layouts from scratch.
5. Do not normalize template styling globally.
6. Do not use a round name alone to decide whether a template is valid.
7. Do not treat a visually different template as invalid if the canonical contract passes.
8. Every v2 output must include a proof manifest.

## Progress log

- 2026-06-14: Roadmap created.
- 2026-06-14: Added `lib/dynamic-template/field-registry.ts` with whole-packet canonical fields for Dispute Letter, Late Payment Letter, Affidavit, FTC, FCRA, and Attachment.
- 2026-06-14: Added `lib/dynamic-template/contract-v2.ts` with XML part scanning, canonical placeholder detection, repeat block/table-row prototype detection, header/footer detection, unsupported-zone warnings, and round mismatch warning logic.
- 2026-06-14: Added `app/api/template-assets/diagnostics/route.ts` so v2 contract diagnostics can be tested without replacing the current renderer.
- 2026-06-14: Added upload-route storage for `validation_json.dynamicTemplateEngineV2` and response payload v2 diagnostics.
- 2026-06-14: Added preflight checks for dynamic template v2 diagnostics on active template metadata.
- 2026-06-14: Added `lib/dynamic-template/mapping-engine.ts` render-plan builder.
- 2026-06-14: Added `lib/dynamic-template/renderer-mode.ts` to keep renderer-v2 behind explicit mode while stable renderer remains default.
