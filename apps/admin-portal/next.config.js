const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    runtimeCaching: [
      // Clerk auth — never cache.
      {
        urlPattern: /^https:\/\/[^/]*clerk[^/]*\/.*/i,
        handler: 'NetworkOnly',
      },
      // Supabase REST/RPC data reads — always try fresh, fall back to a
      // short-lived cache when offline. Full IndexedDB record caching with
      // LRU eviction is a later phase; this is just the runtime-caching layer.
      {
        urlPattern: /^https:\/\/[^/]*supabase[^/]*\/rest\/v1\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
          networkTimeoutSeconds: 8,
        },
      },
      // Static assets — icons, fonts, images rarely change.
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // App shell — HTML/JS/CSS: serve cached instantly, refresh in background.
      {
        urlPattern: /^https?:\/\/.*\/(?:_next\/static|_next\/image).*/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'app-shell' },
      },
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'pages' },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@abbyscaterers/database',
    '@abbyscaterers/types',
    '@abbyscaterers/validation',
  ],
};

module.exports = withPWA(nextConfig);
