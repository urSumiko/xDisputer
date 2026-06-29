# Feature Slices

This folder is the modernization destination for frontend and product-domain ownership.

## Rule

Move one feature at a time. Do not move files only to satisfy folder structure. A feature move is complete only when ownership, UI state, loading/error/empty states, contracts, and service boundaries are clear.

## Planned slices

- `auth`
- `accounts`
- `templates`
- `source-data`
- `generation`
- `outputs`
- `evidence`
- `notifications`
- `admin`

## Standard feature shape

```text
feature-name/
  components/
  hooks/
  schemas/
  actions/
  utils/
  types.ts
```

Use shared UI only when a component is truly cross-feature.
