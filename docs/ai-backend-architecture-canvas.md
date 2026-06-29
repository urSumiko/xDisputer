# AI Backend Architecture Canvas

## Status

Implemented as a backend foundation for the existing xDisputer codebase. This does not rewrite the current UI or generation behavior.

## Existing architecture fit

The repo currently uses:

- Next.js App Router API routes under `app/api/**/route.ts`
- Supabase SSR clients in `lib/supabase/server.ts`
- session and role helpers in `lib/saas/session.ts`
- system event logging through `lib/saas/system-observability.ts`
- strict TypeScript with no new runtime validation package

The AI backend follows those same patterns.

## Runtime flow

```txt
POST /api/ai
  -> Supabase SSR auth check
  -> per-user rate limit
  -> typed manual input validation
  -> AI service orchestration
  -> optional document retrieval
  -> optional safe background job creation
  -> optional OpenAI-compatible provider call
  -> ai_requests + ai_tool_calls persistence
  -> system_events observability
  -> no-store JSON response
```

## API contract

Endpoint:

```txt
POST /api/ai
```

Request body:

```json
{
  "mode": "direct_answer",
  "message": "Create a concise plan for this task.",
  "documentIds": [],
  "metadata": {},
  "stream": false
}
```

Allowed modes:

```txt
direct_answer
rag_answer
tool_action
planner
background_job
admin_review
```

Safe actions through `metadata.action`:

```txt
searchDocuments
createBackgroundJob
```

Supported queued job types:

```txt
generate_embeddings
parse_uploaded_file
generate_report
long_ai_planner
```

## Required database migrations

Run these in Supabase SQL editor or through the Supabase migration workflow:

```txt
supabase/migrations/20260616000000_ai_backend_architecture_foundation.sql
supabase/migrations/20260616001000_ai_backend_rls.sql
supabase/migrations/20260616002000_ai_chunks_text_search_index.sql
```

The first migration creates tables and indexes. The second migration enables ownership-scoped RLS. The third migration adds a trigram index for faster first-pass text retrieval over `ai_chunks.content`.

## Environment variables

Server-only:

```txt
OPENAI_API_KEY=
AI_MODEL_NAME=
OPENAI_API_BASE_URL=https://api.openai.com/v1
AI_REQUEST_TIMEOUT_MS=20000
AI_RATE_LIMIT_MAX=20
AI_RATE_LIMIT_WINDOW_MS=60000
```

If `OPENAI_API_KEY` or `AI_MODEL_NAME` is missing, `/api/ai` still works in safe fallback mode. It validates, logs, and returns a deterministic readiness response without calling a model.

## Files added

```txt
app/api/ai/route.ts
lib/core/result.ts
lib/core/rate-limit.ts
lib/ai/ai-types.ts
lib/ai/ai-schemas.ts
lib/ai/ai-guardrails.ts
lib/ai/ai-provider.ts
lib/ai/ai-db-utils.ts
lib/ai/ai-request-repository.ts
lib/ai/ai-tool-log-repository.ts
lib/ai/ai-document-repository.ts
lib/ai/ai-job-repository.ts
lib/ai/ai-tools.ts
lib/ai/ai-service.ts
supabase/migrations/20260616000000_ai_backend_architecture_foundation.sql
supabase/migrations/20260616001000_ai_backend_rls.sql
supabase/migrations/20260616002000_ai_chunks_text_search_index.sql
scripts/ai-backend-contract-guard.mjs
```

## Validation commands

Run locally:

```bash
npm install
node scripts/ai-backend-contract-guard.mjs
npm run typecheck
npm run build
```

Full repo gate:

```bash
npm run repo:guard
```

## Manual API smoke test

After login in the browser, test through a same-origin request so cookies are included:

```js
await fetch('/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'direct_answer',
    message: 'Confirm the AI backend is wired.',
    documentIds: [],
    metadata: {}
  })
}).then((res) => res.json())
```

Expected response shape:

```json
{
  "ok": true,
  "data": {
    "answer": "...",
    "mode": "direct_answer",
    "citations": [],
    "actions": [],
    "requestId": "...",
    "modelName": null,
    "usage": {
      "promptTokens": 0,
      "completionTokens": 0,
      "totalTokens": 0
    },
    "latencyMs": 0
  }
}
```

## Expected behavior after changes

- Existing UI and generation paths remain unchanged.
- New `/api/ai` endpoint is authenticated, no-store, rate-limited, and typed.
- AI requests are persisted when migrations are applied.
- Safe action calls are logged in `ai_tool_calls`.
- RAG mode uses current `ai_chunks` text retrieval as a safe baseline.
- Model calls happen only when server env vars are configured.
- Missing AI model configuration returns safe fallback output instead of breaking the app.

## Remaining risks

- The migration must be applied before persistent AI audit/job storage works.
- `rag_answer` currently performs text retrieval over `ai_chunks`; vector embedding/RPC can be added after ingestion workers exist.
- In-memory rate limiting is process-local. Use a database/edge/shared limiter before high-traffic production scaling.
- Streaming is not enabled yet; the first implementation prioritizes safe JSON behavior and no existing-route breakage.
