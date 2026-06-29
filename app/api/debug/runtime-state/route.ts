import { NextResponse } from 'next/server';
import { XDISPUTER_RUNTIME_SYNC } from '../../../../lib/runtime-source-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: XDISPUTER_RUNTIME_SYNC,
    envCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || null,
    nodeEnv: process.env.NODE_ENV || null,
    serverTime: new Date().toISOString(),
    howToConfirm: 'If this endpoint does not show marker xdisputer-runtime-20260624-disputer-terminology-v1, the running website is not using the latest pulled code or it needs a clean restart.'
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}
