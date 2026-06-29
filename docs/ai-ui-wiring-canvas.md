# xDisputer AI UI Wiring Canvas

## Purpose

This canvas wires selected UI workflows into the authenticated `/api/ai` backend without replacing deterministic packet generation. AI is an assistant layer for explanation, review, and operational guidance. Existing validation and generation rules remain the source of truth.

## Implemented UI flows

### Source Review

Location: `components/GuidedSourceDataFlow.tsx`

The Source Data workflow now renders `SourceReviewAiPanel` in the review and evidence stages. The panel calls `/api/ai` with `mode: source_review` and sends only bounded workflow metadata, not raw hidden secrets. It merges deterministic findings with the backend AI response.

Hard rules:

- AI cannot enable generation.
- AI cannot override `packetReady`.
- AI cannot mutate source data.
- The Generate button stays disabled until deterministic packet readiness is true.
- Visible generation blocker reasons remain rendered with `id="generation-blocked-reasons"`.

### Template Intelligence

Location: `components/TemplateProgressiveWorkspace.tsx`

The Templates workflow now renders `TemplateIntelligencePanel` in packet selection and packet editor stages. The panel calls `/api/ai` with `mode: template_intelligence` and sends template slot metadata, contract summaries, validation status, missing fields, and warnings.

Hard rules:

- AI cannot upload templates.
- AI cannot remove templates.
- AI cannot activate or archive manager assets.
- AI cannot change template authority.
- AI can only explain coverage, warnings, and safe next steps.

## Shared contract

- `lib/ai/ai-ui-result.ts` defines the typed UI result model.
- `lib/ai/ai-ui-client.ts` provides the browser client for `/api/ai`.
- `components/AiInsightPanel.tsx` renders sanitized structured output.
- `scripts/ai-ui-contract-guard.mjs` verifies that the UI wiring remains non-mutating and does not use unsafe rendering.

## Modes

The backend mode allowlist now includes:

- `source_review`
- `template_intelligence`

The provider fallback text in `lib/ai/ai-guardrails.ts` has explicit safe messages for both modes. When `AI_MODEL_NAME` and `OPENAI_API_KEY` are not configured, these UI panels still work with deterministic findings and safe fallback summaries.

## Performance model

The UI calls are user-triggered. There is no automatic AI request on page load.

Latency rules:

1. Deterministic findings are computed locally first.
2. AI calls use `cache: 'no-store'` because the payload can contain client workflow metadata.
3. The UI remains usable if the AI call fails.
4. Heavy document/RAG work stays in backend repositories and future background jobs.

## Security model

All AI outputs are treated as untrusted until normalized. The result normalizer strips HTML-like tags and control characters. The shared panel renders text nodes only and does not use `dangerouslySetInnerHTML`.

AI panels are assistant-only. They are not mutation surfaces.

## Validation commands

Run from Codespaces:

```bash
node scripts/ai-backend-contract-guard.mjs
node scripts/ai-ui-contract-guard.mjs
npm run typecheck
npm run build
```

## Manual tests

1. Open Templates.
2. Select a round.
3. Confirm the Template Intelligence panel appears.
4. Click **Analyze templates with AI**.
5. Confirm findings appear and no template is changed.
6. Open Source Data.
7. Load or create source data.
8. Lock source and go to Review.
9. Confirm the AI Source Review panel appears.
10. Click **Review source with AI**.
11. Confirm findings appear and generation remains blocked until deterministic requirements are met.
