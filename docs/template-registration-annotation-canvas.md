# Manager Template Registration + Annotation Canvas

## Goal

Keep the current Template Library, Template Studio, and Generation Engine logic, but make the manager workflow easier to understand and more precise.

The new function is a lightweight **Template Registration Console** inside Template Studio. It lets a manager register the intent and annotation mode for the active template without changing the upload, inspection, rule, or generation pipeline.

## UX principle

Do not put every technical option on one page. Show one compact precision workflow:

1. Upload or select an active template in Template Library.
2. Open Template Studio.
3. Review detected annotation lanes.
4. Register the template precision profile.
5. Let the Generation Engine consume the saved `rule_json.registrationProfile` later.

## What registration means

Registration is not a second template system. It is a manager-authored precision profile saved onto the existing `template_assets.rule_json` record.

It stores:

- manager intent
- annotation mode
- detected static text to preserve
- variables and canonical mappings
- entity extraction hints
- table protection hints
- blockers and warnings
- average confidence

## Current logic preserved

The implementation does not replace:

- template upload route
- template asset activation
- dynamic template inspection
- dynamic template rules
- generation release gate
- engine preview flow

It only adds a clearer manager-facing registration layer that reuses the current inspection output.

## Data contract

Saved location:

```text
template_assets.rule_json.registrationProfile
```

Profile version:

```text
template-registration-v1
```

Main fields:

```json
{
  "profileVersion": "template-registration-v1",
  "templateAssetId": "...",
  "managerUserId": "...",
  "roundLabel": "1st Round",
  "originalFilename": "template.docx",
  "managerIntent": "precision-output",
  "annotationMode": "safe",
  "summary": {
    "annotations": 20,
    "preserve": 5,
    "map": 8,
    "extract": 4,
    "table": 1,
    "review": 2,
    "rules": 20,
    "blockers": 0,
    "warnings": 1,
    "averageConfidence": 88
  },
  "annotations": []
}
```

## Annotation lanes

| Lane | Meaning | Engine intent |
|---|---|---|
| Preserve | static legal copy or instruction text | do not rewrite |
| Map field | variable/canonical field match | replace deterministically |
| Extract entity | entity/parser hint | extract from source data |
| Protect table | table/cell/row layout | keep layout, generate rows only |
| Review | uncertain or warning area | manager or engine gate checks |

## Best practice basis

The design follows App Router best practices:

- server-render page reads
- small client surface only when required
- plain form POST for mutation
- revalidate affected routes after save
- no heavy client-only state
- no additional live polling

## Verification

After pulling latest code, managers should see **Precision registration** inside `/manager-workspace/studio`.

Saving registration should redirect back with a status message and update:

```text
template_assets.rule_json.registrationProfile
```
