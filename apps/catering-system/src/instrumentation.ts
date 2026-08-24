import * as Sentry from "@sentry/nextjs";

// Sentry.init must run directly inside register() — the split
// sentry.server.config.ts/sentry.edge.config.ts pattern (an older SDK
// convention) is no longer compatible with @sentry/nextjs v10's build-time
// instrumentation rewriting and breaks this file's register() export.
//
// This file (src/instrumentation.ts), not the root instrumentation.ts, is
// the one Next.js actually resolves — this project uses a src/ directory,
// and Next prefers src/instrumentation.ts when one exists. A leftover empty
// stub here was silently shadowing the root file's real implementation.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
