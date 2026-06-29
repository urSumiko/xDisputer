import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    app: 'xDisputer',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    gitCommitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    deployedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
