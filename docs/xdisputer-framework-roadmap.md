# xDisputer Document Operations Framework

## Active framework direction

xDisputer is being upgraded from a browser-side packet generator into a document operations framework.

## Implemented foundations

- Authoritative generation contract
- Workflow framework facade
- Preflight validation contract
- Document generation service contract
- Operation state contract
- Browser storage adapter contract
- Document worker contract
- AI change-control policy
- GitHub quality gate

## Migration order

1. Keep the current UI behavior stable.
2. Move orchestration from `LetterGeneratorWorkspaceV2.tsx` into `services/document-generation-service.ts`.
3. Replace scattered busy/status booleans with `OperationState`.
4. Move heavy DOCX/PDF/ZIP operations into `workers/document-worker.ts`.
5. Add Supabase only as a storage adapter after access control and retention rules are defined.
6. Convert AI code changes from direct-to-main to pull-request-first for high-risk paths.

## Non-negotiable rules

- Packet order comes from `lib/generation-contract.ts`.
- UI components must not recreate workflow policy.
- Retired workflow capabilities must not reappear through stored metadata or hidden UI.
- Build and type-check must pass before merge.
