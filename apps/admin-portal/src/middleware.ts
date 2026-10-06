import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// /api/send-push is called by Supabase's Database Webhook (pg_net), which
// has no Clerk session — it authenticates via its own shared-secret header
// instead, checked inside the route handler.
// /manifest.json is fetched by the browser without credentials, so it must be
// public or PWA installability breaks.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/api/send-push', '/manifest.json']);

// signInUrl here (not just on <ClerkProvider>, which only affects the browser)
// is what makes auth.protect() redirect to our own /sign-in page instead of
// Clerk's hosted Account Portal.
export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-in' }
);

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
