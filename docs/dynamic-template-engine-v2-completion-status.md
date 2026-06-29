# Dynamic Template Engine v2 Completion Status

_Last updated: 2026-06-14 Asia/Manila_

## Current status

Dynamic Template Engine v2 is now implemented as a gated framework. It is connected end-to-end behind explicit renderer mode and keeps the stable legacy renderer as the default path.

## Completed framework pieces

| Area | Status | Notes |
| --- | --- | --- |
| Canonical field registry v2 | Complete | Whole packet scope: Dispute Letter, Late Payment Letter, Affidavit, FTC, FCRA, Attachment. |
| Contract scanner v2 | Complete | Detects canonical fields, aliases, repeats, table-row prototypes, headers/footers, and unsupported zones. |
| Upload diagnostics | Complete | Upload route stores `validation_json.dynamicTemplateEngineV2`. |
| Active asset auto-backfill | Complete | GET `/api/template-assets` backfills missing v2 metadata for active rows. |
| Preflight v2 preference | Complete | Readiness can prefer v2 diagnostics over legacy highlighted compatibility warnings. |
| Mapping/render plan | Complete | Converts parsed source + route + contract into deterministic operations. |
| Renderer mode gate | Complete | `DOCX_LAYOUT_V2` is explicit; stable renderer remains default. |
| DOCX layout renderer v2 | Complete as gated foundation | Supports split-run replacement, explicit paragraph repeat blocks, table-row clone foundation, conditional keep/remove, body/header/footer XML parts. |
| Render validation | Complete | Scans unresolved placeholders and validates repeat/table-row proof. |
| Quality framework | Complete | Produces score, tier, status, blockers, warnings, and recommendation. |
| Advanced DOCX zone policy | Complete | Handles text boxes, drawings, content controls, altChunk policy. |
| Orchestrator | Complete | Connects contract -> advanced-zone policy -> mapping -> renderer -> validation -> quality -> manifest. |
| Affidavit v2 bridge | Complete | Routes editable Affidavit DOCX through v2 when `DOCX_LAYOUT_V2` is enabled. |
| FTC v2 bridge | Complete | Routes editable FTC DOCX through v2 and maps affected FTC accounts. |
| FTC active template fallback | Complete | FTC workflow can load the active Supabase template asset when no local template exists. |
| Regression guard | Complete | `dynamic-template:v2:regression` protects framework wiring. |
| Fixture harness | Complete | `scripts/dynamic-template-v2-fixture-regression.mjs` discovers real DOCX fixtures when added. |

## Still intentionally not default

`DOCX_LAYOUT_V2` is not the default renderer yet. This is intentional. The stable renderer remains the production default until real DOCX fixture testing confirms output quality across real user templates.

## Operational validation still required

These are not missing code modules. They are validation tasks that require real templates and generated outputs:

1. Add real DOCX fixtures under `test-fixtures/dynamic-template-v2/`.
2. Run the fixture harness against those DOCX files.
3. Enable `DOCX_LAYOUT_V2` in a controlled environment.
4. Generate packets with 1st, 2nd, 3rd, and Final round templates.
5. Visually compare output for layout, style, tables, header/footer content, and repeat sections.
6. Promote renderer-v2 only after validation passes.

## Safe enablement command

```bash
NEXT_PUBLIC_DYNAMIC_TEMPLATE_RENDERER_MODE=DOCX_LAYOUT_V2 npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Check commands

```bash
npm run dynamic-template:v2:regression
node scripts/dynamic-template-v2-fixture-regression.mjs
npm run typecheck
npm run build
npm run xdisputer:guard
```
