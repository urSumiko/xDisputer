# Template Provenance Workspace Patch Notes

_Last updated: 2026-06-17 Asia/Tokyo_

## Status

Resolved and guarded.

The template contract workflow previously had one browser workspace patch marked as safer to apply locally because `components/LetterGeneratorWorkspaceV2.tsx` is large and single-line-heavy in its JSX return. The active repo now contains the required wiring and a dedicated guard to prevent regression.

## Browser workspace wiring

Target file:

```text
components/LetterGeneratorWorkspaceV2.tsx
```

Resolved requirements:

1. `RegistryTemplateAsset` includes:

```ts
validation_json?: Record<string, unknown> | null;
content_hash?: string | null;
version_number?: number | null;
```

2. Supabase-backed letter assets are converted into effective letter references with manifest provenance metadata:

```ts
assetId: asset.id,
versionNumber: asset.version_number || null,
contentHash: asset.content_hash || null,
validationJson: asset.validation_json || null
```

3. Supabase-backed exhibit assets are converted into effective exhibit templates with the same manifest provenance metadata.

4. Both browser `buildGenerationManifest(...)` calls pass:

```ts
references: effectiveRefs,
templates: effectiveTemplates,
```

5. `scripts/template-provenance-workspace-guard.mjs` now verifies the contract above.

## Why this matters

`lib/generation-manifest.ts` supports source hash, source summary, template provenance, asset ID, version, content hash, and validation status. The workspace wiring makes browser-created `generation-manifest.json` include the same Supabase-backed template proof already available to the UI.

## Validation

```bash
npm run template-provenance:guard
npm run typecheck
npm run build
npm run xdisputer:guard
```

Then generate a packet and inspect `generation-manifest.json` for:

```text
Source Hash:
Templates:
asset
version
hash
status
```

## Remaining optional hardening

- Atomic activation RPC for template asset activation.
- Archived-template retention UI backed by the existing retention candidate view.
