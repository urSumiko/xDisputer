# xDisputer Manager Workspace Dynamic Template Navigation

## Implemented model

The manager workspace sidebar is now organized around three functional hubs instead of five static process labels.

```txt
Template Library  -> source-of-truth templates, rounds, versions, sync readiness
Template Studio   -> parser rules, canonical mapping, preservation rules, variables, entities, table layout
Generation Engine -> preview, renderer diagnostics, release readiness, automation safety
```

## Routes

```txt
/manager-workspace         Template Library
/manager-workspace/studio  Template Studio
/manager-workspace/engine  Generation Engine
```

Old static workspace routes redirect into the new hubs:

```txt
/contracts  -> /studio
/mappings   -> /studio
/quality    -> /engine
/releases   -> /engine
/automation -> /engine
```

## Source contracts

```txt
lib/templates/workspace/template-workspace-navigation.ts
lib/templates/workspace/template-workspace-contract.ts
lib/templates/workspace/template-library-service.ts
lib/templates/workspace/template-studio-service.ts
lib/templates/workspace/generation-engine-service.ts
components/templates/workspace/TemplateWorkspaceShell.tsx
components/templates/workspace/TemplateLibraryHub.tsx
components/templates/workspace/TemplateStudioHub.tsx
components/templates/workspace/GenerationEngineHub.tsx
scripts/template-workspace-contract-guard.mjs
```

## Guard

```bash
npm run template-workspace:guard
```

This guard fails if old static nav labels return, if the three routes are missing, or if preserve/replace/readiness logic is removed.
