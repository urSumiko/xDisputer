/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  }
];

const privateCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
  },
  {
    key: 'Pragma',
    value: 'no-cache'
  },
  {
    key: 'Expires',
    value: '0'
  },
  {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow, noarchive'
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb'
    }
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      },
      {
        source: '/master/:path*',
        headers: privateCacheHeaders
      },
      {
        source: '/admin/:path*',
        headers: privateCacheHeaders
      },
      {
        source: '/workspace/:path*',
        headers: privateCacheHeaders
      },
      {
        source: '/system/:path*',
        headers: privateCacheHeaders
      },
      {
        source: '/api/:path*',
        headers: privateCacheHeaders
      }
    ];
  }
};

export default nextConfig;
