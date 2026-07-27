import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  // 0.1 (not the wizard's default 1.0) to match the sample rate already
  // used server/edge-side — capturing every transaction is rarely needed
  // and adds ongoing ingest cost. tracePropagationTargets is left at its
  // default (same-origin only) so trace headers aren't attached to
  // cross-origin calls to Supabase, which isn't expecting them.
  tracesSampleRate: 0.1,
  // Session replay stays off — still not needed, and adds client bundle
  // weight this app avoids for users on slower connections.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
