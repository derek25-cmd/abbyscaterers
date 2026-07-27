import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Error tracking only — no performance tracing (tracesSampleRate) or
  // session replay. Both pull in substantial extra client bundle weight,
  // and this app targets users on slower/less reliable connections, so the
  // shared JS payload on every page matters more here than it would for a
  // typical SaaS. Revisit if/when actual response-time visibility is needed.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
