import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();

const requiredFiles = [
  'app/api/ai/route.ts',
  'lib/core/result.ts',
  'lib/core/rate-limit.ts',
  'lib/ai/ai-types.ts',
  'lib/ai/ai-schemas.ts',
  'lib/ai/ai-guardrails.ts',
  'lib/ai/ai-provider.ts',
  'lib/ai/ai-db-utils.ts',
  'lib/ai/ai-request-repository.ts',
  'lib/ai/ai-tool-log-repository.ts',
  'lib/ai/ai-document-repository.ts',
  'lib/ai/ai-job-repository.ts',
  'lib/ai/ai-tools.ts',
  'lib/ai/ai-service.ts',
  'supabase/migrations/20260616000000_ai_backend_architecture_foundation.sql',
  'supabase/migrations/20260616001000_ai_backend_rls.sql',
  'docs/ai-backend-architecture-canvas.md'
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required AI backend file: ${file}`);
  }
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

if (!failures.length) {
  const route = read('app/api/ai/route.ts');
  const service = read('lib/ai/ai-service.ts');
  const schema = read('lib/ai/ai-schemas.ts');
  const provider = read('lib/ai/ai-provider.ts');
  const rls = read('supabase/migrations/20260616001000_ai_backend_rls.sql');

  if (!route.includes("export const dynamic = 'force-dynamic'")) {
    failures.push('AI route must be force-dynamic.');
  }

  if (!route.includes('configuredRateLimit')) {
    failures.push('AI route must enforce rate limiting.');
  }

  if (!route.includes('supabase.auth.getUser')) {
    failures.push('AI route must authenticate with Supabase before execution.');
  }

  if (!schema.includes('parseAiRequestInput')) {
    failures.push('AI request schema parser is missing.');
  }

  if (!service.includes('createAiRequestRecord') || !service.includes('completeAiRequestRecord')) {
    failures.push('AI service must persist request start/completion.');
  }

  if (!provider.includes('OPENAI_API_KEY') || !provider.includes('AI_MODEL_NAME')) {
    failures.push('AI provider must use server-only model environment variables.');
  }

  if (!rls.includes('enable row level security') || !rls.includes('auth.uid() = owner_id')) {
    failures.push('AI backend RLS migration must enforce owner_id isolation.');
  }
}

if (failures.length) {
  console.error('AI backend contract guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  exit(1);
}

console.log('AI backend contract guard passed.');
