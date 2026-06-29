import type { NextRequest } from 'next/server';

function cleanOrigin(value: string | null | undefined) {
  if (!value) return '';
  return value.replace(/\/$/, '');
}

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = request.headers.get('host');
  if (host && !host.startsWith('0.0.0.0')) {
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

function isLocalOrigin(value: string) {
  return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(value);
}

function isHostedRequest(value: string) {
  return /\.app\.github\.dev|\.vercel\.app|\.githubpreview\.dev/.test(value);
}

export function getAppOrigin(request: NextRequest) {
  const configured = cleanOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const detected = requestOrigin(request);

  /*
    Codespaces/Vercel safety:
    - NEXT_PUBLIC_SITE_URL is often set to http://localhost:3000 during local setup.
    - In a hosted browser session, redirecting to localhost sends the user to their own machine,
      which causes ERR_CONNECTION_REFUSED.
    - Prefer the real request host when the configured value is local but the request is hosted.
  */
  if (configured && !(isLocalOrigin(configured) && isHostedRequest(detected))) return configured;

  return detected;
}

export function appRedirect(request: NextRequest, pathname: string, params?: Record<string, string | undefined>) {
  const url = new URL(pathname, getAppOrigin(request));
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
}
