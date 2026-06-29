import { NextResponse } from 'next/server';
import { actionRegistry, contentRegistry, identityRegistry, layoutRegistry, navigationMap, performanceProfiles } from '../../../../lib/frontend-control';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      layer: 'frontend-control',
      status: 'ready',
      counts: {
        actions: Object.keys(actionRegistry).length,
        content: Object.keys(contentRegistry).length,
        identities: Object.keys(identityRegistry).length,
        layouts: Object.keys(layoutRegistry).length,
        navigation: navigationMap.length,
        performance: Object.keys(performanceProfiles).length
      }
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}
