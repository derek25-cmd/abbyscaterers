import pino from 'pino';

// Server-only structured logger. Not for client components — pino writes to
// stdout, so importing this into a "use client" file would either no-op
// silently or pull needless bytes into the browser bundle depending on
// bundler behavior. Use console.* directly in client code.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
