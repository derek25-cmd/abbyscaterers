
const path = require('path');

const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Required on Next.js 14 (stabilized without this flag in 15+) for
  // instrumentation.ts to actually be picked up — without it, Sentry's
  // server/edge init silently never runs.
  experimental: {
    instrumentationHook: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'enpcjcesyvjqugnxdslp.supabase.co',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
  async headers() {
    // CSP is intentionally permissive on script-src/style-src ('unsafe-inline') rather than
    // nonce-based, since a stricter policy needs middleware.ts + live browser verification that
    // isn't possible to confirm from a static review — an overly strict CSP that blank-pages the
    // app is worse than a somewhat permissive one. connect-src/img-src are scoped to the actual
    // external services this app talks to from the browser (Supabase, Mapbox) — verify in the
    // browser console for CSP violations after deploying, especially the live map page.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.sentry.io https://*.ingest.sentry.io",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

// Inert until SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are set (source-map
// upload just gets skipped with a warning, not a build failure) — error
// reporting itself only needs NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN, set
// separately in sentry.server.config.ts / sentry.edge.config.ts / instrumentation-client.ts.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
  widenClientFileUpload: false,
  // Strips debug/replay code the client bundle doesn't need since replay
  // and tracing are both off in instrumentation-client.ts — see the
  // bundle-size note there.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
